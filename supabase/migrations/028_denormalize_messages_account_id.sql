-- ============================================================
-- 028_denormalize_messages_account_id.sql
--
-- Denormalizes the account_id column onto the messages table.
-- This allows us to write join-less RLS policies for messages,
-- fixing the Supabase Realtime channel subscription so it receives
-- insert events in real time.
-- ============================================================

-- 1. Add account_id column (initially nullable)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

-- 2. Backfill existing messages with account_id from their parent conversations
UPDATE public.messages m
SET account_id = c.account_id
FROM public.conversations c
WHERE m.conversation_id = c.id
  AND m.account_id IS NULL;

-- 3. Set the account_id column as NOT NULL
ALTER TABLE public.messages
  ALTER COLUMN account_id SET NOT NULL;

-- 4. Create an index on account_id
CREATE INDEX IF NOT EXISTS idx_messages_account ON public.messages(account_id);

-- 5. Re-write the RLS policies to be join-free
DROP POLICY IF EXISTS messages_select ON public.messages;
DROP POLICY IF EXISTS messages_modify ON public.messages;
DROP POLICY IF EXISTS "Users can view own messages" ON public.messages;
DROP POLICY IF EXISTS "Service role can insert messages" ON public.messages;

-- Enable SELECT policy for account members
CREATE POLICY messages_select ON public.messages FOR SELECT
  USING (is_account_member(account_id));

-- Enable general write/management policy for agent+ members
CREATE POLICY messages_modify ON public.messages FOR ALL
  USING (is_account_member(account_id, 'agent'))
  WITH CHECK (is_account_member(account_id, 'agent'));

-- 6. Ensure messages is registered in the supabase_realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;
END $$;
