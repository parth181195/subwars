-- =====================================================
-- Normalized Voice Lines Table Structure
-- =====================================================
-- Store each hero as a separate row instead of entire JSON in single row
-- This allows:
-- - Querying individual heroes efficiently
-- - Updating individual heroes without touching entire dataset
-- - Better CSV import (124 rows instead of 1 huge row)
-- - Better indexing and performance
-- - Easier to manage and scale
-- =====================================================

-- Create normalized table for hero voice lines
CREATE TABLE IF NOT EXISTS hero_voice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hero_name TEXT NOT NULL UNIQUE,
  hero_url TEXT,
  voice_lines JSONB NOT NULL, -- Array of voice line objects for this hero
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_hero_voice_lines_hero_name ON hero_voice_lines(hero_name);
CREATE INDEX IF NOT EXISTS idx_hero_voice_lines_voice_lines ON hero_voice_lines USING GIN (voice_lines);

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
COMMENT ON TABLE hero_voice_lines IS 'Stores voice lines for each hero, normalized structure (one row per hero)';
COMMENT ON COLUMN hero_voice_lines.hero_name IS 'Hero name (unique identifier)';
COMMENT ON COLUMN hero_voice_lines.hero_url IS 'URL to hero wiki page';
COMMENT ON COLUMN hero_voice_lines.voice_lines IS 'JSONB array of voice line objects for this hero';
