-- =====================================================
-- Ensure attempt_count column exists in answers table
-- =====================================================
-- This migration ensures the attempt_count column exists
-- and handles schema cache refresh issues

-- Add attempt_count column if it doesn't exist
DO $$
BEGIN
  -- Check if column exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'answers' 
    AND column_name = 'attempt_count'
  ) THEN
    -- Add the column
    ALTER TABLE answers 
    ADD COLUMN attempt_count INTEGER DEFAULT 1 NOT NULL;
    
    -- Update existing rows to have attempt_count = 1
    UPDATE answers
    SET attempt_count = 1
    WHERE attempt_count IS NULL;
  ELSE
    -- Column exists, but make sure it's NOT NULL if it isn't already
    ALTER TABLE answers 
    ALTER COLUMN attempt_count SET DEFAULT 1;
    
    -- Update any NULL values
    UPDATE answers
    SET attempt_count = 1
    WHERE attempt_count IS NULL;
    
    -- Try to set NOT NULL constraint (may fail if there are NULLs, but that's okay)
    BEGIN
      ALTER TABLE answers 
      ALTER COLUMN attempt_count SET NOT NULL;
    EXCEPTION
      WHEN OTHERS THEN
        -- If setting NOT NULL fails, just ensure DEFAULT is set
        NULL;
    END;
  END IF;
END $$;

-- Ensure default value is set for new rows
ALTER TABLE answers 
  ALTER COLUMN attempt_count SET DEFAULT 1;

-- Add comment for documentation
COMMENT ON COLUMN answers.attempt_count IS 'Number of attempts for this question (max 3, starts at 1)';

