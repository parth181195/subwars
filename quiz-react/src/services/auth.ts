import { 
  signInWithPopup, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  getIdToken
} from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';
import { environment } from '../config/environment';

export interface AuthUser {
  id: string;
  email: string | undefined;
  full_name: string | undefined;
  profile_image_url: string | undefined;
}

class QuizAuthService {
  private currentUser: AuthUser | null = null;
  private listeners: Set<(user: AuthUser | null) => void> = new Set();
  private initialized: boolean = false;
  private initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.init();
  }

  private async init(): Promise<void> {
    return new Promise<void>((resolve) => {
      let hasResolved = false;
      
      // Handle OAuth callback - Firebase handles redirects automatically
      // Check for existing session
      // This callback fires immediately if user is already authenticated
      // Note: We don't store the unsubscribe function as it's not needed for cleanup
      onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
        if (firebaseUser) {
          // Check if user is banned before allowing login
          try {
            const token = await getIdToken(auth.currentUser!);
            const response = await fetch(`${environment.apiUrl}/user/${firebaseUser.uid}`, {
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            });
            
            if (response.ok) {
              const userData = await response.json();
              if (userData.is_banned) {
                // User is banned - sign them out and prevent login
                console.warn('User is banned, signing out...');
                await firebaseSignOut(auth);
                this.currentUser = null;
                // Emit custom event for toast notification
                window.dispatchEvent(new CustomEvent('user-banned', {
                  detail: { message: 'Your account has been banned. You cannot access the quiz app.' }
                }));
                return;
              }
            }
          } catch (error) {
            console.warn('Failed to check user ban status:', error);
            // Continue with login if check fails (don't block legitimate users)
          }
          
          this.currentUser = {
            id: firebaseUser.uid,
            email: firebaseUser.email || undefined,
            full_name: firebaseUser.displayName || undefined,
            profile_image_url: firebaseUser.photoURL || undefined,
          };
          
          // Create user in database on login
          try {
            const token = await getIdToken(auth.currentUser!);
            await fetch(`${environment.apiUrl}/user/ensure`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            });
            console.log('[Auth] User record ensured in database');
          } catch (error) {
            console.error('[Auth] Failed to ensure user in database:', error);
            // Don't block login if this fails
          }
          
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

  subscribe(listener: (user: AuthUser | null) => void) {
    this.listeners.add(listener);
    // Always wait for initialization before notifying
    // This ensures we have the correct auth state before rendering routes
    this.initPromise.then(() => {
      listener(this.currentUser);
    });
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
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'auth/popup-closed-by-user') {
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

  /**
   * Get Firebase Auth instance (for compatibility with existing code)
   * @deprecated Use getIdToken() instead
   */
  get supabaseClient(): {
    auth: {
      getSession: () => Promise<{
        data: {
          session: { access_token: string } | null;
        };
      }>;
    };
  } {
    console.warn('supabaseClient is deprecated. This is now using Firebase Auth.');
    return {
      auth: {
        getSession: async () => {
          const token = await this.getIdToken();
          return {
            data: {
              session: token ? { access_token: token } : null
            }
          };
        }
      }
    };
  }
}

export const quizAuthService = new QuizAuthService();

