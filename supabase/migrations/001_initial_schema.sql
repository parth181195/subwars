-- =====================================================
-- Complete Database Schema Migration
-- =====================================================
-- This is the ONLY migration file needed
-- It includes all tables, indexes, RLS policies, and triggers
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- Users Table
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  google_id TEXT UNIQUE,
  full_name TEXT NOT NULL,
  phone_number TEXT,
  in_game_name TEXT,
  dota2_friend_id TEXT,
  profile_image_url TEXT,
  steam_profile_link TEXT,
  steam_profile_verified BOOLEAN DEFAULT FALSE,
  dotabuff_profile_link TEXT,
  rank_and_mmr TEXT,
  discord_id TEXT,
  discord_verified BOOLEAN DEFAULT FALSE,
  proof_of_payment_url TEXT,
  upi_id TEXT,
  registration_status TEXT NOT NULL DEFAULT 'pending' CHECK (registration_status IN ('pending', 'approved', 'rejected', 'payment_pending')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_registration_status ON users(registration_status);
CREATE INDEX IF NOT EXISTS idx_users_steam_verified ON users(steam_profile_verified);
CREATE INDEX IF NOT EXISTS idx_users_discord_verified ON users(discord_verified);

-- =====================================================
-- Quizzes Table
-- =====================================================
-- Note: scheduled_at column is intentionally omitted as quizzes are activated manually
CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'live', 'paused', 'completed')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Remove scheduled_at column if it exists (from old schema)
ALTER TABLE quizzes 
  DROP COLUMN IF EXISTS scheduled_at;

-- Drop index on scheduled_at if it exists
DROP INDEX IF EXISTS idx_quizzes_scheduled_at;

-- Quiz indexes
CREATE INDEX IF NOT EXISTS idx_quizzes_status ON quizzes(status);
CREATE INDEX IF NOT EXISTS idx_quizzes_created_at ON quizzes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quizzes_created_by ON quizzes(created_by);

-- =====================================================
-- Quiz Questions Table
-- =====================================================
-- Supports both voice lines and images as question content
-- Includes timing fields for live quiz questions
-- Only one question can be active at a time per quiz
CREATE TABLE IF NOT EXISTS quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL DEFAULT 'voice_line' CHECK (question_type IN ('voice_line', 'image')),
  question_content TEXT NOT NULL, -- URL or path for voice line or image
  question_content_metadata JSONB, -- Metadata for the content (e.g., hero name, category for voice lines)
  correct_answer_hero TEXT NOT NULL, -- Hero name that is the correct answer
  answer_image_url TEXT, -- Image shown to users after the question goes live
  time_limit_seconds INTEGER NOT NULL DEFAULT 120, -- Time limit in seconds (default 2 minutes)
  order_index INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'live', 'completed')),
  is_active BOOLEAN DEFAULT FALSE, -- Only one question can be active at a time per quiz
  started_at TIMESTAMPTZ, -- When question was made live
  ended_at TIMESTAMPTZ, -- When question ended
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure order_index is unique per quiz
  UNIQUE(quiz_id, order_index)
);

-- =====================================================
-- Update Quiz Questions Table Schema (if old schema exists)
-- =====================================================
-- Drop old columns if they exist (from previous schema)
ALTER TABLE quiz_questions 
  DROP COLUMN IF EXISTS hero_name,
  DROP COLUMN IF EXISTS voice_line_url,
  DROP COLUMN IF EXISTS voice_line_metadata;

-- Add new columns if they don't exist
ALTER TABLE quiz_questions
  ADD COLUMN IF NOT EXISTS question_type TEXT DEFAULT 'voice_line',
  ADD COLUMN IF NOT EXISTS question_content TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS question_content_metadata JSONB,
  ADD COLUMN IF NOT EXISTS correct_answer_hero TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS answer_image_url TEXT,
  ADD COLUMN IF NOT EXISTS time_limit_seconds INTEGER DEFAULT 120,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

-- Update existing rows to have proper values (if columns were just added)
UPDATE quiz_questions
SET 
  question_type = COALESCE(question_type, 'voice_line'),
  question_content = COALESCE(question_content, ''),
  correct_answer_hero = COALESCE(correct_answer_hero, ''),
  time_limit_seconds = COALESCE(time_limit_seconds, 120)
