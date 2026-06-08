-- ============================================================
-- 030_quick_messages.sql
--
-- Creates the quick_messages table for predefined message templates.
-- Sets up RLS policies using JWT claims.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.quick_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  shortcut TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast retrieval
CREATE INDEX IF NOT EXISTS idx_quick_messages_account ON public.quick_messages(account_id);
CREATE INDEX IF NOT EXISTS idx_quick_messages_shortcut ON public.quick_messages(shortcut);

-- Enable RLS
ALTER TABLE public.quick_messages ENABLE ROW LEVEL SECURITY;

-- Select policy
DROP POLICY IF EXISTS quick_messages_select ON public.quick_messages;
CREATE POLICY quick_messages_select ON public.quick_messages FOR SELECT
  USING (account_id = (auth.jwt() -> 'user_metadata' ->> 'account_id')::uuid);

-- Modify policy (insert, update, delete)
DROP POLICY IF EXISTS quick_messages_modify ON public.quick_messages;
CREATE POLICY quick_messages_modify ON public.quick_messages FOR ALL
  USING (
    account_id = (auth.jwt() -> 'user_metadata' ->> 'account_id')::uuid 
    AND (auth.jwt() -> 'user_metadata' ->> 'account_role') IN ('owner', 'admin', 'agent')
  )
  WITH CHECK (
    account_id = (auth.jwt() -> 'user_metadata' ->> 'account_id')::uuid 
    AND (auth.jwt() -> 'user_metadata' ->> 'account_role') IN ('owner', 'admin', 'agent')
  );
