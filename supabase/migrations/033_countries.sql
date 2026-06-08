-- ============================================================
-- 033_countries.sql
--
-- Creates the countries table to manage country names and country codes.
-- Sets up RLS policies using JWT claims.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT countries_account_name_key UNIQUE (account_id, name),
  CONSTRAINT countries_account_code_key UNIQUE (account_id, code)
);

-- Index for fast retrieval
CREATE INDEX IF NOT EXISTS idx_countries_account ON public.countries(account_id);

-- Enable RLS
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;

-- Select policy
DROP POLICY IF EXISTS countries_select ON public.countries;
CREATE POLICY countries_select ON public.countries FOR SELECT
  USING (account_id = (auth.jwt() -> 'user_metadata' ->> 'account_id')::uuid);

-- Modify policy (insert, update, delete)
DROP POLICY IF EXISTS countries_modify ON public.countries;
CREATE POLICY countries_modify ON public.countries FOR ALL
  USING (
    account_id = (auth.jwt() -> 'user_metadata' ->> 'account_id')::uuid 
    AND (auth.jwt() -> 'user_metadata' ->> 'account_role') IN ('owner', 'admin', 'agent')
  )
  WITH CHECK (
    account_id = (auth.jwt() -> 'user_metadata' ->> 'account_id')::uuid 
    AND (auth.jwt() -> 'user_metadata' ->> 'account_role') IN ('owner', 'admin', 'agent')
  );
