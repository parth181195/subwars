import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private supabase: SupabaseClient | null = null;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$: Observable<User | null> = this.currentUserSubject.asObservable();
  private isBrowser: boolean;

  constructor(
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);

    // Only initialize Supabase client in browser
    if (this.isBrowser) {
      try {
        // Create a custom storage adapter that handles lock errors gracefully
        const storageAdapter = {
          getItem: (key: string) => {
            try {
              return window.localStorage.getItem(key);
            } catch (e) {
              return null;
            }
          },
          setItem: (key: string, value: string) => {
            try {
              window.localStorage.setItem(key, value);
            } catch (e) {
              // Silently fail if storage is not available
            }
          },
          removeItem: (key: string) => {
            try {
              window.localStorage.removeItem(key);
            } catch (e) {
              // Silently fail if storage is not available
            }
          },
        };

        this.supabase = createClient(
          environment.supabase.url,
          environment.supabase.anonKey,
          {
            auth: {
              persistSession: true,
              autoRefreshToken: true,
              detectSessionInUrl: true,
              storage: storageAdapter,
              storageKey: 'sb-tfgcmmbrtzntuicfgsau-auth-token',
              flowType: 'pkce'
            },
            global: {
              headers: {
                'X-Client-Info': 'quiz-app'
              }
            }
          }
        );
      } catch (error: any) {
        // Catch and suppress Navigator Lock errors during initialization
        if (error?.name === 'NavigatorLockAcquireTimeoutError' || 
            error?.message?.includes('NavigatorLockAcquireTimeoutError')) {
          // Continue without Supabase client - app will still work but without auth
          console.warn('Supabase client initialization failed due to lock timeout, retrying...');
          // Retry after a delay
          setTimeout(() => {
            if (!this.supabase && this.isBrowser) {
              try {
                this.supabase = createClient(
                  environment.supabase.url,
                  environment.supabase.anonKey,
                  {
                    auth: {
                      persistSession: false, // Disable persistence as fallback
                      autoRefreshToken: false,
                      detectSessionInUrl: true,
                      storage: undefined,
                      flowType: 'pkce'
                    }
                  }
                );
              } catch (retryError) {
                console.error('Failed to initialize Supabase client:', retryError);
              }
            }
          }, 1000);
        } else {
          throw error;
        }
      }

      // Delay session check to avoid lock conflicts during initialization
      setTimeout(() => {
        // Check for existing session with error handling
        if (this.supabase) {
          this.supabase.auth.getSession()
            .then(({ data: { session } }) => {
              this.currentUserSubject.next(session?.user ?? null);
            })
            .catch((error) => {
              // Silently handle Navigator Lock errors - these are non-critical
              if (error?.name === 'NavigatorLockAcquireTimeoutError' || 
                  error?.message?.includes('NavigatorLockAcquireTimeoutError')) {
                // Try to read session from localStorage directly as fallback
                try {
                  const storageKey = 'sb-tfgcmmbrtzntuicfgsau-auth-token';
                  const stored = window.localStorage.getItem(storageKey);
                  if (stored) {
                    const parsed = JSON.parse(stored);
                    if (parsed?.currentSession?.user) {
                      this.currentUserSubject.next(parsed.currentSession.user);
                      return;
                    }
                  }
                } catch (e) {
                  // Ignore localStorage errors
                }
                // Continue without session if lock fails
                this.currentUserSubject.next(null);
              } else {
                console.warn('Error getting session:', error);
                this.currentUserSubject.next(null);
              }
            });
        }
      }, 200); // Increased delay to ensure AuthService initializes first

      // Listen for auth changes with error handling
      if (this.supabase) {
        try {
          this.supabase.auth.onAuthStateChange((event, session) => {
            this.currentUserSubject.next(session?.user ?? null);
          });
        } catch (error: any) {
          // Silently handle any errors in auth state listener
          if (error?.name !== 'NavigatorLockAcquireTimeoutError') {
            console.warn('Error setting up auth state listener:', error);
          }
        }
      }
    }
  }

  get client(): SupabaseClient | null {
    return this.supabase;
  }

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  get isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  async signInWithGoogle(): Promise<void> {
    if (!this.isBrowser || !this.supabase) {
      throw new Error('Authentication is only available in the browser');
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${origin}/home`,
      },
    });

    if (error) {
      throw error;
    }
  }

  async signOut(): Promise<void> {
    if (!this.isBrowser || !this.supabase) {
      return;
    }

    const { error } = await this.supabase.auth.signOut();
    if (error) {
      throw error;
    }
    if (this.isBrowser) {
      this.router.navigate(['/home']);
    }
  }

  async getSession() {
    if (!this.isBrowser || !this.supabase) {
      return null;
    }

    const { data: { session } } = await this.supabase.auth.getSession();
    return session;
  }
}

