# Quick Firebase Setup

## The Error You're Seeing

The error `GET https://identitytoolkit.googleapis.com/v1/projects?key=your-firebase-api-key 400 (Bad Request)` means Firebase is using placeholder credentials.

## Quick Fix: Create .env File

1. **Copy the example file:**
   ```bash
   cd quiz-react
   cp .env.example .env
   ```

2. **Get Firebase credentials:**
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Select or create a project
   - Go to **Project Settings** (gear icon) → **Your apps** → **Web** (or add a web app)
   - Copy the `firebaseConfig` values

3. **Edit `.env` file:**
   ```bash
   # Replace these with your actual Firebase values
   VITE_FIREBASE_API_KEY=AIzaSy...your-actual-key
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456789:web:abc123
   ```

4. **Enable Google Sign-In:**
   - Firebase Console → **Authentication** → **Sign-in method**
   - Enable **Google**
   - Add authorized domains (localhost for dev, your production domain)

5. **Restart dev server:**
   ```bash
   # Stop the current server (Ctrl+C) and restart
   npm run dev
   ```

## Alternative: Use Supabase for Now

If you want to test without Firebase setup:

```bash
cd quiz-react/src/services
mv auth.ts auth.firebase.ts
mv auth.supabase.backup.ts auth.ts
```

Then restart the dev server.

