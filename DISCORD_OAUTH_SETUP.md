# Discord OAuth Redirect URI Setup Guide

This guide explains what redirect URIs to add in the Discord Developer Portal OAuth2 screen.

## Current Implementation

**Note:** Currently, we're using **Discord Bot API** (with a bot token) for membership verification, which **does NOT require OAuth redirect URIs**. 

However, if you want to add **Discord OAuth authentication** (where users sign in with Discord), you'll need to set up redirect URIs.

## Two Approaches

### 1. Discord Bot API (Current - No OAuth Needed)

If you're using a **Discord Bot** for verification (what we currently have):
- **You don't need OAuth redirect URIs**
- You only need:
  - Bot Token
  - Guild/Server ID
- The bot checks membership server-side using the Bot API

### 2. Discord OAuth (For User Authentication)

If you want users to **sign in with Discord** (like Google OAuth), you need:

## Discord OAuth Redirect URIs

### Local Development

For local development, add:

```
http://localhost:3000/auth/discord/callback
```

Or if your API runs on a different port:

```
http://localhost:PORT/auth/discord/callback
```

Example:
- API on port 3000: `http://localhost:3000/auth/discord/callback`
- API on port 4200: `http://localhost:4200/auth/discord/callback`

### Production

For production, add your domain:

```
https://yourdomain.com/auth/discord/callback
```

Examples:
- `https://quiz.subwars5.com/auth/discord/callback`
- `https://api.subwars5.com/auth/discord/callback`
- `https://subwars5.com/api/auth/discord/callback`

## How to Add Redirect URIs in Discord Developer Portal

### Step 1: Go to Discord Developer Portal

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application (or create a new one)

### Step 2: Navigate to OAuth2 Settings

1. Click on **"OAuth2"** in the left sidebar
2. Scroll down to **"Redirects"** section

### Step 3: Add Redirect URIs

1. Click **"Add Redirect"**
2. Enter your redirect URI:
   - For local: `http://localhost:3000/auth/discord/callback`
   - For production: `https://yourdomain.com/auth/discord/callback`
3. Click **"Save Changes"**

### Step 4: Required Scopes

If you're using OAuth for authentication, select these **OAuth2 Scopes**:

**For Basic User Info:**
- `identify` - Get user's basic info (username, ID, avatar)
- `email` - Get user's email (optional)

**For Guild Membership Verification:**
- `guilds` - Get list of servers user is in
- `guilds.members.read` - Read guild member info (for membership verification)

**Note:** The `guilds.members.read` scope requires:
- Server/guild verification enabled
- Bot must be in the server
- User must be in the server

### Step 5: Copy OAuth2 Credentials

After setting up, you'll need:

1. **Client ID**: Copy this (visible in OAuth2 page)
2. **Client Secret**: Copy this (click "Reset Secret" if needed)
3. **Redirect URIs**: The ones you just added

## Configuration in Your Application

If you add Discord OAuth, update your `.env`:

```env
# Discord OAuth Configuration (for authentication)
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_CLIENT_SECRET=your_client_secret_here
DISCORD_REDIRECT_URI=http://localhost:3000/auth/discord/callback  # For local dev

# Discord Bot Configuration (for membership verification - already have this)
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_GUILD_ID=your_guild_id_here
DISCORD_INVITE_CODE=qfnfBRU
```

## Common Redirect URI Patterns

### API on Same Domain

```
https://api.subwars5.com/auth/discord/callback
```

### API on Subdomain

```
https://quiz.subwars5.com/api/auth/discord/callback
```

### API Behind Proxy

```
https://subwars5.com/api/auth/discord/callback
```

### Local Development

```
http://localhost:3000/auth/discord/callback
http://127.0.0.1:3000/auth/discord/callback
```

## Important Notes

1. **Exact Match Required**: The redirect URI must match **exactly** (including protocol, port, and path)
2. **HTTP vs HTTPS**: Use `http://` for local development, `https://` for production
3. **Trailing Slash**: Include or exclude trailing slash consistently
4. **Port Numbers**: Include port numbers for local development (localhost:3000)
5. **Multiple URIs**: You can add multiple redirect URIs (one per environment)

## Example Setup

### Development
```
http://localhost:3000/auth/discord/callback
```

### Staging
```
https://staging.subwars5.com/auth/discord/callback
```

### Production
```
https://api.subwars5.com/auth/discord/callback
```

## Troubleshooting

### Error: "Invalid redirect_uri"

- Make sure the redirect URI in your code **exactly matches** one in Discord Developer Portal
- Check for trailing slashes
- Verify protocol (http vs https)
- Check port numbers

### Error: "Invalid client"

- Verify your Client ID and Client Secret are correct
- Make sure you copied the full secret (no spaces)

### Redirect Works But No User Data

- Check that you requested the correct scopes
- Verify the user authorized all required permissions

## Current Status

**Right Now:** We're using Discord Bot API, so **you don't need OAuth redirect URIs** unless you want to add Discord OAuth authentication.

**If Adding Discord OAuth:** Add the redirect URIs as described above.

