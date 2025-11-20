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
      this.supabase = createClient(
        environment.supabase.url,
        environment.supabase.anonKey
      );

      // Check for existing session
      this.supabase.auth.getSession().then(({ data: { session } }) => {
        this.currentUserSubject.next(session?.user ?? null);
      });

      // Listen for auth changes
      this.supabase.auth.onAuthStateChange((event, session) => {
        this.currentUserSubject.next(session?.user ?? null);
      });
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