WHERE question_type IS NULL OR question_content IS NULL OR correct_answer_hero IS NULL OR time_limit_seconds IS NULL;

-- Add constraints if they don't exist
DO $$
BEGIN
  -- Add CHECK constraint for question_type if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'quiz_questions_question_type_check'
  ) THEN
    ALTER TABLE quiz_questions 
      ADD CONSTRAINT quiz_questions_question_type_check 
      CHECK (question_type IN ('voice_line', 'image'));
  END IF;
  
  -- Make columns NOT NULL if they aren't already
  ALTER TABLE quiz_questions 
    ALTER COLUMN question_type SET NOT NULL,
    ALTER COLUMN question_content SET NOT NULL,
    ALTER COLUMN correct_answer_hero SET NOT NULL,
    ALTER COLUMN time_limit_seconds SET NOT NULL;
EXCEPTION
  WHEN OTHERS THEN
    -- Ignore errors if constraints already exist or columns are already NOT NULL
    NULL;
END $$;

-- Quiz Questions indexes
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON quiz_questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_status ON quiz_questions(status);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_is_active ON quiz_questions(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_quiz_questions_question_type ON quiz_questions(question_type);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_started_at ON quiz_questions(started_at);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_order ON quiz_questions(quiz_id, order_index);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_correct_answer ON quiz_questions(correct_answer_hero);

-- =====================================================
-- Answers Table
-- =====================================================
-- Stores user answers to quiz questions
-- Scoring: 100 base points + up to 900 speed bonus points
-- Total possible score: 1000 points per question
CREATE TABLE IF NOT EXISTS answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  answer TEXT NOT NULL, -- Hero name that the user answered with
  is_correct BOOLEAN DEFAULT FALSE,
  response_time INTEGER, -- Time taken to answer in milliseconds (from question start)
  score INTEGER DEFAULT 0, -- Calculated score: 100 base + up to 900 speed bonus
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One answer per user per question
  UNIQUE(user_id, question_id)
);

-- Answers indexes
CREATE INDEX IF NOT EXISTS idx_answers_user_id ON answers(user_id);
CREATE INDEX IF NOT EXISTS idx_answers_quiz_id ON answers(quiz_id);
CREATE INDEX IF NOT EXISTS idx_answers_question_id ON answers(question_id);
CREATE INDEX IF NOT EXISTS idx_answers_submitted_at ON answers(submitted_at);
CREATE INDEX IF NOT EXISTS idx_answers_quiz_question ON answers(quiz_id, question_id, submitted_at);
CREATE INDEX IF NOT EXISTS idx_answers_score ON answers(quiz_id, score DESC); -- For leaderboard queries
CREATE INDEX IF NOT EXISTS idx_answers_user_quiz ON answers(user_id, quiz_id, score DESC); -- For user leaderboard

-- =====================================================
-- Voice Lines Table
-- =====================================================
-- Stores scraped voice lines (optional, for reference)
CREATE TABLE IF NOT EXISTS voice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hero_name TEXT NOT NULL,
  voice_line_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  metadata JSONB,
  scraped_at TIMESTAMPTZ DEFAULT NOW()
);

-- Voice Lines indexes
CREATE INDEX IF NOT EXISTS idx_voice_lines_hero_name ON voice_lines(hero_name);

-- =====================================================
-- Admin Users Table
-- =====================================================
-- Stores admin user credentials for backend authentication
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin Users indexes
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);

-- =====================================================
-- Row Level Security (RLS)
-- =====================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS Policies
-- =====================================================

-- Users: Users can read their own data, authenticated users can read profiles
DROP POLICY IF EXISTS "Users can read their own data" ON users;
CREATE POLICY "Users can read their own data"
  ON users FOR SELECT
  USING (auth.uid()::text = id::text);

DROP POLICY IF EXISTS "Anyone authenticated can read user profiles" ON users;
CREATE POLICY "Anyone authenticated can read user profiles"
  ON users FOR SELECT
  USING (auth.role() = 'authenticated');

-- Quizzes: Anyone authenticated can read
DROP POLICY IF EXISTS "Anyone authenticated can read quizzes" ON quizzes;
CREATE POLICY "Anyone authenticated can read quizzes"
  ON quizzes FOR SELECT
  USING (auth.role() = 'authenticated');

