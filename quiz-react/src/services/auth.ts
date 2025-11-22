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
    const { error } = await this.client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
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

