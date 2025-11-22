// Database types for Supabase - replaces all Sequelize models
// These match the database schema in supabase/migrations

// Enums
export enum RegistrationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PAYMENT_PENDING = 'payment_pending',
}

export enum QuizStatus {
  DRAFT = 'draft',
  LIVE = 'live',
  PAUSED = 'paused',
  COMPLETED = 'completed',
}

export enum QuestionStatus {
  PENDING = 'pending',
  LIVE = 'live',
  COMPLETED = 'completed',
}

export enum AdminRole {
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
}

// User types (from user.types.ts but unified here)
export interface User {
  id: string;
  email: string;
  google_id: string;
  full_name: string;
  phone_number?: string;
  in_game_name?: string;
  dota2_friend_id?: string;
  profile_image_url?: string;
  steam_profile_link?: string;
  steam_profile_verified: boolean;
  dotabuff_profile_link?: string;
  rank_and_mmr?: string;
  discord_id?: string;
  discord_verified: boolean;
  proof_of_payment_url?: string;
  upi_id?: string;
  registration_status: RegistrationStatus;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface UserInsert {
  email: string;
  google_id: string;
  full_name: string;
  phone_number?: string;
  in_game_name?: string;
  dota2_friend_id?: string;
  profile_image_url?: string;
  steam_profile_link?: string;
  steam_profile_verified?: boolean;
  dotabuff_profile_link?: string;
  rank_and_mmr?: string;
  discord_id?: string;
  discord_verified?: boolean;
  proof_of_payment_url?: string;
  upi_id?: string;
  registration_status?: RegistrationStatus;
  admin_notes?: string;
}

export interface UserUpdate {
  email?: string;
  google_id?: string;
  full_name?: string;
  phone_number?: string;
  in_game_name?: string;
  dota2_friend_id?: string;
  profile_image_url?: string;
  steam_profile_link?: string;
  steam_profile_verified?: boolean;
  dotabuff_profile_link?: string;
  rank_and_mmr?: string;
  discord_id?: string;
  discord_verified?: boolean;
  proof_of_payment_url?: string;
  upi_id?: string;
  registration_status?: RegistrationStatus;
  admin_notes?: string;
}

// Quiz types
export interface Quiz {
  id: string;
  name: string;
  description?: string;
  scheduled_at?: string;
  status: QuizStatus;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface QuizInsert {
  name: string;
  description?: string;
  scheduled_at?: string;
  status?: QuizStatus;
  created_by?: string;
}

export interface QuizUpdate {
  name?: string;
  description?: string;
  scheduled_at?: string;
  status?: QuizStatus;
  created_by?: string;
}

// Question types
export enum QuestionType {
  VOICE_LINE = 'voice_line',
  IMAGE = 'image',
}

// Quiz Question types
export interface QuizQuestion {
  id: string;
  quiz_id: string;
  question_type: QuestionType;
  question_content: string; // URL or path for voice line or image
  question_content_metadata?: Record<string, any>; // Metadata for the content
  correct_answer_hero: string; // Hero name as the answer
  answer_image_url?: string; // Image shown after question goes live
  time_limit_seconds: number; // Time limit in seconds (default 120)
  order_index: number;
  status: QuestionStatus;
  is_active: boolean;
  started_at?: string; // When question was made live
  ended_at?: string; // When question ended
  created_at: string;
}

export interface QuizQuestionInsert {
  quiz_id: string;
  question_type: QuestionType;
  question_content: string;
  question_content_metadata?: Record<string, any>;
  correct_answer_hero: string;
  answer_image_url?: string;
  time_limit_seconds?: number; // Default 120 if not provided
  order_index: number;
  status?: QuestionStatus;
  is_active?: boolean;
}

export interface QuizQuestionUpdate {
  quiz_id?: string;
  question_type?: QuestionType;
  question_content?: string;
  question_content_metadata?: Record<string, any>;
  correct_answer_hero?: string;
  answer_image_url?: string;
  time_limit_seconds?: number;
  order_index?: number;
  status?: QuestionStatus;
  is_active?: boolean;
  started_at?: string;
  ended_at?: string;
}

// Answer types
export interface Answer {
  id: string;
  user_id: string;
  quiz_id: string;
  question_id: string;
  answer: string; // Hero name answer
  is_correct: boolean;
  response_time?: number; // Milliseconds from question start
  question_started_at?: string; // When the question started (for response time calculation)
  score: number;
  submitted_at: string;
}

export interface AnswerInsert {
  user_id: string;
  quiz_id: string;
  question_id: string;
  answer: string;
  is_correct?: boolean;
  response_time?: number;
  score?: number;
}

export interface AnswerUpdate {
  user_id?: string;
  quiz_id?: string;
  question_id?: string;
  answer?: string;
  is_correct?: boolean;
  response_time?: number;
  score?: number;
}

// Answer with joined user data (for leaderboard)
export interface AnswerWithUser extends Answer {
  users?: {
    in_game_name?: string;
    profile_image_url?: string;
  };
}

// Voice Line types
export interface VoiceLine {
  id: string;
  hero_name: string;
  voice_line_url: string;
  file_name: string;
  metadata?: Record<string, any>;
  scraped_at: string;
}

export interface VoiceLineInsert {
  hero_name: string;
  voice_line_url: string;
  file_name: string;
  metadata?: Record<string, any>;
}

export interface VoiceLineUpdate {
  hero_name?: string;
  voice_line_url?: string;
  file_name?: string;
  metadata?: Record<string, any>;
}

// Admin User types
export interface AdminUser {
  id: string;
  email: string;
  password_hash: string;
  role: AdminRole;
  created_at: string;
}

export interface AdminUserInsert {
  email: string;
  password_hash: string;
  role?: AdminRole;
}

export interface AdminUserUpdate {
  email?: string;
  password_hash?: string;
  role?: AdminRole;
}

