"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Contact, Deal, ContactNote, Tag, PipelineStage } from "@/types";
import {
  Phone,
  Mail,
  Copy,
  Check,
  User,
  Tag as TagIcon,
  DollarSign,
  StickyNote,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { DealForm } from "@/components/pipelines/deal-form";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

interface ContactSidebarProps {
  contact: Contact | null;
}

export function ContactSidebar({ contact }: ContactSidebarProps) {
  const { accountId } = useAuth();
  const [copied, setCopied] = useState(false);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [tags, setTags] = useState<(Tag & { contact_tag_id: string })[]>([]);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  // Notes editing states
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");
  const [updatingNote, setUpdatingNote] = useState(false);

  // Deals states
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [dealFormOpen, setDealFormOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);

  // Tags search and assignment states
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [tagSearchQuery, setTagSearchQuery] = useState("");

  const fetchContactData = useCallback(async () => {
    if (!contact) return;

    const supabase = createClient();

    // Fetch deals, notes, and tags in parallel
    const [dealsRes, notesRes, tagsRes] = await Promise.all([
      supabase
        .from("deals")
        .select("*, stage:pipeline_stages(*)")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contact_notes")
        .select("*")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contact_tags")
        .select("id, tag_id, tags(*)")
        .eq("contact_id", contact.id),
    ]);

    if (dealsRes.data) setDeals(dealsRes.data);
    if (notesRes.data) setNotes(notesRes.data);
    if (tagsRes.data) {
      const mapped = tagsRes.data
        .filter((ct: Record<string, unknown>) => ct.tags)
        .map((ct: Record<string, unknown>) => ({
          ...(ct.tags as Tag),
          contact_tag_id: ct.id as string,
        }));
      setTags(mapped);
    }
  }, [contact]);

  // Load on contact change. setContactData/setTags run inside async
  // Supabase callbacks, not synchronously in the effect body.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchContactData();
  }, [fetchContactData]);

  // Load pipelines and stages on mount/auth load
  useEffect(() => {
    if (!accountId) return;
    async function loadPipelinesAndStages() {
      const supabase = createClient();
      const { data: pipelineData } = await supabase
        .from("pipelines")
        .select("*")
        .order("created_at");

      if (pipelineData && pipelineData.length > 0) {
        setPipelines(pipelineData);
        const { data: stageData } = await supabase
          .from("pipeline_stages")
          .select("*")
          .eq("pipeline_id", pipelineData[0].id)
          .order("position");
        if (stageData) setStages(stageData);
      }
    }
    loadPipelinesAndStages();
  }, [accountId]);

  // Load all available tags on mount/auth load
  useEffect(() => {
    if (!accountId) return;
    async function loadAllTags() {
      const supabase = createClient();
      const { data } = await supabase
        .from("tags")
        .select("*")
        .order("name");
      if (data) setAllTags(data);
    }
    loadAllTags();
  }, [accountId]);

  const handleCopyPhone = useCallback(async () => {
    if (!contact?.phone) return;
    await navigator.clipboard.writeText(contact.phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    // Dep is the whole `contact` object (not `contact?.phone`) so the
    // React Compiler's inference agrees with the manual dep list —
    // fixes the `preserve-manual-memoization` lint error.
  }, [contact]);

  const handleAddNote = useCallback(async () => {
    if (!contact || !newNote.trim()) return;
    setAddingNote(true);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    const { data, error } = await supabase
      .from("contact_notes")
      .insert({
        account_id: accountId,
        contact_id: contact.id,
        user_id: user?.id,
        note_text: newNote.trim(),
      })
      .select()
      .single();

    if (!error && data) {
      setNotes((prev) => [data, ...prev]);
      setNewNote("");
    }
    setAddingNote(false);
  }, [contact, newNote, accountId]);

  const handleUpdateNote = useCallback(async (noteId: string) => {
    if (!editingNoteText.trim()) return;
    setUpdatingNote(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("contact_notes")
      .update({ note_text: editingNoteText.trim() })
      .eq("id", noteId)
      .select()
      .single();

    if (!error && data) {
      setNotes((prev) => prev.map((n) => (n.id === noteId ? data : n)));
      setEditingNoteId(null);
      setEditingNoteText("");
      toast.success("Note updated");
    } else {
      toast.error("Failed to update note");
    }
    setUpdatingNote(false);
  }, [editingNoteText]);

  const handleDeleteNote = useCallback(async (noteId: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("contact_notes")
      .delete()
      .eq("id", noteId);

    if (!error) {
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      toast.success("Note deleted");
    } else {
      toast.error("Failed to delete note");
    }
  }, []);

  const handleToggleTag = useCallback(async (tag: Tag) => {
    if (!contact) return;
    const supabase = createClient();
    const existing = tags.find((t) => t.id === tag.id);

    if (existing) {
      // Remove tag
      const { error } = await supabase
        .from("contact_tags")
        .delete()
        .eq("contact_id", contact.id)
        .eq("tag_id", tag.id);

      if (!error) {
        setTags((prev) => prev.filter((t) => t.id !== tag.id));
        toast.success(`Removed tag: ${tag.name}`);
      } else {
        toast.error("Failed to remove tag");
      }
    } else {
      // Add tag
      const { data, error } = await supabase
        .from("contact_tags")
        .insert({
          contact_id: contact.id,
          tag_id: tag.id,
        })
        .select()
        .single();

      if (!error && data) {
        setTags((prev) => [
          ...prev,
          {
            ...tag,
            contact_tag_id: data.id,
          },
        ]);
        toast.success(`Added tag: ${tag.name}`);
      } else {
        toast.error("Failed to add tag");
      }
    }
  }, [contact, tags]);

  const filteredTags = allTags.filter((tag) =>
    tag.name.toLowerCase().includes(tagSearchQuery.toLowerCase())
  );

  if (!contact) {
    return (
      <div className="flex h-full w-70 items-center justify-center border-l border-slate-800 bg-slate-900">
        <p className="text-sm text-slate-500">Select a conversation</p>
      </div>
    );
  }

  const displayName = contact.name || contact.phone;
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <div className="flex h-full w-70 flex-col border-l border-slate-800 bg-slate-900">
      <ScrollArea className="flex-1">
        <div className="p-4">
          {/* Contact Info */}
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-700 text-lg font-semibold text-white">
              {contact.avatar_url ? (
                <img
                  src={contact.avatar_url}
                  alt={displayName}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <h3 className="mt-3 text-sm font-semibold text-white">
              {displayName}
            </h3>
            {contact.company && (
              <p className="text-xs text-slate-400">{contact.company}</p>
            )}
          </div>

          {/* Phone */}
          <div className="mt-4 space-y-2">
            <button
              onClick={handleCopyPhone}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800"
            >
              <Phone className="h-4 w-4 text-slate-500" />
              <span className="flex-1 text-left">{contact.phone}</span>
              {copied ? (
                <Check className="h-3 w-3 text-primary" />
              ) : (
                <Copy className="h-3 w-3 text-slate-600" />
              )}
            </button>

            {contact.email && (
              <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300">
                <Mail className="h-4 w-4 text-slate-500" />
                <span className="truncate">{contact.email}</span>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="my-4 border-t border-slate-800" />

          {/* Tags */}
          <div>
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                <TagIcon className="h-3 w-3" />
                Tags
              </div>
              <Popover>
                <PopoverTrigger
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                  aria-label="Add tag"
                >
                  <Plus className="h-3.5 w-3.5" />
                </PopoverTrigger>
                <PopoverContent className="w-56 p-1 bg-slate-900 border border-slate-800 rounded-lg shadow-md text-slate-200">
                  <div className="p-2 border-b border-slate-800">
                    <Input
                      value={tagSearchQuery}
                      onChange={(e) => setTagSearchQuery(e.target.value)}
                      placeholder="Filter tags..."
                      className="h-8 bg-slate-800 border-slate-700 text-xs placeholder-slate-500 text-white"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto p-1 space-y-0.5">
                    {filteredTags.length === 0 ? (
                      <p className="text-xs text-slate-500 p-3 text-center">
                        No tags found
                      </p>
                    ) : (
                      filteredTags.map((tag) => {
                        const isAssigned = tags.some((t) => t.id === tag.id);
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => handleToggleTag(tag)}
                            className={cn(
                              "w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs text-left transition-colors cursor-pointer",
                              "hover:bg-slate-800 text-slate-300 hover:text-white"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: tag.color }}
                              />
                              <span className="truncate">{tag.name}</span>
                            </div>
                            {isAssigned && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {tags.length === 0 ? (
                <p className="px-1 text-xs text-slate-600">No tags</p>
              ) : (
                tags.map((tag) => (
                  <span
                    key={tag.contact_tag_id}
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor: `${tag.color}20`,
                      color: tag.color,
                    }}
                  >
                    {tag.name}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="my-4 border-t border-slate-800" />

          {/* Active Deals */}
          <div>
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                <DollarSign className="h-3 w-3" />
                Active Deals
              </div>
              <button
                type="button"
                onClick={() => {
                  if (pipelines.length === 0) {
                    toast.error("Please configure a pipeline in Settings first.");
                    return;
                  }
                  setEditingDeal(null);
                  setDealFormOpen(true);
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-2 space-y-2">
              {deals.length === 0 ? (
                <p className="px-1 text-xs text-slate-600">No deals</p>
              ) : (
                deals.map((deal) => (
                  <div
                    key={deal.id}
                    onClick={() => {
                      setEditingDeal(deal);
                      setDealFormOpen(true);
                    }}
                    className="group relative rounded-lg bg-slate-800 px-3 py-2 cursor-pointer hover:bg-slate-700 transition-colors"
                  >
                    <p className="text-sm font-medium text-white group-hover:text-primary transition-colors">
                      {deal.title}
                    </p>
                    <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
                      <span>
                        {deal.currency ?? "$"}
                        {deal.value.toLocaleString()}
                      </span>
                      {deal.stage && (
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[10px]"
                          style={{
                            backgroundColor: `${deal.stage.color}20`,
                            color: deal.stage.color,
                          }}
                        >
                          {deal.stage.name}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="my-4 border-t border-slate-800" />

          {/* Notes */}
          <div>
            <div className="flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wider text-slate-500">
              <StickyNote className="h-3 w-3" />
              Notes
            </div>
            <div className="mt-2">
              <div className="flex gap-2">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note..."
                  rows={2}
                  className="flex-1 resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-primary/50"
                />
                <Button
                  size="sm"
                  className="h-auto bg-primary px-2 hover:bg-primary/90"
                  onClick={handleAddNote}
                  disabled={!newNote.trim() || addingNote}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>

              <div className="mt-2 space-y-2">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="group rounded-lg bg-slate-800 px-3 py-2 space-y-2"
                  >
                    {editingNoteId === note.id ? (
                      <div className="space-y-1.5">
                        <textarea
                          value={editingNoteText}
                          onChange={(e) => setEditingNoteText(e.target.value)}
                          className="w-full resize-none rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white outline-none focus:border-primary/50"
                          rows={2}
                        />
                        <div className="flex justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingNoteId(null)}
                            className="text-slate-400 text-[10px] h-6 px-2 hover:bg-slate-700"
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            disabled={!editingNoteText.trim() || updatingNote}
                            onClick={() => handleUpdateNote(note.id)}
                            className="bg-primary text-white text-[10px] h-6 px-2 hover:bg-primary/90"
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="whitespace-pre-wrap text-xs text-slate-300">
                          {note.note_text}
                        </p>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-[10px] text-slate-500">
                            {format(new Date(note.created_at), "MMM d, yyyy HH:mm")}
                          </p>
                          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingNoteId(note.id);
                                setEditingNoteText(note.note_text);
                              }}
                              className="text-slate-400 hover:text-white transition-colors"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteNote(note.id)}
                              className="text-slate-400 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>

      {pipelines.length > 0 && (
        <DealForm
          open={dealFormOpen}
          onOpenChange={setDealFormOpen}
          deal={editingDeal}
          pipelineId={pipelines[0].id}
          stages={stages}
          defaultStageId={stages[0]?.id}
          defaultContactId={contact.id}
          onSaved={fetchContactData}
        />
      )}
    </div>
  );
}
