-- ============================================================
-- 029_realtime_rls_jwt_claims.sql
--
-- 1. Creates the fcm_tokens table for push notifications.
-- 2. Sets up a trigger to automatically sync profiles.account_id and
--    profiles.account_role into auth.users.raw_user_meta_data.
-- 3. Backfills existing user metadata.
-- 4. Replaces conversations and messages RLS policies with direct JWT claims.
-- ============================================================

-- 1. Create FCM Tokens Table
CREATE TABLE IF NOT EXISTS public.fcm_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_fcm_tokens_account ON public.fcm_tokens(account_id);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user ON public.fcm_tokens(user_id);

-- Enable RLS for FCM Tokens Table
ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

-- Add RLS Policies for FCM Tokens Table
DROP POLICY IF EXISTS fcm_tokens_select ON public.fcm_tokens;
CREATE POLICY fcm_tokens_select ON public.fcm_tokens FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS fcm_tokens_insert ON public.fcm_tokens;
CREATE POLICY fcm_tokens_insert ON public.fcm_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS fcm_tokens_delete ON public.fcm_tokens;
CREATE POLICY fcm_tokens_delete ON public.fcm_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- 2. Create trigger to sync profile account details to auth.users.raw_user_meta_data
CREATE OR REPLACE FUNCTION public.sync_profile_to_user_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
    jsonb_set(
      COALESCE(raw_user_meta_data, '{}'::jsonb),
      '{account_id}',
      to_jsonb(NEW.account_id::text)
    ),
    '{account_role}',
    to_jsonb(NEW.account_role::text)
  )
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.sync_profile_to_user_metadata() OWNER TO postgres;

DROP TRIGGER IF EXISTS sync_profile_to_user_metadata_trigger ON public.profiles;
CREATE TRIGGER sync_profile_to_user_metadata_trigger
  AFTER INSERT OR UPDATE OF account_id, account_role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_to_user_metadata();

-- 3. Backfill existing raw_user_meta_data for all users
DO $$
BEGIN
  UPDATE auth.users u
  SET raw_user_meta_data = jsonb_set(
    jsonb_set(
      COALESCE(u.raw_user_meta_data, '{}'::jsonb),
      '{account_id}',
      to_jsonb(p.account_id::text)
    ),
    '{account_role}',
    to_jsonb(p.account_role::text)
  )
  FROM public.profiles p
  WHERE u.id = p.user_id;
END $$;

-- 4. Rewrite RLS policies for conversations to use direct JWT claims
DROP POLICY IF EXISTS conversations_select ON public.conversations;
CREATE POLICY conversations_select ON public.conversations FOR SELECT
  USING (account_id = (auth.jwt() -> 'user_metadata' ->> 'account_id')::uuid);

DROP POLICY IF EXISTS conversations_insert ON public.conversations;
CREATE POLICY conversations_insert ON public.conversations FOR INSERT
  WITH CHECK (account_id = (auth.jwt() -> 'user_metadata' ->> 'account_id')::uuid AND (auth.jwt() -> 'user_metadata' ->> 'account_role') IN ('owner', 'admin', 'agent'));

DROP POLICY IF EXISTS conversations_update ON public.conversations;
CREATE POLICY conversations_update ON public.conversations FOR UPDATE
  USING (account_id = (auth.jwt() -> 'user_metadata' ->> 'account_id')::uuid AND (auth.jwt() -> 'user_metadata' ->> 'account_role') IN ('owner', 'admin', 'agent'));

DROP POLICY IF EXISTS conversations_delete ON public.conversations;
CREATE POLICY conversations_delete ON public.conversations FOR DELETE
  USING (account_id = (auth.jwt() -> 'user_metadata' ->> 'account_id')::uuid AND (auth.jwt() -> 'user_metadata' ->> 'account_role') IN ('owner', 'admin', 'agent'));

-- 5. Rewrite RLS policies for messages to use direct JWT claims
DROP POLICY IF EXISTS messages_select ON public.messages;
CREATE POLICY messages_select ON public.messages FOR SELECT
  USING (account_id = (auth.jwt() -> 'user_metadata' ->> 'account_id')::uuid);

DROP POLICY IF EXISTS messages_modify ON public.messages;
CREATE POLICY messages_modify ON public.messages FOR ALL
  USING (account_id = (auth.jwt() -> 'user_metadata' ->> 'account_id')::uuid AND (auth.jwt() -> 'user_metadata' ->> 'account_role') IN ('owner', 'admin', 'agent'))
  WITH CHECK (account_id = (auth.jwt() -> 'user_metadata' ->> 'account_id')::uuid AND (auth.jwt() -> 'user_metadata' ->> 'account_role') IN ('owner', 'admin', 'agent'));