-- Quiz Questions: Anyone authenticated can read
DROP POLICY IF EXISTS "Anyone authenticated can read quiz questions" ON quiz_questions;
CREATE POLICY "Anyone authenticated can read quiz questions"
  ON quiz_questions FOR SELECT
  USING (auth.role() = 'authenticated');

-- Answers: Users can read their own, authenticated users can read all for leaderboard
DROP POLICY IF EXISTS "Users can read their own answers" ON answers;
CREATE POLICY "Users can read their own answers"
  ON answers FOR SELECT
  USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Anyone authenticated can read quiz answers for leaderboard" ON answers;
CREATE POLICY "Anyone authenticated can read quiz answers for leaderboard"
  ON answers FOR SELECT
  USING (auth.role() = 'authenticated');

-- Voice Lines: Anyone authenticated can read
DROP POLICY IF EXISTS "Anyone authenticated can read voice lines" ON voice_lines;
CREATE POLICY "Anyone authenticated can read voice lines"
  ON voice_lines FOR SELECT
  USING (auth.role() = 'authenticated');

-- Admin Users: No policies - backend uses service_role key which bypasses RLS
-- Frontend: NO ACCESS - Admin operations only through API backend

-- =====================================================
-- Functions and Triggers
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_quizzes_updated_at ON quizzes;
CREATE TRIGGER update_quizzes_updated_at 
  BEFORE UPDATE ON quizzes
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Table Comments (Documentation)
-- =====================================================

COMMENT ON TABLE users IS 'User accounts with registration and profile information';
COMMENT ON TABLE quizzes IS 'Quiz definitions. Quizzes are activated manually (no scheduled_at field).';
COMMENT ON TABLE quiz_questions IS 'Questions within quizzes. Supports voice lines and images. Only one question can be active at a time per quiz.';
COMMENT ON TABLE answers IS 'User answers to quiz questions. Scoring includes base score (100) + speed bonus (up to 900) = max 1000 points per question.';
COMMENT ON TABLE voice_lines IS 'Scraped voice lines for reference (optional)';
COMMENT ON TABLE admin_users IS 'Admin user accounts for backend authentication';

COMMENT ON COLUMN users.registration_status IS 'Status: pending, approved, rejected, or payment_pending';
COMMENT ON COLUMN users.steam_profile_verified IS 'Whether Steam profile has been verified';
COMMENT ON COLUMN users.discord_verified IS 'Whether Discord account has been verified';

COMMENT ON COLUMN quizzes.name IS 'Name of the quiz';
COMMENT ON COLUMN quizzes.description IS 'Description of the quiz';
COMMENT ON COLUMN quizzes.status IS 'Status: draft, live, paused, or completed';
COMMENT ON COLUMN quizzes.created_by IS 'UUID of the admin user who created the quiz';

COMMENT ON COLUMN quiz_questions.question_type IS 'Type of question: voice_line or image';
COMMENT ON COLUMN quiz_questions.question_content IS 'URL or path to the question content (voice line audio or image)';
COMMENT ON COLUMN quiz_questions.question_content_metadata IS 'Metadata for the content (e.g., hero name, category for voice lines)';
COMMENT ON COLUMN quiz_questions.correct_answer_hero IS 'Hero name that is the correct answer';
COMMENT ON COLUMN quiz_questions.answer_image_url IS 'Image shown to users after the question goes live';
COMMENT ON COLUMN quiz_questions.time_limit_seconds IS 'Time limit in seconds (default 120 = 2 minutes)';
COMMENT ON COLUMN quiz_questions.order_index IS 'Order of the question within the quiz (must be unique per quiz)';
COMMENT ON COLUMN quiz_questions.is_active IS 'Only one question per quiz can be active at a time';
COMMENT ON COLUMN quiz_questions.started_at IS 'Timestamp when question was made live';
COMMENT ON COLUMN quiz_questions.ended_at IS 'Timestamp when question ended';

COMMENT ON COLUMN answers.answer IS 'Hero name that the user answered with';
COMMENT ON COLUMN answers.is_correct IS 'Whether the answer is correct';
COMMENT ON COLUMN answers.response_time IS 'Time taken to answer in milliseconds (relative to question started_at)';
COMMENT ON COLUMN answers.score IS 'Calculated score: 100 base points + up to 900 speed bonus points';
COMMENT ON COLUMN answers.submitted_at IS 'Timestamp when the answer was submitted';

-- =====================================================
-- Migration Complete
-- =====================================================

