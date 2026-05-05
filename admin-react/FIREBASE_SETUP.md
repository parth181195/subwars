# Firebase Deployment & Firestore Setup for Admin App

## Overview

The admin React app has been configured for Firebase deployment and Firestore database connection.

## Files Created/Modified

### 1. Firebase Configuration Files
- `firebase.json` - Firebase hosting configuration
- `.firebaserc` - Firebase project configuration (project: `notes-f8d03`)

### 2. Firestore Service
- `src/services/firestore.ts` - Firestore initialization and utility functions

### 3. Environment Configuration
- `src/config/environment.ts` - Added Firebase config section
- `.env.example` - Template for environment variables

### 4. Package Configuration
- `package.json` - Added Firebase dependencies and deployment scripts

## Setup Instructions

### 1. Create Environment File

Create a `.env` file in the `admin-react` directory with your Firebase credentials:

```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=notes-f8d03.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=notes-f8d03
VITE_FIREBASE_STORAGE_BUCKET=notes-f8d03.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

**How to get Firebase credentials:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (`notes-f8d03`)
3. Go to Project Settings (gear icon) > General tab
4. Scroll down to "Your apps" section
5. Copy the config values (or create a new web app if needed)

### 2. Enable Firestore Database

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to "Firestore Database" in the left sidebar
4. Click "Create database"
5. Choose production or test mode
6. Select a location for your database
7. Click "Enable"

### 3. Deploy to Firebase Hosting

```bash
cd admin-react
npm run deploy
```

Or manually:
```bash
cd admin-react
npm run build
firebase deploy --only hosting
```

## Using Firestore in Your App

### Import the Firestore Service

```typescript
import { getFirestoreDB, collection, getDocs, doc, getDoc } from '../services/firestore';
```

### Example: Read Data from Firestore

```typescript
import { getFirestoreDB, collection, getDocs } from '../services/firestore';

const db = getFirestoreDB();
const querySnapshot = await getDocs(collection(db, 'your-collection'));
querySnapshot.forEach((doc) => {
  console.log(doc.id, ' => ', doc.data());
});
```

### Example: Write Data to Firestore

```typescript
import { getFirestoreDB, collection, addDoc, doc, setDoc } from '../services/firestore';

const db = getFirestoreDB();
// Add a new document
await addDoc(collection(db, 'your-collection'), {
  name: 'Example',
  value: 123
});

// Set a document with ID
await setDoc(doc(db, 'your-collection', 'document-id'), {
  name: 'Example',
  value: 123
});
```

## Available Firestore Functions

The following Firestore functions are exported from `src/services/firestore.ts`:

- `getFirestoreDB()` - Get Firestore database instance
- `collection()` - Create a collection reference
- `doc()` - Create a document reference
- `getDoc()` - Get a single document
- `getDocs()` - Get multiple documents
- `addDoc()` - Add a new document
- `setDoc()` - Set a document (create or update)
- `updateDoc()` - Update a document
- `deleteDoc()` - Delete a document
- `query()` - Create a query
- `where()` - Add a where clause
- `orderBy()` - Add ordering
- `limit()` - Add limit
- `Timestamp` - Firestore timestamp type

## Firestore Security Rules

Make sure to set up proper security rules in Firebase Console:

1. Go to Firestore Database > Rules
2. Configure rules based on your security requirements
3. Example (for development - adjust for production):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Notes

- Firestore is initialized automatically when the app starts (in `main.tsx`)
- The Firebase configuration uses environment variables for security
- Make sure to add `.env` to `.gitignore` to keep credentials secure
- The same Firebase project (`notes-f8d03`) is used as the quiz app

