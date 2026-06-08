'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Loader2, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { formatWhatsAppText } from '@/lib/whatsapp/text-formatter';

interface QuickMessage {
  id: string;
  title: string;
  content: string;
  shortcut: string | null;
  created_at: string;
}

export function QuickMessagesPanel() {
  const [loading, setLoading] = useState(true);
  const [quickMessages, setQuickMessages] = useState<QuickMessage[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedQM, setSelectedQM] = useState<QuickMessage | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [shortcut, setShortcut] = useState('');

  useEffect(() => {
    fetchQuickMessages();
  }, []);

  async function fetchQuickMessages() {
    try {
      setLoading(true);
      const res = await fetch('/api/quick-messages');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch quick messages');
      setQuickMessages(data.quickMessages || []);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to load quick messages');
    } finally {
      setLoading(false);
    }
  }

  function openCreateDialog() {
    setSelectedQM(null);
    setTitle('');
    setContent('');
    setShortcut('');
    setDialogOpen(true);
  }

  function openEditDialog(qm: QuickMessage) {
    setSelectedQM(qm);
    setTitle(qm.title);
    setContent(qm.content);
    setShortcut(qm.shortcut || '');
    setDialogOpen(true);
  }

  function openDeleteDialog(qm: QuickMessage) {
    setSelectedQM(qm);
    setDeleteDialogOpen(true);
  }

  async function handleSave() {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!content.trim()) {
      toast.error('Content is required');
      return;
    }

    // Validation for shortcut
    let formattedShortcut = shortcut.trim();
    if (formattedShortcut) {
      // Remove leading slash if user added it
      if (formattedShortcut.startsWith('/')) {
        formattedShortcut = formattedShortcut.substring(1);
      }
      if (/\s/.test(formattedShortcut)) {
        toast.error('Shortcut must not contain spaces');
        return;
      }
    }

    try {
      setSaving(true);
      const payload = {
        title: title.trim(),
        content: content.trim(),
        shortcut: formattedShortcut || null,
      };

      const url = selectedQM
        ? `/api/quick-messages/${selectedQM.id}`
        : '/api/quick-messages';
      
      const method = selectedQM ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save quick message');

      toast.success(selectedQM ? 'Quick message updated' : 'Quick message created');
      setDialogOpen(false);
      fetchQuickMessages();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to save quick message');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedQM) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/quick-messages/${selectedQM.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');

      toast.success('Quick message deleted');
      setDeleteDialogOpen(false);
      setQuickMessages((prev) => prev.filter((qm) => qm.id !== selectedQM.id));
      setSelectedQM(null);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white font-sans">Quick Messages</h2>
          <p className="text-sm text-slate-400 font-sans">
            Predefine common replies. Use shortcut triggers (e.g. typing <code className="bg-slate-800 text-slate-200 px-1 py-0.5 rounded text-xs">/greet</code> in chat) to quickly write messages.
          </p>
        </div>
        <Button
          onClick={openCreateDialog}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-sans font-medium"
        >
          <Plus className="size-4 mr-2" />
          Add Template
        </Button>
      </div>

      {quickMessages.length === 0 ? (
        <Card className="bg-slate-900/40 border-slate-800 ring-0 ring-transparent">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-slate-400 text-sm font-sans">No quick messages yet.</p>
            <p className="text-slate-500 text-xs mt-1 font-sans">Create templates to avoid repetitive typing.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {quickMessages.map((qm) => (
            <Card key={qm.id} className="bg-slate-900/40 border-slate-800 hover:border-slate-700 transition-colors ring-0 ring-transparent flex flex-col justify-between">
              <CardContent className="pt-4 flex flex-col gap-2 h-full">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-white truncate text-base font-sans">{qm.title}</h3>
                    {qm.shortcut && (
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold bg-primary/10 border border-primary/20 text-primary mt-1 font-mono">
                        /{qm.shortcut}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(qm)}
                      className="size-8 text-slate-400 hover:text-white hover:bg-slate-800"
                    >
                      <Edit2 className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openDeleteDialog(qm)}
                      className="size-8 text-slate-400 hover:text-red-400 hover:bg-slate-800"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="mt-2 text-sm text-slate-350 flex-1 overflow-hidden font-sans">
                  {formatWhatsAppText(qm.content)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Save Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 sm:max-w-md text-white font-sans">
          <DialogHeader>
            <DialogTitle className="text-white">
              {selectedQM ? 'Edit Quick Message' : 'New Quick Message'}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Save predefined message templates for your workspace.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="qm-title" className="text-slate-300">Message Title</Label>
              <Input
                id="qm-title"
                placeholder="e.g. Greeting Template"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-primary focus-visible:border-primary"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="qm-shortcut" className="text-slate-300">Shortcut (Optional)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm">/</span>
                <Input
                  id="qm-shortcut"
                  placeholder="greet"
                  value={shortcut}
                  onChange={(e) => setShortcut(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 pl-6 font-mono focus-visible:ring-primary focus-visible:border-primary"
                />
              </div>
              <p className="text-[11px] text-slate-500 font-sans">
                A simple keyword to search this template. Must not contain spaces.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="qm-content" className="text-slate-300">Message Content</Label>
              <Textarea
                id="qm-content"
                placeholder="Hello {{name}}, thanks for contacting us! How can we help you today?"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-primary focus-visible:border-primary resize-y"
              />
            </div>
          </div>

          <DialogFooter className="bg-slate-900 border-slate-800 pt-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="border-slate-800 text-slate-300 hover:bg-slate-850 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-1.5" />
                  Saving...
                </>
              ) : (
                'Save Template'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 sm:max-w-sm text-white font-sans">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Quick Message</DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to delete the quick message &quot;{selectedQM?.title}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="bg-slate-900 border-slate-800 pt-2">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="border-slate-800 text-slate-300 hover:bg-slate-850 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-1.5" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
