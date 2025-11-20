-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  google_id TEXT UNIQUE,
  full_name TEXT NOT NULL,
  phone_number TEXT,
  in_game_name TEXT,
  dota2_friend_id TEXT,
  profile_image_url TEXT,
  steam_profile_link TEXT,
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

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_registration_status ON users(registration_status);

-- Quizzes Table
CREATE TABLE quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'live', 'paused', 'completed')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quizzes_status ON quizzes(status);
CREATE INDEX idx_quizzes_scheduled_at ON quizzes(scheduled_at);

-- Quiz Questions Table
CREATE TABLE quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  hero_name TEXT NOT NULL,
  voice_line_url TEXT NOT NULL,
  voice_line_metadata JSONB,
  order_index INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'live', 'completed')),
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quiz_questions_quiz_id ON quiz_questions(quiz_id);
CREATE INDEX idx_quiz_questions_status ON quiz_questions(status);

-- Answers Table
CREATE TABLE answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT FALSE,
  response_time INTEGER, -- milliseconds
  score INTEGER DEFAULT 0,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, question_id)
);

CREATE INDEX idx_answers_user_id ON answers(user_id);
CREATE INDEX idx_answers_quiz_id ON answers(quiz_id);
CREATE INDEX idx_answers_question_id ON answers(question_id);
CREATE INDEX idx_answers_submitted_at ON answers(submitted_at);
CREATE INDEX idx_answers_quiz_question ON answers(quiz_id, question_id, submitted_at);

-- Voice Lines Table
CREATE TABLE voice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hero_name TEXT NOT NULL,
  voice_line_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  metadata JSONB,
  scraped_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_voice_lines_hero_name ON voice_lines(hero_name);

-- Admin Users Table
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_admin_users_email ON admin_users(email);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Users
-- Frontend: READ ONLY - All writes go through API backend
CREATE POLICY "Users can read their own data"
  ON users FOR SELECT
  USING (auth.uid()::text = id::text);

CREATE POLICY "Anyone authenticated can read user profiles"
  ON users FOR SELECT
  USING (auth.role() = 'authenticated');

-- RLS Policies for Quizzes
-- Frontend: READ ONLY - All writes go through API backend
CREATE POLICY "Anyone authenticated can read quizzes"
  ON quizzes FOR SELECT
  USING (auth.role() = 'authenticated');

-- RLS Policies for Quiz Questions
-- Frontend: READ ONLY - All writes go through API backend
CREATE POLICY "Anyone authenticated can read quiz questions"
  ON quiz_questions FOR SELECT
  USING (auth.role() = 'authenticated');

-- RLS Policies for Answers
-- Frontend: READ ONLY - All writes go through API backend
CREATE POLICY "Users can read their own answers"
  ON answers FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Anyone authenticated can read quiz answers for leaderboard"
  ON answers FOR SELECT
  USING (auth.role() = 'authenticated');

-- RLS Policies for Voice Lines
-- Frontend: READ ONLY - All writes go through API backend
CREATE POLICY "Anyone authenticated can read voice lines"
  ON voice_lines FOR SELECT
  USING (auth.role() = 'authenticated');

-- RLS Policies for Admin Users
-- Frontend: NO ACCESS - Admin operations only through API backend
-- No policies needed - backend uses service_role key which bypasses RLS

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quizzes_updated_at BEFORE UPDATE ON quizzes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

