-- Create seo_settings table
CREATE TABLE IF NOT EXISTS seo_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  meta_title TEXT,
  meta_description TEXT,
  meta_keywords TEXT,
  og_title TEXT,
  og_description TEXT,
  og_image_url TEXT,
  twitter_title TEXT,
  twitter_description TEXT,
  custom_header_html TEXT,
  rich_seo_content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT seo_settings_account_id_key UNIQUE (account_id)
);

-- Enable RLS
ALTER TABLE seo_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to prevent conflicts on re-runs
DROP POLICY IF EXISTS seo_settings_select ON seo_settings;
DROP POLICY IF EXISTS seo_settings_insert ON seo_settings;
DROP POLICY IF EXISTS seo_settings_update ON seo_settings;
DROP POLICY IF EXISTS seo_settings_delete ON seo_settings;

-- RLS policies
-- Members can view their account's SEO settings
CREATE POLICY seo_settings_select ON seo_settings FOR SELECT
  USING (true);

-- Admins and owners can insert/update/delete SEO settings
CREATE POLICY seo_settings_insert ON seo_settings FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin'));

CREATE POLICY seo_settings_update ON seo_settings FOR UPDATE
  USING (is_account_member(account_id, 'admin'));

CREATE POLICY seo_settings_delete ON seo_settings FOR DELETE
  USING (is_account_member(account_id, 'admin'));

-- Trigger for updated_at column
DROP TRIGGER IF EXISTS set_updated_at ON seo_settings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON seo_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
