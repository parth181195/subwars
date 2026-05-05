-- =====================================================
-- Voice Lines JSON Configuration Table
-- =====================================================
-- Stores the complete voice-lines.json file content
-- Uses a single-row approach for simplicity
-- =====================================================

CREATE TABLE IF NOT EXISTS voice_lines_json (
  id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  version TEXT NOT NULL DEFAULT '1.0.0',
  data JSONB NOT NULL, -- The complete voice-lines.json content
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert a default row with empty data (will be updated by script)
-- Using ON CONFLICT to ensure only one row exists
INSERT INTO voice_lines_json (id, version, data)
VALUES ('00000000-0000-0000-0000-000000000000'::uuid, '1.0.0', '{"heroes": []}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Index on JSONB data for faster queries
CREATE INDEX IF NOT EXISTS idx_voice_lines_json_data ON voice_lines_json USING GIN (data);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_voice_lines_json_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_voice_lines_json_updated_at ON voice_lines_json;
CREATE TRIGGER update_voice_lines_json_updated_at
  BEFORE UPDATE ON voice_lines_json
  FOR EACH ROW
  EXECUTE FUNCTION update_voice_lines_json_updated_at();

-- RLS Policies
ALTER TABLE voice_lines_json ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for quiz API endpoint)
DROP POLICY IF EXISTS "Public read access for voice lines JSON" ON voice_lines_json;
CREATE POLICY "Public read access for voice lines JSON"
  ON voice_lines_json FOR SELECT
  USING (true);

-- Only backend (service_role) can update
-- No policy needed - backend uses service_role which bypasses RLS

-- Comments
COMMENT ON TABLE voice_lines_json IS 'Stores the complete voice-lines.json file content for quiz questions';
COMMENT ON COLUMN voice_lines_json.version IS 'Version identifier for the voice lines data';
COMMENT ON COLUMN voice_lines_json.data IS 'Complete JSON structure from voice-lines.json file';

