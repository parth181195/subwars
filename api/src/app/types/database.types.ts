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
  is_banned: boolean;
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
  is_banned?: boolean;
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
  is_banned?: boolean;
}

// Quiz types
export interface Quiz {
  id: string;
  name: string;
  description?: string;
  scheduled_at?: string;
  status: QuizStatus;
  created_by?: string;
  allowed_emails?: string[]; // Emails allowed to submit answers (empty/null = all can participate)
  auto_mode_enabled?: boolean; // If true, questions will cycle automatically
  auto_mode_paused?: boolean; // If true, auto mode is paused (will resume when set to false)
  auto_mode_interval_seconds?: number; // Time between question activations in auto mode (default: 120)
  quiz_duration_minutes?: number; // Total quiz duration in minutes (used to calculate interval automatically)
  excluded_from_combined_leaderboard?: boolean; // If true, exclude this quiz's answers from combined leaderboard
  created_at: string;
  updated_at: string;
}

export interface QuizInsert {
  name: string;
  description?: string;
  scheduled_at?: string;
  status?: QuizStatus;
  created_by?: string;
  allowed_emails?: string[];
  auto_mode_enabled?: boolean;
  auto_mode_paused?: boolean;
  auto_mode_interval_seconds?: number;
  quiz_duration_minutes?: number;
  excluded_from_combined_leaderboard?: boolean;
}

export interface QuizUpdate {
  name?: string;
  description?: string;
  scheduled_at?: string;
  status?: QuizStatus;
  created_by?: string;
  allowed_emails?: string[];
  auto_mode_enabled?: boolean;
  auto_mode_paused?: boolean;
  auto_mode_interval_seconds?: number;
  quiz_duration_minutes?: number;
  excluded_from_combined_leaderboard?: boolean;
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
  attempt_count: number; // Number of attempts for this question (max 3)
  submitted_at: string;
  updated_at?: string;
  deleted_at?: string | null;
  excluded_from_combined?: boolean; // If true, exclude from combined leaderboard but keep in quiz-specific leaderboards
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
  attempt_count?: number;
  deleted_at?: string | Date | null;
}

// Answer with joined user data (for leaderboard)
export interface AnswerWithUser extends Answer {
  user_email?: string;
  users?: {
    in_game_name?: string;
    profile_image_url?: string;
    full_name?: string;
  };
}

// Voice Line types
// New structure uses subcollections: heroes/{heroName}/voice_lines
export interface VoiceLine {
  id: string;
  hero_name?: string; // Optional - determined by subcollection path, added for compatibility
  name: string; // Voice line name/title
  url: string; // Voice line URL (bunny_cdn_link, voice_line_link, or audio_url)
  bunny_cdn_link?: string;
  bunny_cdn_path?: string;
  category?: string;
  line_text?: string;
  scraped_at?: string; // Optional in new structure
  created_at?: string;
  updated_at?: string;
}

export interface VoiceLineInsert {
  hero_name?: string; // Optional, since it's determined by subcollection path
  name: string;
  url: string;
  bunny_cdn_link?: string;
  bunny_cdn_path?: string;
  category?: string;
  line_text?: string;
}

export interface VoiceLineUpdate {
  name?: string;
  url?: string;
  bunny_cdn_link?: string;
  bunny_cdn_path?: string;
  category?: string;
  line_text?: string;
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

