"use client";

import { useState, useRef, useCallback, KeyboardEvent, useEffect } from "react";
import { Send, LayoutTemplate, Smile, Paperclip, Image, Zap, X, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GatedButton } from "@/components/ui/gated-button";
import { useCan } from "@/hooks/use-can";
import { cn } from "@/lib/utils";
import { ReplyQuote } from "./reply-quote";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { EmojiPicker } from "./emoji-picker";

interface ReplyDraft {
  /** Internal UUID of the message being replied to — sent back through onSend. */
  id: string;
  authorLabel: string;
  preview: string;
}

interface QuickMessage {
  id: string;
  title: string;
  content: string;
  shortcut: string | null;
}

interface PendingAttachment {
  url: string;
  name: string;
  type: 'image' | 'video' | 'document';
  size: number;
}

interface MessageComposerProps {
  conversationId: string;
  sessionExpired: boolean;
  onSend: (
    text: string,
    replyToId?: string,
    mediaUrl?: string,
    mediaType?: 'image' | 'video' | 'document'
  ) => void;
  onOpenTemplates: () => void;
  replyTo?: ReplyDraft | null;
  onClearReply?: () => void;
}

export function MessageComposer({
  conversationId,
  sessionExpired,
  onSend,
  onOpenTemplates,
  replyTo,
  onClearReply,
}: MessageComposerProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSend = useCan("send-messages");
  const readOnly = !canSend;

  // Quick message states
  const [quickMessages, setQuickMessages] = useState<QuickMessage[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Emoji picker & attachment states
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);

  // Fetch quick messages on mount
  useEffect(() => {
    async function loadQuickMessages() {
      try {
        const res = await fetch("/api/quick-messages");
        const data = await res.json();
        if (res.ok && data.quickMessages) {
          setQuickMessages(data.quickMessages);
        }
      } catch (err) {
        console.error("Failed to load quick messages:", err);
      }
    }
    loadQuickMessages();
  }, []);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    // Max 4 lines (~96px)
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if ((!trimmed && !pendingAttachment) || sending || sessionExpired) return;

    setSending(true);
    try {
      onSend(
        trimmed,
        replyTo?.id,
        pendingAttachment?.url,
        pendingAttachment?.type
      );
      setText("");
      setPendingAttachment(null);
      setShowEmojiPicker(false);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } finally {
      setSending(false);
    }
  }, [text, sending, sessionExpired, onSend, replyTo?.id, pendingAttachment]);

  const filteredQM = quickMessages.filter((qm) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      qm.title.toLowerCase().includes(q) ||
      qm.content.toLowerCase().includes(q) ||
      (qm.shortcut && qm.shortcut.toLowerCase().includes(q))
    );
  });

  const selectQuickMessage = useCallback((qm: QuickMessage) => {
    if (!qm) return;
    setText((prev) => {
      const idx = prev.lastIndexOf("/");
      if (idx === -1) return prev + qm.content;
      return prev.substring(0, idx) + qm.content;
    });
    setShowAutocomplete(false);
    setTimeout(() => {
      textareaRef.current?.focus();
      adjustHeight();
    }, 0);
  }, [adjustHeight]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (showAutocomplete && filteredQM.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % filteredQM.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + filteredQM.length) % filteredQM.length);
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          selectQuickMessage(filteredQM[selectedIndex]);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setShowAutocomplete(false);
          return;
        }
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [showAutocomplete, filteredQM, selectedIndex, selectQuickMessage, handleSend]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setText(val);
      adjustHeight();

      const match = val.match(/\/(\S*)$/);
      if (match) {
        setShowAutocomplete(true);
        setSearchQuery(match[1]);
        setSelectedIndex(0);
      } else {
        setShowAutocomplete(false);
      }
    },
    [adjustHeight]
  );

  const applyTextFormatting = useCallback((formatChar: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const val = el.value;

    const selectedText = val.substring(start, end);
    const replacement = `${formatChar}${selectedText}${formatChar}`;
    
    setText(val.substring(0, start) + replacement + val.substring(end));
    
    setTimeout(() => {
      el.focus();
      const newCursorPos = start + formatChar.length + selectedText.length + formatChar.length;
      el.setSelectionRange(newCursorPos, newCursorPos);
      adjustHeight();
    }, 0);
  }, [adjustHeight]);

  const handleFileUpload = async (file: File, type: 'image' | 'video' | 'document') => {
    if (file.size > 16 * 1024 * 1024) {
      toast.error(`File is ${(file.size / 1024 / 1024).toFixed(1)} MB — limit is 16 MB.`);
      return;
    }
    
    setUploading(true);
    try {
      const supabase = createClient();
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) throw new Error("Not signed in.");

      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("account_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileErr || !profile?.account_id) {
        throw new Error("Could not resolve account ID.");
      }

      const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
      const safeBase = file.name
        .replace(/\.[^.]+$/, "")
        .replace(/[^a-zA-Z0-9_-]+/g, "_")
        .slice(0, 40) || "file";
      const path = `account-${profile.account_id}/${Date.now()}-${safeBase}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("flow-media")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (upErr) throw new Error(upErr.message);

      const { data: { publicUrl } } = supabase.storage.from("flow-media").getPublicUrl(path);

      setPendingAttachment({
        url: publicUrl,
        name: file.name,
        type,
        size: file.size,
      });

      toast.success("File uploaded and attached successfully.");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="relative border-t border-slate-800 bg-slate-900 p-3 select-none">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file, "document");
          e.target.value = "";
        }}
      />
      <input
        ref={mediaInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,video/mp4,video/3gpp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            const isVideo = file.type.startsWith("video/");
            handleFileUpload(file, isVideo ? "video" : "image");
          }
          e.target.value = "";
        }}
      />

      {/* Autocomplete Popup */}
      {showAutocomplete && filteredQM.length > 0 && (
        <div className="absolute bottom-[calc(100%+8px)] left-3 right-3 z-50 max-h-60 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-2 shadow-2xl backdrop-blur-lg">
          <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Quick Replies
          </div>
          <div className="mt-1 divide-y divide-slate-900">
            {filteredQM.map((qm, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={qm.id}
                  type="button"
                  onClick={() => selectQuickMessage(qm)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                    isSelected
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-slate-350 hover:bg-slate-900 hover:text-white"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm truncate">{qm.title}</span>
                      {qm.shortcut && (
                        <span className={cn(
                          "font-mono text-xs px-1.5 py-0.5 rounded",
                          isSelected ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400"
                        )}>
                          /{qm.shortcut}
                        </span>
                      )}
                    </div>
                    <p className={cn(
                      "text-xs truncate mt-0.5",
                      isSelected ? "text-white/80" : "text-slate-400"
                    )}>
                      {qm.content}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Emoji Picker Popup */}
      {showEmojiPicker && (
        <div className="absolute bottom-[calc(100%+8px)] left-3 z-50 w-72">
          <EmojiPicker
            onSelect={(emoji) => {
              setText((prev) => prev + emoji);
              textareaRef.current?.focus();
            }}
            onClose={() => setShowEmojiPicker(false)}
          />
        </div>
      )}

      {/* Reply details */}
      {replyTo && (
        <div className="mb-2">
          <ReplyQuote
            authorLabel={replyTo.authorLabel}
            preview={replyTo.preview}
            onDismiss={onClearReply}
          />
        </div>
      )}

      {/* Session warning */}
      {sessionExpired && (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-amber-500/10 px-3 py-2">
          <p className="text-xs text-amber-400">
            24-hour session expired. Use a template to re-engage.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-amber-400 hover:text-amber-300"
            onClick={onOpenTemplates}
          >
            <LayoutTemplate className="mr-1 h-3 w-3" />
            Templates
          </Button>
        </div>
      )}

      {/* Uploading indicator */}
      {uploading && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-slate-950/40 border border-slate-800/80 px-3 py-2 text-xs text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>Uploading attachment to storage...</span>
        </div>
      )}

      {/* Pending Attachment Preview */}
      {pendingAttachment && (
        <div className="mb-3">
          <div className="relative inline-flex items-center gap-3 p-3 bg-slate-950/40 rounded-xl border border-slate-800">
            {pendingAttachment.type === "image" && (
              <img
                src={pendingAttachment.url}
                className="h-16 w-16 object-cover rounded-lg border border-slate-850"
                alt="Upload preview"
              />
            )}
            {pendingAttachment.type === "video" && (
              <video
                src={pendingAttachment.url}
                className="h-16 w-16 object-cover rounded-lg border border-slate-850"
              />
            )}
            {pendingAttachment.type === "document" && (
              <div className="flex h-16 w-16 items-center justify-center bg-slate-900 rounded-lg border border-slate-850 text-cyan-400">
                <FileText className="h-7 w-7" />
              </div>
            )}
            <div className="flex flex-col min-w-0 pr-6">
              <span className="text-xs font-semibold text-slate-200 truncate max-w-[180px]">
                {pendingAttachment.name}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5">
                {(pendingAttachment.size / 1024).toFixed(1)} KB • {pendingAttachment.type}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setPendingAttachment(null)}
              className="absolute -top-1.5 -right-1.5 p-1 bg-red-600 rounded-full hover:bg-red-700 text-white shadow transition-transform active:scale-90"
            >
              <X className="size-3" />
            </button>
          </div>
        </div>
      )}

      {/* Composer Input Area */}
      <div className="space-y-3">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={
            readOnly
              ? "Read-only — viewers can browse but not reply"
              : sessionExpired
                ? "Session expired - use a template"
                : "Type a message... (Shift+Enter for new line)"
          }
          disabled={sessionExpired || readOnly}
          rows={1}
          title={readOnly ? "Read-only — your role can't send messages" : undefined}
          className={cn(
            "w-full resize-none rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-primary/50",
            (sessionExpired || readOnly) && "cursor-not-allowed opacity-50"
          )}
        />

        {/* Action Toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {/* Bold */}
            <button
              type="button"
              disabled={sessionExpired || readOnly}
              onClick={() => applyTextFormatting("*")}
              title="Bold (*bold*)"
              className="h-8 w-8 rounded-lg flex items-center justify-center text-[15px] font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
            >
              B
            </button>

            {/* Italic */}
            <button
              type="button"
              disabled={sessionExpired || readOnly}
              onClick={() => applyTextFormatting("_")}
              title="Italic (_italic_)"
              className="h-8 w-8 rounded-lg flex items-center justify-center text-[15px] font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
            >
              /
            </button>

            {/* Strikethrough */}
            <button
              type="button"
              disabled={sessionExpired || readOnly}
              onClick={() => applyTextFormatting("~")}
              title="Strikethrough (~strike~)"
              className="h-8 w-8 rounded-lg flex items-center justify-center text-[15px] font-normal line-through text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
            >
              S
            </button>

            <div className="h-4 w-px bg-slate-800/80 mx-1" />

            {/* Emoji Toggle */}
            <button
              type="button"
              disabled={sessionExpired || readOnly}
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              title="Emojis"
              className={cn(
                "h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:hover:bg-transparent",
                showEmojiPicker && "bg-slate-800 text-slate-200"
              )}
            >
              <Smile className="h-5 w-5" />
            </button>

            {/* Attach Document/File */}
            <button
              type="button"
              disabled={sessionExpired || readOnly || uploading}
              onClick={() => fileInputRef.current?.click()}
              title="Attach File"
              className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <Paperclip className="h-5 w-5" />
            </button>

            {/* Attach Image/Video */}
            <button
              type="button"
              disabled={sessionExpired || readOnly || uploading}
              onClick={() => mediaInputRef.current?.click()}
              title="Attach Photo or Video"
              className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <Image className="h-5 w-5" />
            </button>

            {/* Templates Dialog */}
            <button
              type="button"
              disabled={readOnly}
              onClick={onOpenTemplates}
              title="Templates"
              className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <LayoutTemplate className="h-5 w-5" />
            </button>

            {/* Quick Messages Zap */}
            <button
              type="button"
              disabled={sessionExpired || readOnly}
              onClick={() => {
                setText((prev) => prev + (prev.endsWith("/") ? "" : "/"));
                setShowAutocomplete(true);
                setSearchQuery("");
                setSelectedIndex(0);
                setTimeout(() => textareaRef.current?.focus(), 0);
              }}
              title="Quick Replies"
              className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <Zap className="h-5 w-5" />
            </button>
          </div>

          {/* Send Button */}
          <GatedButton
            size="sm"
            canAct={!readOnly}
            gateReason="send messages"
            disabled={(!text.trim() && !pendingAttachment) || sessionExpired || sending || uploading}
            onClick={handleSend}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-1.5 px-4 h-9 rounded-xl shadow-lg transition-all active:scale-95 duration-200"
          >
            Send
            <Send className="h-3.5 w-3.5" />
          </GatedButton>
        </div>
      </div>
    </div>
  );
}

