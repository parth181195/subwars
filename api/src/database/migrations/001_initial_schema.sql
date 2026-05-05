-- PostgreSQL Database Schema Migration
-- Run this to create all tables for the quiz system

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (synced from Firebase Auth, stored in PostgreSQL for faster queries)
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY, -- Firebase UID
  email VARCHAR(255) NOT NULL UNIQUE,
  google_id VARCHAR(255),
  full_name VARCHAR(255),
  phone_number VARCHAR(20),
  in_game_name VARCHAR(255),
  dota2_friend_id VARCHAR(255),
  profile_image_url TEXT,
  steam_profile_link TEXT,
  steam_profile_verified BOOLEAN DEFAULT FALSE,
  dotabuff_profile_link TEXT,
  rank_and_mmr VARCHAR(255),
  discord_id VARCHAR(255),
  discord_verified BOOLEAN DEFAULT FALSE,
  proof_of_payment_url TEXT,
  upi_id VARCHAR(255),
  registration_status VARCHAR(50) DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- Quizzes table
CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMP,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  created_by VARCHAR(255),
  allowed_emails TEXT[], -- Array of emails
  auto_mode_enabled BOOLEAN DEFAULT FALSE,
  auto_mode_paused BOOLEAN DEFAULT FALSE,
  auto_mode_interval_seconds INTEGER,
  quiz_duration_minutes INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for quizzes
CREATE INDEX IF NOT EXISTS idx_quizzes_status ON quizzes(status);
CREATE INDEX IF NOT EXISTS idx_quizzes_created_at ON quizzes(created_at DESC);

-- Questions table (was subcollection in Firestore)
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_type VARCHAR(50) NOT NULL,
  question_content TEXT NOT NULL,
  question_content_metadata JSONB,
  correct_answer_hero VARCHAR(255) NOT NULL,
  answer_image_url TEXT,
  time_limit_seconds INTEGER DEFAULT 120,
  order_index INTEGER NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  is_active BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for questions
CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_questions_quiz_id_status ON questions(quiz_id, status);
CREATE INDEX IF NOT EXISTS idx_questions_quiz_id_is_active ON questions(quiz_id, is_active);
CREATE INDEX IF NOT EXISTS idx_questions_quiz_id_order ON questions(quiz_id, order_index);
CREATE INDEX IF NOT EXISTS idx_questions_status_active ON questions(status, is_active) WHERE is_active = TRUE;

-- Answers table
CREATE TABLE IF NOT EXISTS answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer VARCHAR(255) NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  response_time INTEGER, -- Milliseconds
  question_started_at TIMESTAMP,
  score INTEGER DEFAULT 0,
  attempt_count INTEGER DEFAULT 1,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for answers (critical for performance)
CREATE INDEX IF NOT EXISTS idx_answers_user_id ON answers(user_id);
CREATE INDEX IF NOT EXISTS idx_answers_quiz_id ON answers(quiz_id);
CREATE INDEX IF NOT EXISTS idx_answers_question_id ON answers(question_id);
CREATE INDEX IF NOT EXISTS idx_answers_user_question ON answers(user_id, question_id);
CREATE INDEX IF NOT EXISTS idx_answers_quiz_user ON answers(quiz_id, user_id);
CREATE INDEX IF NOT EXISTS idx_answers_question_correct ON answers(question_id, is_correct) WHERE is_correct = TRUE;
CREATE INDEX IF NOT EXISTS idx_answers_submitted_at ON answers(submitted_at DESC);

-- Voice lines table (was subcollection in Firestore)
CREATE TABLE IF NOT EXISTS voice_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hero_name VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  bunny_cdn_link TEXT,
  bunny_cdn_path TEXT,
  category VARCHAR(255),
  line_text TEXT,
  scraped_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for voice lines
CREATE INDEX IF NOT EXISTS idx_voice_lines_hero_name ON voice_lines(hero_name);
CREATE INDEX IF NOT EXISTS idx_voice_lines_scraped_at ON voice_lines(scraped_at DESC);

-- Heroes table (for reference)
CREATE TABLE IF NOT EXISTS heroes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_heroes_name ON heroes(name);

-- Leaderboard config table
CREATE TABLE IF NOT EXISTS leaderboard_config (
  id VARCHAR(255) PRIMARY KEY DEFAULT 'hidden_emails',
  emails TEXT[] DEFAULT ARRAY[]::TEXT[],
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- App config table (prize pool, sponsors, etc.)
CREATE TABLE IF NOT EXISTS app_config (
  id VARCHAR(255) PRIMARY KEY DEFAULT 'main',
  stream_url TEXT,
  prize_pool VARCHAR(255),
  sponsors JSONB DEFAULT '[]'::jsonb, -- Array of {name: string, order: number}
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin users table
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to auto-update updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_quizzes_updated_at ON quizzes;
CREATE TRIGGER update_quizzes_updated_at BEFORE UPDATE ON quizzes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_questions_updated_at ON questions;
CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_voice_lines_updated_at ON voice_lines;
CREATE TRIGGER update_voice_lines_updated_at BEFORE UPDATE ON voice_lines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

