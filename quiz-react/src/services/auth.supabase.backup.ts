import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../config/environment';

export interface AuthUser {
  id: string;
  email: string | undefined;
  full_name: string | undefined;
  profile_image_url: string | undefined;
  // Add other properties you might need from the user object
}

class QuizAuthService {
  private client: SupabaseClient;
  private currentUser: AuthUser | null = null;
  private listeners: Set<(user: AuthUser | null) => void> = new Set();

  constructor() {
    this.client = createClient(environment.supabase.url, environment.supabase.anonKey);
    this.init();
  }

  private async init() {
    // Handle OAuth callback - Supabase automatically handles hash fragments
    // This extracts the session from the URL hash if present
    const { data: { session: urlSession }, error: urlError } = await this.client.auth.getSession();
    
    if (urlSession && !urlError) {
      // Session extracted from URL hash, user is now authenticated
      const user = urlSession.user;
      this.currentUser = {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name,
        profile_image_url: user.user_metadata?.avatar_url || user.user_metadata?.picture,
      };
      this.notifyListeners();
      
      // Handle redirect after OAuth - check localStorage for stored destination
      try {
        const redirectDestination = localStorage.getItem('oauth_redirect_destination');
        if (redirectDestination && redirectDestination.startsWith('/')) {
          localStorage.removeItem('oauth_redirect_destination');
          // Small delay to ensure state is updated before redirect
          setTimeout(() => {
            window.location.href = redirectDestination;
          }, 100);
        }
      } catch (e) {
        // localStorage might not be available, ignore
        console.warn('Failed to read redirect destination:', e);
      }
      
      // Clean up URL hash after extracting session
      if (window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    } else {
      // Check for existing session
      const { data: { user } } = await this.client.auth.getUser();
      if (user) {
        this.currentUser = {
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.user_metadata?.name,
          profile_image_url: user.user_metadata?.avatar_url || user.user_metadata?.picture,
        };
        this.notifyListeners();
      }
    }

    this.client.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        this.currentUser = {
          id: session.user.id,
          email: session.user.email,
          full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name,
          profile_image_url: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture,
        };
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
    // Always use the current window origin for redirect to ensure it works in production
    // Store redirect destination in localStorage to avoid URL parameter issues with Supabase
    // Use simple root path to avoid Supabase "invalid path" errors
    // Note: Make sure your Supabase Dashboard has the production URL configured
    // in Authentication → URL Configuration → Redirect URLs
    const urlParams = new URLSearchParams(window.location.search);
    const redirectParam = urlParams.get('redirect');
    
    // Store redirect destination in localStorage for use after OAuth callback
    if (redirectParam && redirectParam.startsWith('/')) {
      try {
        localStorage.setItem('oauth_redirect_destination', redirectParam);
      } catch (e) {
        // localStorage might not be available, ignore
        console.warn('Failed to store redirect destination:', e);
      }
    }
    
    // Use simple root path - AppLoader will handle redirect after OAuth completes
    const redirectTo = `${window.location.origin}/`;
    
    const { error } = await this.client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
      },
    });

    if (error) {
      throw error;
    }
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) {
      throw error;
    }
    this.currentUser = null;
    this.notifyListeners();
  }

  get supabaseClient(): SupabaseClient {
    return this.client;
  }
}

export const quizAuthService = new QuizAuthService();

