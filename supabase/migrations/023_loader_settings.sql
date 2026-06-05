-- Migration 023: Add loader settings to appearance_settings
ALTER TABLE appearance_settings 
ADD COLUMN IF NOT EXISTS loader_type TEXT NOT NULL DEFAULT 'shimmer',
ADD COLUMN IF NOT EXISTS loader_image_url TEXT;

