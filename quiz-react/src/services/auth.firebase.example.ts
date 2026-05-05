/**
 * Example Firebase Auth Service Implementation
 * 
 * This is an example of how to replace Supabase Auth with Firebase Auth.
 * To use this:
 * 1. Rename this file to auth.ts (backup existing first)
 * 2. Install firebase: npm install firebase
 * 3. Update environment configs with Firebase credentials
 * 4. Create firebase.ts config file
 */

import { 
  signInWithPopup, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  getIdToken
} from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';

export interface AuthUser {
  id: string;
  email: string | undefined;
  full_name: string | undefined;
  profile_image_url: string | undefined;
}

class QuizAuthService {
  private currentUser: AuthUser | null = null;
  private listeners: Set<(user: AuthUser | null) => void> = new Set();

  constructor() {
    this.init();
  }

  private async init() {
    // Handle OAuth callback - Firebase handles redirects automatically
    // Check for existing session
    // Note: We don't store the unsubscribe function as it's not needed for cleanup
    onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        this.currentUser = {
          id: firebaseUser.uid,
          email: firebaseUser.email || undefined,
          full_name: firebaseUser.displayName || undefined,
          profile_image_url: firebaseUser.photoURL || undefined,
        };
        
        // Handle redirect after OAuth
        try {
          const redirectDestination = localStorage.getItem('oauth_redirect_destination');
          if (redirectDestination && redirectDestination.startsWith('/')) {
            localStorage.removeItem('oauth_redirect_destination');
            setTimeout(() => {
              window.location.href = redirectDestination;
            }, 100);
          }
        } catch (e) {
          console.warn('Failed to read redirect destination:', e);
        }
      } else {
        this.currentUser = null;
      }
      this.notifyListeners();
    });
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.currentUser));
  }

  subscribe(listener: (user: AuthUser | null) => void) {
    this.listeners.add(listener);
    listener(this.currentUser);
    return () => {
      this.listeners.delete(listener);
    };
  }

  get isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  get user(): AuthUser | null {
    return this.currentUser;
  }

  async signInWithGoogle(): Promise<void> {
    // Store redirect destination if present
    const urlParams = new URLSearchParams(window.location.search);
    const redirectParam = urlParams.get('redirect');
    
    if (redirectParam && redirectParam.startsWith('/')) {
      try {
        localStorage.setItem('oauth_redirect_destination', redirectParam);
      } catch (e) {
        console.warn('Failed to store redirect destination:', e);
      }
    }
    
    try {
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged will be triggered automatically
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in cancelled. Please try again.');
      }
      throw error;
    }
  }

  async signOut(): Promise<void> {
    try {
      await firebaseSignOut(auth);
      this.currentUser = null;
      this.notifyListeners();
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }

  /**
   * Get Firebase ID token for API requests
   * Firebase tokens expire after 1 hour and auto-refresh
   */
  async getIdToken(): Promise<string | null> {
    try {
      const user = auth.currentUser;
      if (!user) {
        return null;
      }
      // getIdToken automatically refreshes if expired
      return await getIdToken(user);
    } catch (error) {
      console.error('Failed to get ID token:', error);
      return null;
    }
  }
}

export const quizAuthService = new QuizAuthService();

