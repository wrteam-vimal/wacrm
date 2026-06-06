-- Add allow_signup to appearance_settings table
ALTER TABLE appearance_settings ADD COLUMN IF NOT EXISTS allow_signup BOOLEAN NOT NULL DEFAULT true;
