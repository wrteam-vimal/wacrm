-- Create appearance_settings table
CREATE TABLE IF NOT EXISTS appearance_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'violet',
  custom_color TEXT,
  show_logo BOOLEAN NOT NULL DEFAULT true,
  show_title BOOLEAN NOT NULL DEFAULT true,
  title_text TEXT NOT NULL DEFAULT 'WRTeam Whatsapp CRM',
  logo_url TEXT,
  favicon_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT appearance_settings_account_id_key UNIQUE (account_id)
);

-- Enable RLS
ALTER TABLE appearance_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to prevent conflicts on re-runs
DROP POLICY IF EXISTS appearance_settings_select ON appearance_settings;
DROP POLICY IF EXISTS appearance_settings_insert ON appearance_settings;
DROP POLICY IF EXISTS appearance_settings_update ON appearance_settings;
DROP POLICY IF EXISTS appearance_settings_delete ON appearance_settings;

-- RLS policies
-- Members can view their account's appearance settings
CREATE POLICY appearance_settings_select ON appearance_settings FOR SELECT
  USING (true);

-- Admins and owners can insert/update/delete appearance settings
CREATE POLICY appearance_settings_insert ON appearance_settings FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin'));

CREATE POLICY appearance_settings_update ON appearance_settings FOR UPDATE
  USING (is_account_member(account_id, 'admin'));

CREATE POLICY appearance_settings_delete ON appearance_settings FOR DELETE
  USING (is_account_member(account_id, 'admin'));

-- Trigger for updated_at column
DROP TRIGGER IF EXISTS set_updated_at ON appearance_settings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON appearance_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
