# Admin Account Setup Guide

## Default Admin Accounts

**There are NO default passwords set up.** The system uses Supabase Auth for authentication, which requires users to create accounts first.

### Pre-Authorized Admin Emails

The following emails are automatically authorized for admin access:
- `parthjansari@outlook.com`
- `parthrock181195@gmail.com`

## Setting Up Admin Accounts

### Option 1: Sign Up Through Admin App (Recommended)

1. Navigate to the admin signup page: `http://localhost:4201/signup`
2. Enter one of the authorized emails above
3. Create a password (minimum 6 characters)
4. Confirm the password
5. Click "Sign Up"
6. Check your email for confirmation (if Supabase email confirmation is enabled)
7. Sign in at: `http://localhost:4201/login`

### Option 2: Create Account via Supabase Dashboard

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Navigate to Authentication → Users
3. Click "Add user" → "Create new user"
4. Enter the email (e.g., `parthjansari@outlook.com`)
5. Set a temporary password
6. User will be prompted to change password on first login
7. Sign in at: `http://localhost:4201/login`

### Option 3: Add Admin via Settings Page (After Initial Setup)

Once you have at least one admin logged in:

1. Go to Settings page in the admin dashboard
2. Enter the new admin's email address
3. Click "Add Admin"
4. The user must then sign up or be created via Supabase Dashboard (see Option 2)
5. Once they have a Supabase Auth account, they can sign in

## Important Notes

- **No default passwords exist** - you must create accounts
- **Email must be authorized** - either in the `allowedAdminEmails` list or in the `admin_users` table
- **Supabase Auth account required** - user must have an account in Supabase Auth before they can log in
- **Password requirements** - minimum 6 characters (Supabase default)

## First Time Setup Steps

1. **Create first admin account**:
   - Go to `http://localhost:4201/signup`
   - Use one of the authorized emails: `parthjansari@outlook.com` or `parthrock181195@gmail.com`
   - Create a password (remember it!)
   - Complete signup
   - Sign in with your credentials

2. **Add additional admins** (after first login):
   - Go to Settings page in admin dashboard
   - Add admin emails via the "Add Admin" feature

## Troubleshooting

- **"Access denied" error**: Check if email is in `allowedAdminEmails` or `admin_users` table
- **"User not found" error**: User needs to sign up first via signup page or Supabase Dashboard
- **Can't see text in login form**: Text colors have been fixed - make sure you're using the latest build

## Security

- All admin routes are protected by `adminGuard`
- Only authorized emails can access
- Session is validated on each route change
- Passwords are managed by Supabase Auth (not stored in our database)

