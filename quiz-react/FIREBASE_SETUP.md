# Firebase Setup Guide

## Quick Setup

The Firebase configuration is currently using placeholder values. You need to set up a Firebase project and add your credentials.

## Option 1: Set Up Firebase (Recommended)

### Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Add project" or select existing project
3. Follow the setup wizard

### Step 2: Get Firebase Config

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll down to "Your apps" section
3. Click the **Web** icon (`</>`) to add a web app
4. Register your app (give it a nickname)
5. Copy the `firebaseConfig` object values

### Step 3: Enable Google Sign-In

1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Click on **Google**
3. Enable it and configure:
   - Support email: your email
   - Authorized domains: Add your production domain and `localhost` for development

### Step 4: Add Environment Variables

Create a `.env` file in `quiz-react/` directory:

```bash
cd quiz-react
touch .env
```

Add your Firebase config:

```bash
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

### Step 5: Restart Dev Server

After creating `.env`, restart your dev server:

```bash
npm run dev
```

## Option 2: Temporarily Use Supabase (Quick Fix)

If you want to test without setting up Firebase right now, you can temporarily revert to Supabase Auth:

1. Rename `src/services/auth.ts` to `src/services/auth.firebase.ts`
2. Rename `src/services/auth.supabase.backup.ts` to `src/services/auth.ts`

This will use the old Supabase Auth until you're ready to set up Firebase.

## Verify Setup

After setting up Firebase credentials:

1. Open browser DevTools → Console
2. Try logging in with Google
3. Check for Firebase-related errors
4. Verify the API key in network requests matches your Firebase project

## Common Issues

### "Bad Request" error
- Check that your Firebase API key is correct
- Ensure Google Sign-In is enabled in Firebase Console
- Verify authorized domains include your current domain

### "Invalid API key"
- Make sure you're using the Web API key (not iOS/Android)
- Check that the key starts with `AIza...`

