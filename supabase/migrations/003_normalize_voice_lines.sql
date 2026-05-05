-- =====================================================
-- Fully Normalized Voice Lines Table Structure
-- =====================================================
-- Store each voice line as a separate row
-- This allows:
-- - Querying individual voice lines efficiently
-- - Filtering by hero, category, etc.
-- - Better indexing and search performance
-- - Easier updates and maintenance
-- - Better CSV import (many small rows vs few huge rows)
-- =====================================================

-- Drop the old single-row table if it exists (optional)
-- DROP TABLE IF EXISTS voice_lines_json;

-- Create normalized table for individual voice lines
CREATE TABLE IF NOT EXISTS hero_voice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hero_name TEXT NOT NULL,
  hero_url TEXT,
  voice_line_name TEXT NOT NULL,
  voice_line_link TEXT, -- Original wiki link
  bunny_cdn_link TEXT, -- Bunny CDN URL
  bunny_cdn_path TEXT, -- Bunny CDN path
  category TEXT, -- e.g., "Loadout", "Ability", etc.
  metadata JSONB, -- Additional metadata if needed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_hero_voice_lines_hero_name ON hero_voice_lines(hero_name);
CREATE INDEX IF NOT EXISTS idx_hero_voice_lines_category ON hero_voice_lines(category);
CREATE INDEX IF NOT EXISTS idx_hero_voice_lines_voice_line_name ON hero_voice_lines(voice_line_name);
CREATE INDEX IF NOT EXISTS idx_hero_voice_lines_bunny_cdn_path ON hero_voice_lines(bunny_cdn_path);

-- Composite index for common queries (hero + category)
CREATE INDEX IF NOT EXISTS idx_hero_voice_lines_hero_category ON hero_voice_lines(hero_name, category);

-- Full-text search index on voice line name (optional, for search)
CREATE INDEX IF NOT EXISTS idx_hero_voice_lines_name_search ON hero_voice_lines USING gin(to_tsvector('english', voice_line_name));

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_hero_voice_lines_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_hero_voice_lines_updated_at ON hero_voice_lines;
CREATE TRIGGER update_hero_voice_lines_updated_at
  BEFORE UPDATE ON hero_voice_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_hero_voice_lines_updated_at();

-- RLS Policies
ALTER TABLE hero_voice_lines ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for quiz API endpoint)
DROP POLICY IF EXISTS "Public read access for hero voice lines" ON hero_voice_lines;
CREATE POLICY "Public read access for hero voice lines"
  ON hero_voice_lines FOR SELECT
  USING (true);

-- Only backend (service_role) can insert/update/delete
-- No policy needed - backend uses service_role which bypasses RLS

-- Comments
COMMENT ON TABLE hero_voice_lines IS 'Stores individual voice lines, fully normalized (one row per voice line)';
COMMENT ON COLUMN hero_voice_lines.hero_name IS 'Hero name (e.g., "Abaddon", "Axe")';
COMMENT ON COLUMN hero_voice_lines.hero_url IS 'URL to hero wiki page';
COMMENT ON COLUMN hero_voice_lines.voice_line_name IS 'Voice line text/name';
COMMENT ON COLUMN hero_voice_lines.voice_line_link IS 'Original wiki link to voice line audio';
COMMENT ON COLUMN hero_voice_lines.bunny_cdn_link IS 'Bunny CDN URL for voice line audio';
COMMENT ON COLUMN hero_voice_lines.bunny_cdn_path IS 'Bunny CDN path for voice line audio';
COMMENT ON COLUMN hero_voice_lines.category IS 'Voice line category (e.g., "Loadout", "Ability", "Kill")';

