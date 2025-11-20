# Steam and Discord Verification Setup Guide

This guide explains how to set up Steam profile verification, Discord membership verification, and Dotabuff profile link generation.

## Features Added

1. **Steam Profile Verification**
   - Validates Steam profile URL format
   - Checks if profile is set to PUBLIC
   - Extracts Steam ID64 and converts to Dota 2 Friend ID (Steam ID32)
   - Generates Dotabuff profile link automatically

2. **Discord Membership Verification**
   - Verifies if user is a member of the specified Discord server
   - Uses Discord Bot API to check membership

3. **Dotabuff Profile Link**
   - Automatically generated from Dota 2 Friend ID (Steam ID32)
   - Format: `https://www.dotabuff.com/players/{steam_id32}`

## Setup Instructions

### 1. Database Migration

Run the migration to add new fields to the `users` table:

```sql
-- Run this in your Supabase SQL editor or via migration
-- File: supabase/migrations/002_add_verification_fields.sql
```

Or manually add columns:
```sql
ALTER TABLE users
ADD COLUMN IF NOT EXISTS steam_profile_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS dotabuff_profile_link TEXT;

CREATE INDEX IF NOT EXISTS idx_users_steam_verified ON users(steam_profile_verified);
CREATE INDEX IF NOT EXISTS idx_users_discord_verified ON users(discord_verified);
```

### 2. Discord Bot Setup

#### Step 1: Create a Discord Application and Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Give it a name (e.g., "SubWars 5 Verification Bot")
4. Go to "Bot" section
5. Click "Add Bot"
6. Copy the **Bot Token** (you'll need this)

#### Step 2: Invite Bot to Your Server

1. Go to "OAuth2" → "URL Generator"
2. Select scopes:
   - `bot`
   - `guilds.members.read` (optional, for membership verification)
3. Select bot permissions:
   - `View Channels`
   - `Read Messages/View Channels` (if using members.read)
4. Copy the generated URL and open it in a browser
5. Select your Discord server and authorize

#### Step 3: Get Server (Guild) ID

1. Enable Developer Mode in Discord:
   - Go to User Settings → Advanced → Enable Developer Mode
2. Right-click on your Discord server
3. Click "Copy Server ID"
4. This is your `DISCORD_GUILD_ID`

#### Step 4: Configure Environment Variables

Add to `api/.env`:

```env
# Discord Configuration
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_GUILD_ID=your_guild_id_here
DISCORD_INVITE_CODE=qfnfBRU  # Your Discord invite code (without discord.gg/)
```

### 3. API Endpoints

#### Verify Steam Profile

```http
POST /api/registration/verify/steam
Content-Type: application/json

{
  "steamProfileLink": "https://steamcommunity.com/profiles/76561198000000000"
}
```

Response:
```json
{
  "steamId": "76561198000000000",
  "isPublic": true,
  "dota2FriendId": "86894490",
  "dotabuffProfileUrl": "https://www.dotabuff.com/players/86894490",
  "personaName": "Player Name",
  "avatarUrl": "https://..."
}
```

#### Verify Discord Membership

```http
POST /api/registration/verify/discord
Content-Type: application/json

{
  "discordId": "username#1234" or "123456789012345678"
}
```

Response:
```json
{
  "userId": "123456789012345678",
  "username": "username",
  "isMember": true,
  "joinedAt": "2025-01-01T00:00:00Z",
  "inviteLink": null  // Only if not a member
}
```

### 4. Registration Flow

When a user submits a registration:

1. **Steam Profile Verification** (if provided):
   - Validates URL format
   - Checks if profile is PUBLIC
   - If private: Returns error asking user to make profile public
   - Extracts Steam ID64 and converts to Dota 2 Friend ID
   - Generates Dotabuff profile link

2. **Discord Membership Verification** (if provided):
   - Verifies user is a member of the Discord server
   - If not a member: Returns error with invite link

3. **Registration Creation**:
   - Saves verification status (`steam_profile_verified`, `discord_verified`)
   - Saves Dotabuff profile link
   - Registration status set to `pending` until admin approval

### 5. User Model Fields

New fields added to `users` table:

- `steam_profile_verified` (boolean): Whether Steam profile is public
- `dotabuff_profile_link` (text): Auto-generated Dotabuff profile URL
- `discord_verified` (boolean): Already existed, now automatically set

### 6. Error Messages

Users will see helpful error messages:

- **Steam profile private**: "Steam profile must be set to PUBLIC. Please update your Steam profile privacy settings."
- **Discord not a member**: "You are not a member of the Discord server. Please join: https://discord.gg/qfnfBRU"
- **Invalid Steam URL**: "Invalid Steam profile URL format"

### 7. Steam Profile URL Formats Supported

- `https://steamcommunity.com/profiles/76561198000000000`
- `https://steamcommunity.com/id/username`
- `http://steamcommunity.com/profiles/76561198000000000`

### 8. Notes

- **Steam API**: Uses Steam's public XML profile API. No API key required.
- **Discord API**: Requires a bot token with appropriate permissions.
- **Rate Limiting**: Be aware of rate limits for both APIs in production.
- **Privacy**: Steam profile must be PUBLIC for verification to work.
- **Dotabuff Link**: Automatically generated from Dota 2 Friend ID (Steam ID32).

## Troubleshooting

### Discord Verification Not Working

1. Make sure bot is in the server
2. Check bot token is correct
3. Verify bot has `View Channels` permission
4. Ensure `DISCORD_GUILD_ID` matches your server ID

### Steam Verification Failing

1. Verify Steam profile URL format is correct
2. Ensure Steam profile is set to PUBLIC in privacy settings
3. Check if Steam's API is accessible (may be blocked in some regions)

### Database Migration Issues

If migration fails:
1. Check if columns already exist
2. Manually run SQL commands from migration file
3. Verify user has appropriate database permissions

