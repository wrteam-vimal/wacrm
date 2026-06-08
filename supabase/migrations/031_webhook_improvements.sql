-- ============================================================
-- 031_webhook_improvements.sql
--
-- Improvements to support full Meta Business Webhook spec compliance:
--
-- 1. contacts.wa_id          — canonical WhatsApp ID sent by Meta (stable,
--                              country-code-normalised). Stored alongside
--                              our internal phone field so future identity
--                              lookups can use either.
--
-- 2. conversations.session_expires_at — 24-hour customer-service window
--                              expiry sent by Meta in status payloads'
--                              `conversation.expiration_timestamp`. Drives
--                              the session-expired warning in the inbox.
--
-- 3. messages.error_code     — integer error code from Meta's `errors` array
--                              on `failed` status events (e.g. 131026 =
--                              "Message Undeliverable").
--
-- 4. messages.error_title    — human-readable title from the same errors
--                              array (e.g. "Message Undeliverable").
--
-- 5. messages(message_id) index — makes the idempotency check ("has this
--                              wamid already been processed?") an O(1)
--                              index scan instead of a seq-scan.
-- ============================================================

-- 1. contacts.wa_id — store the canonical WhatsApp ID from Meta
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS wa_id TEXT;

CREATE INDEX IF NOT EXISTS idx_contacts_wa_id
  ON public.contacts(wa_id)
  WHERE wa_id IS NOT NULL;

-- 2. conversations.session_expires_at — 24-hour window tracking
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS session_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_conversations_session_expires
  ON public.conversations(session_expires_at)
  WHERE session_expires_at IS NOT NULL;

-- 3 & 4. messages error capture from failed status events
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS error_code INT,
  ADD COLUMN IF NOT EXISTS error_title TEXT;

-- 5. Fast idempotency lookup by Meta message_id (wamid)
-- message_id may already have a unique constraint from migration 009;
-- this index covers the case where only a btree index (not a unique
-- constraint) exists, and is a no-op if it's already unique-indexed.
CREATE INDEX IF NOT EXISTS idx_messages_message_id
  ON public.messages(message_id)
  WHERE message_id IS NOT NULL;
