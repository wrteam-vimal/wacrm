-- ============================================================
-- 034_contact_country_id.sql
--
-- Adds country_id field referencing public.countries table.
-- ============================================================

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS country_id UUID REFERENCES public.countries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_country_id ON public.contacts(country_id);
