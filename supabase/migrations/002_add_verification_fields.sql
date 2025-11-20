-- Add Steam profile verification and Dotabuff profile link fields to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS steam_profile_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS dotabuff_profile_link TEXT;

-- Create index for verification status
CREATE INDEX IF NOT EXISTS idx_users_steam_verified ON users(steam_profile_verified);
CREATE INDEX IF NOT EXISTS idx_users_discord_verified ON users(discord_verified);

