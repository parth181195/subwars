import { io, Socket } from 'socket.io-client';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  question_type: 'voice_line' | 'image';
  question_content: string;
  question_content_metadata?: Record<string, any>;
  correct_answer_hero: string;
  answer_image_url?: string;
  time_limit_seconds: number;
  order_index: number;
  status: 'pending' | 'live' | 'completed';
  is_active: boolean;
  started_at?: string;
  ended_at?: string;
  created_at: string;
}

export interface LeaderboardEntry {
  user_id: string;
  user_name: string;
  total_score: number;
  total_answers: number;
  correct_answers: number;
  average_response_time: number;
}

class QuizSocketService {
  private socket: Socket | null = null;
  private currentQuizId: string | null = null;
  private isConnected: boolean = false;

  connect(quizId: string, userId?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected && this.currentQuizId === quizId) {
        resolve();
        return;
      }

      // Disconnect existing connection if different quiz
      if (this.socket && this.currentQuizId !== quizId) {
        this.disconnect();
      }

      // Create new connection
      this.socket = io(`${API_BASE_URL}/quiz`, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      });

      this.socket.on('connect', () => {
        console.log('[QuizSocket] Connected to server');
        this.isConnected = true;
        
        // Join the quiz room
        this.socket?.emit('join-quiz', { quizId, userId }, (response: any) => {
          if (response?.success) {
            this.currentQuizId = quizId;
            resolve();
          } else {
            reject(new Error(response?.message || 'Failed to join quiz'));
          }
        });
      });

      this.socket.on('connect_error', (error) => {
        console.error('[QuizSocket] Connection error:', error);
        this.isConnected = false;
        reject(error);
      });

      this.socket.on('disconnect', () => {
        console.log('[QuizSocket] Disconnected from server');
        this.isConnected = false;
      });

      // Set timeout for connection
      setTimeout(() => {
        if (!this.isConnected) {
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });
  }

  disconnect(): void {
    if (this.socket) {
      if (this.currentQuizId) {
        this.socket.emit('leave-quiz', { quizId: this.currentQuizId });
      }
      this.socket.disconnect();
      this.socket = null;
      this.currentQuizId = null;
      this.isConnected = false;
      console.log('[QuizSocket] Disconnected');
    }
  }

  // Event listeners
  onQuestionLive(callback: (data: { question: QuizQuestion; timeRemaining: number | null }) => void): void {
    this.socket?.on('question-live', callback);
  }

  onQuestionEnded(callback: (data: { question: QuizQuestion }) => void): void {
    this.socket?.on('question-ended', callback);
  }

  onLeaderboardUpdated(callback: (data: { leaderboard: LeaderboardEntry[] }) => void): void {
    this.socket?.on('leaderboard-updated', callback);
  }

  onAnswerSubmitted(callback: (data: { answer: any; success: boolean }) => void): void {
    this.socket?.on('answer-submitted', callback);
  }

  onAnswerRejected(callback: (data: { message: string }) => void): void {
    this.socket?.on('answer-rejected', callback);
  }

  onError(callback: (data: { message: string }) => void): void {
    this.socket?.on('error', callback);
  }

  onJoinedQuiz(callback: (data: { quizId: string; success: boolean }) => void): void {
    this.socket?.on('joined-quiz', callback);
  }

  // Remove event listeners
  off(event: string, callback?: (...args: any[]) => void): void {
    if (callback) {
      this.socket?.off(event, callback);
    } else {
      this.socket?.off(event);
    }
  }

  // Submit answer
  submitAnswer(quizId: string, questionId: string, answer: string, userId: string): void {
    if (!this.socket || !this.isConnected) {
      console.error('[QuizSocket] Not connected. Cannot submit answer.');
      return;
    }

    this.socket.emit('submit-answer', {
      quizId,
      questionId,
      answer,
      userId,
    });
  }

  // Get current socket state
  getConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  getCurrentQuizId(): string | null {
    return this.currentQuizId;
  }
}

export const quizSocketService = new QuizSocketService();

