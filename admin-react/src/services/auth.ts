import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../config/environment';

type User = {
  id: string;
  email?: string;
  [key: string]: any;
};

class AdminAuthService {
  private client: SupabaseClient;
  private currentUser: User | null = null;
  private isAdmin: boolean = false;
  private listeners: Set<(user: User | null) => void> = new Set();

  constructor() {
    this.client = createClient(environment.supabase.url, environment.supabase.anonKey);
    this.init();
  }

  private async init() {
    // Get initial session
    const { data: { session } } = await this.client.auth.getSession();
    if (session?.user) {
      this.currentUser = session.user;
      this.isAdmin = await this.checkAdminAccess(session.user.email || '');
      this.notifyListeners();
    }

    // Listen for auth changes
    this.client.auth.onAuthStateChange(async (_event, session) => {
      this.currentUser = session?.user || null;
      if (this.currentUser) {
        this.isAdmin = await this.checkAdminAccess(this.currentUser.email || '');
      } else {
        this.isAdmin = false;
      }
      this.notifyListeners();
    });
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.currentUser));
  }

  subscribe(listener: (user: User | null) => void) {
    this.listeners.add(listener);
    // Immediately notify with current user
    listener(this.currentUser);
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  get isAuthenticated(): boolean {
    return this.currentUser !== null && this.isAdmin;
  }

  get user(): User | null {
    return this.currentUser;
  }

  async signInWithEmail(email: string, password: string): Promise<void> {
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    if (!data.user) {
      throw new Error('Sign in failed. Please try again.');
    }

    const hasAccess = await this.checkAdminAccess(data.user.email || '');
    if (!hasAccess) {
      await this.client.auth.signOut();
      throw new Error('This email is not authorized for admin access.');
    }

    this.currentUser = data.user;
    this.isAdmin = true;
    this.notifyListeners();
  }

  async signUp(email: string, password: string): Promise<void> {
    // Check if email is authorized (either in environment or database)
    const hasAccess = await this.checkAdminAccess(email);
    if (!hasAccess) {
      throw new Error('This email is not authorized for admin access. Please contact an administrator to invite you.');
    }

    const { data, error } = await this.client.auth.signUp({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    if (!data.user) {
      throw new Error('Signup failed. Please try again.');
    }

    this.currentUser = data.user;
    this.isAdmin = true;
    this.notifyListeners();
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) {
      throw error;
    }
    this.currentUser = null;
    this.isAdmin = false;
    this.notifyListeners();
  }

  async checkAdminAccess(email: string): Promise<boolean> {
    if (!email) {
      return false;
    }

    // Check against hardcoded allowed emails
    if (environment.allowedAdminEmails.includes(email)) {
      return true;
    }

    // Check against admin_users table
    try {
      const { data, error } = await this.client
        .from('admin_users')
        .select('email')
        .eq('email', email)
        .single();

      if (error) {
        // If table doesn't exist or query fails, only allow hardcoded emails
        console.warn('Failed to check admin_users table:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      // If admin_users table doesn't exist yet, only allow hardcoded emails
      console.warn('Error checking admin access:', error);
      return false;
    }
  }

  get supabaseClient(): SupabaseClient {
    return this.client;
  }
}

export const adminAuthService = new AdminAuthService();

