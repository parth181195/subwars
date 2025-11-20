import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient | null = null;
  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);

    // Only initialize Supabase client in browser
    if (this.isBrowser) {
      this.supabase = createClient(
        environment.supabase.url,
        environment.supabase.anonKey
      );
    }
  }

  get client(): SupabaseClient | null {
    return this.supabase;
  }

  // Users - Read only
  async getUser(userId: string) {
    if (!this.supabase) {
      throw new Error('Supabase client is not available on the server');
    }
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return data;
  }

  async getUserByGoogleId(googleId: string) {
    if (!this.supabase) {
      throw new Error('Supabase client is not available on the server');
    }
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('google_id', googleId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  // Quizzes - Read only
  async getActiveQuizzes() {
    if (!this.supabase) {
      // Return empty array on server-side
      return [];
    }
    const { data, error } = await this.supabase
      .from('quizzes')
      .select('*')
      .eq('status', 'live')
      .order('scheduled_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }

  async getQuiz(quizId: string) {
    if (!this.supabase) {
      throw new Error('Supabase client is not available on the server');
    }
    const { data, error } = await this.supabase
      .from('quizzes')
      .select('*')
      .eq('id', quizId)
      .single();
    
    if (error) throw error;
    return data;
  }

  // Quiz Questions - Read only
  async getQuizQuestions(quizId: string) {
    if (!this.supabase) {
      // Return empty array on server-side
      return [];
    }
    const { data, error } = await this.supabase
      .from('quiz_questions')
      .select('*')
      .eq('quiz_id', quizId)
      .order('order_index', { ascending: true });
    
    if (error) throw error;
    return data || [];
  }

  async getCurrentQuestion(quizId: string) {
    if (!this.supabase) {
      return null;
    }
    const { data, error } = await this.supabase
      .from('quiz_questions')
      .select('*')
      .eq('quiz_id', quizId)
      .eq('is_active', true)
      .eq('status', 'live')
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  // Answers - Read only (for leaderboard)
  async getQuizAnswers(quizId: string) {
    if (!this.supabase) {
      // Return empty array on server-side
      return [];
    }
    const { data, error } = await this.supabase
      .from('answers')
      .select('*, users(in_game_name, profile_image_url)')
      .eq('quiz_id', quizId)
      .order('submitted_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }

  async getLeaderboard(quizId: string) {
    if (!this.supabase) {
      // Return empty array on server-side
      return [];
    }
    const { data, error } = await this.supabase
      .from('answers')
      .select('*, users(in_game_name, profile_image_url)')
      .eq('quiz_id', quizId)
      .order('score', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }

  // Real-time subscriptions (browser only)
  subscribeToQuiz(quizId: string, callback: (payload: any) => void) {
    if (!this.supabase || !this.isBrowser) {
      return null;
    }
    return this.supabase
      .channel(`quiz-${quizId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quiz_questions',
          filter: `quiz_id=eq.${quizId}`
        },
        callback
      )
      .subscribe();
  }

  subscribeToLeaderboard(quizId: string, callback: (payload: any) => void) {
    if (!this.supabase || !this.isBrowser) {
      return null;
    }
    return this.supabase
      .channel(`leaderboard-${quizId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'answers',
          filter: `quiz_id=eq.${quizId}`
        },
        callback
      )
      .subscribe();
  }

  unsubscribe(channel: any) {
    if (channel && this.supabase) {
      this.supabase.removeChannel(channel);
    }
  }
}

