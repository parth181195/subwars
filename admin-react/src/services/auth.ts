import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  getIdToken,
} from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { auth } from '../config/firebase';
import { environment } from '../config/environment';

type User = {
  id: string;
  email?: string;
  [key: string]: any;
};

class AdminAuthService {
  private currentUser: User | null = null;
  private isAdmin: boolean = false;
  private listeners: Set<(user: User | null) => void> = new Set();
  private initialized: boolean = false;
  private initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.init();
  }

  private async init(): Promise<void> {
    return new Promise<void>((resolve) => {
      let hasResolved = false;
      
      // Listen for auth state changes
      // This callback fires immediately if user is already authenticated
      // Note: We don't store the unsubscribe function as it's not needed for cleanup
      onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
        if (firebaseUser) {
          this.currentUser = {
            id: firebaseUser.uid,
            email: firebaseUser.email || undefined,
          };
          this.isAdmin = await this.checkAdminAccess(firebaseUser.email || '');
        } else {
          this.currentUser = null;
          this.isAdmin = false;
        }
        
        // Mark as initialized and notify listeners
        if (!this.initialized) {
          this.initialized = true;
        }
        this.notifyListeners();
        
        // Resolve promise only on first callback (initial auth state)
        if (!hasResolved) {
          hasResolved = true;
          resolve();
        }
      });
    });
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.currentUser));
  }

  subscribe(listener: (user: User | null) => void) {
    this.listeners.add(listener);
    // Always wait for initialization before notifying
    // This ensures we have the correct auth state before rendering routes
    this.initPromise.then(() => {
      listener(this.currentUser);
    });
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }
  
  /**
   * Wait for auth initialization to complete
   * Useful for ensuring auth state is loaded before rendering protected routes
   */
  async waitForInit(): Promise<void> {
    await this.initPromise;
  }

  get isAuthenticated(): boolean {
    return this.currentUser !== null && this.isAdmin;
  }

  get user(): User | null {
    return this.currentUser;
  }

  async signInWithEmail(email: string, password: string): Promise<void> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      if (!userCredential.user) {
        throw new Error('Sign in failed. Please try again.');
      }

      // Check admin access
      const hasAccess = await this.checkAdminAccess(userCredential.user.email || '');
      if (!hasAccess) {
        await firebaseSignOut(auth);
        throw new Error('This email is not authorized for admin access.');
      }

      // State will be updated by onAuthStateChanged listener
    } catch (error: any) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        throw new Error('Invalid email or password.');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('Invalid email address.');
      } else if (error.code === 'auth/user-disabled') {
        throw new Error('This account has been disabled.');
      }
      throw error;
    }
  }

  async signUp(email: string, password: string): Promise<void> {
    // Note: Email authorization validation should be done in the component
    // before calling this method (via backend endpoint)
    // This method only creates the Firebase Auth account

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      if (!userCredential.user) {
        throw new Error('Signup failed. Please try again.');
      }

      // Verify admin access after signup (state will be updated by listener)
      // Note: This check happens asynchronously in the auth state listener
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('This email is already registered.');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('Invalid email address.');
      } else if (error.code === 'auth/weak-password') {
        throw new Error('Password should be at least 6 characters.');
      }
      throw error;
    }
  }

  async signOut(): Promise<void> {
    try {
      await firebaseSignOut(auth);
      // State will be updated by onAuthStateChanged listener
    } catch (error) {
      throw error;
    }
  }

  async checkAdminAccess(email: string): Promise<boolean> {
    if (!email) {
      return false;
    }

    // Check against hardcoded allowed emails
    if (environment.allowedAdminEmails.includes(email)) {
      return true;
    }

    // Check against admin_users table via backend API
    // This endpoint is public (no auth required)
    try {
      const response = await fetch(`${environment.apiUrl}/admin/users/validate-signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.authorized === true;
      }

      // If the endpoint fails, fall back to hardcoded emails only
      return false;
    } catch (error) {
      // If admin_users check fails, only allow hardcoded emails
      console.warn('Error checking admin access:', error);
      return false;
    }
  }

  async getIdToken(): Promise<string | null> {
    try {
      const user = auth.currentUser;
      if (!user) {
        return null;
      }
      return await getIdToken(user);
    } catch (error) {
      console.error('Failed to get ID token:', error);
      return null;
    }
  }

  // Compatibility getter for legacy code
  get supabaseClient(): any {
    // Return a compatibility object that provides getIdToken
    return {
      auth: {
        getSession: async () => {
          const token = await this.getIdToken();
          return {
            data: {
              session: token ? { access_token: token } : null,
            },
          };
        },
      },
    };
  }
}

export const adminAuthService = new AdminAuthService();


