import { getFirestoreDB } from './firestore';
import { doc, onSnapshot, DocumentSnapshot } from 'firebase/firestore';

// Unsubscribe is just a function that returns void
type Unsubscribe = () => void;

export interface LeaderboardEntry {
  user_id: string;
  user_name: string;
  total_score: number;
  total_answers: number;
  correct_answers: number;
  average_response_time: number;
}

export interface LeaderboardData {
  quiz_id: string;
  leaderboard: LeaderboardEntry[];
  updated_at: string;
}

export interface Quiz {
  id: string;
  name: string;
  status: 'draft' | 'live' | 'paused' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  question_type: 'voice_line' | 'image';
  question_content: string;
  correct_answer_hero: string;
  order_index: number;
  status: 'pending' | 'live' | 'completed';
  is_active: boolean;
  started_at?: string;
  ended_at?: string;
  time_limit_seconds: number;
}

/**
 * Firestore listener service for real-time updates in admin
 * Replaces Socket.IO for one-way updates (leaderboard, quiz status, question state)
 */
export class FirestoreListenerService {
  private leaderboardUnsubscribes: Map<string, Unsubscribe> = new Map();
  private quizUnsubscribes: Map<string, Unsubscribe> = new Map();
  private questionUnsubscribes: Map<string, Unsubscribe> = new Map();

  /**
   * Listen to leaderboard updates for a quiz
   */
  onLeaderboardUpdate(
    quizId: string,
    callback: (leaderboard: LeaderboardEntry[]) => void
  ): () => void {
    // Unsubscribe from previous listener if exists
    const existing = this.leaderboardUnsubscribes.get(quizId);
    if (existing) {
      existing();
    }

    const db = getFirestoreDB();
    const leaderboardRef = doc(db, 'leaderboards', quizId);
    
    const unsubscribe = onSnapshot(
      leaderboardRef,
      (snapshot: DocumentSnapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as LeaderboardData;
          callback(data.leaderboard || []);
        } else {
          // Document doesn't exist yet, return empty array
          callback([]);
        }
      },
      (error) => {
        // Error handler - log but don't throw to prevent listener from breaking
        // QUIC errors are often transient network issues
        if (error.code !== 'unavailable' && error.code !== 'cancelled') {
          // Only log non-transient errors
        }
        // Return empty array on error to prevent UI breakage
        callback([]);
      }
    );

    this.leaderboardUnsubscribes.set(quizId, unsubscribe);

    // Return unsubscribe function
    return () => {
      unsubscribe();
      this.leaderboardUnsubscribes.delete(quizId);
    };
  }

  /**
   * Listen to quiz status changes
   */
  onQuizStatusChange(
    quizId: string,
    callback: (quiz: Quiz | null) => void
  ): () => void {
    // Unsubscribe from previous listener if exists
    const existing = this.quizUnsubscribes.get(quizId);
    if (existing) {
      existing();
    }

    const db = getFirestoreDB();
    const quizRef = doc(db, 'quizzes', quizId);
    
    const unsubscribe = onSnapshot(
      quizRef,
      (snapshot: DocumentSnapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          callback({
            id: snapshot.id,
            ...data,
          } as Quiz);
        } else {
          callback(null);
        }
      },
      (error) => {
        // Error handler - log but don't throw to prevent listener from breaking
        if (error.code !== 'unavailable' && error.code !== 'cancelled') {
          // Only log non-transient errors
        }
        // Return null on error
        callback(null);
      }
    );

    this.quizUnsubscribes.set(quizId, unsubscribe);

    // Return unsubscribe function
    return () => {
      unsubscribe();
      this.quizUnsubscribes.delete(quizId);
    };
  }

  /**
   * Listen to question state changes
   */
  onQuestionStateChange(
    quizId: string,
    questionId: string,
    callback: (question: QuizQuestion | null) => void
  ): () => void {
    const key = `${quizId}/${questionId}`;
    
    // Unsubscribe from previous listener if exists
    const existing = this.questionUnsubscribes.get(key);
    if (existing) {
      existing();
    }

    const db = getFirestoreDB();
    const questionRef = doc(db, `quizzes/${quizId}/questions`, questionId);
    
    const unsubscribe = onSnapshot(
      questionRef,
      (snapshot: DocumentSnapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          callback({
            id: snapshot.id,
            ...data,
          } as QuizQuestion);
        } else {
          callback(null);
        }
      },
      (error) => {
        // Error handler - log but don't throw to prevent listener from breaking
        if (error.code !== 'unavailable' && error.code !== 'cancelled') {
          // Only log non-transient errors
        }
        // Return null on error
        callback(null);
      }
    );

    this.questionUnsubscribes.set(key, unsubscribe);

    // Return unsubscribe function
    return () => {
      unsubscribe();
      this.questionUnsubscribes.delete(key);
    };
  }

  /**
   * Clean up all listeners
   */
  cleanup() {
    // Unsubscribe from all leaderboard listeners
    this.leaderboardUnsubscribes.forEach((unsubscribe) => {
      unsubscribe();
    });
    this.leaderboardUnsubscribes.clear();

    // Unsubscribe from all quiz listeners
    this.quizUnsubscribes.forEach((unsubscribe) => {
      unsubscribe();
    });
    this.quizUnsubscribes.clear();

    // Unsubscribe from all question listeners
    this.questionUnsubscribes.forEach((unsubscribe) => {
      unsubscribe();
    });
    this.questionUnsubscribes.clear();
  }
}

// Export singleton instance
export const firestoreListenerService = new FirestoreListenerService();

