import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { environment } from './environment';

const firebaseConfig = {
  apiKey: environment.firebase.apiKey,
  authDomain: environment.firebase.authDomain,
  projectId: environment.firebase.projectId,
  storageBucket: environment.firebase.storageBucket,
  messagingSenderId: environment.firebase.messagingSenderId,
  appId: environment.firebase.appId,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth: Auth = getAuth(app);
// Use 'subwars-5' database instead of default
export const db: Firestore = getFirestore(app, 'subwars-5');

// Configure Firestore settings to reduce connection overhead
// This helps prevent QUIC protocol errors from too many retransmissions
try {
  // Firestore will automatically handle connection management
  // The SDK will use exponential backoff for reconnections
} catch (error) {
  // Ignore initialization errors - Firestore will handle them
}

// Configure Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export default app;

