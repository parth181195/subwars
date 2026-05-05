-- Migration: Add is_banned column to users table
-- Run this to add the is_banned column for user banning functionality

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;

-- Create index for faster queries on banned users
CREATE INDEX IF NOT EXISTS idx_users_is_banned ON users(is_banned);

