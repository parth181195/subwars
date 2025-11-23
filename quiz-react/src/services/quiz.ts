import { environment } from '../config/environment';

const API_BASE_URL = environment.apiUrl;

export interface Quiz {
  id: string;
  name: string;
  description?: string;
  scheduled_at?: string;
  status: 'draft' | 'live' | 'paused' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  question_type: 'voice_line' | 'image';
  question_content: string;
  question_content_metadata?: Record<string, any>;
  question_image_url?: string;
  correct_answer_hero: string;
  answer_image_url?: string;
  time_limit_seconds?: number;
  order_index: number;
  status: 'pending' | 'live' | 'completed';
  is_active: boolean;
  started_at?: string;
  ended_at?: string;
  created_at: string;
}

export interface LeaderboardEntry {
  user_id: string;
  user_name?: string;
  total_score: number;
  total_answers: number;
  correct_answers: number;
  average_response_time: number;
}

export interface AnswerSubmission {
  question_id: string;
  answer: string;
  response_time?: number;
}

class QuizService {
  /**
   * Get all active quizzes
   */
  async getActiveQuizzes(): Promise<Quiz[]> {
    const response = await fetch(`${API_BASE_URL}/admin/quizzes`);
    if (!response.ok) {
      throw new Error(`Failed to fetch quizzes: ${response.statusText}`);
    }
    const quizzes = await response.json();
    // Filter for live quizzes only
    return quizzes.filter((quiz: Quiz) => quiz.status === 'live');
  }

  /**
   * Get a specific quiz by ID (public endpoint)
   */
  async getQuizById(quizId: string): Promise<Quiz> {
    const response = await fetch(`${API_BASE_URL}/admin/quizzes/${quizId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch quiz: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Get all questions for a quiz (public endpoint - sanitized)
   */
  async getQuizQuestions(quizId: string): Promise<QuizQuestion[]> {
    const response = await fetch(`${API_BASE_URL}/quiz/${quizId}/questions`);
    if (!response.ok) {
      throw new Error(`Failed to fetch questions: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Get the current active question for a quiz (public endpoint - sanitized)
   */
  async getCurrentActiveQuestion(quizId: string): Promise<QuizQuestion | null> {
    const response = await fetch(`${API_BASE_URL}/quiz/${quizId}/active-question`);
    if (!response.ok) {
      throw new Error(`Failed to fetch active question: ${response.statusText}`);
    }
    const data = await response.json();
    return data || null;
  }

  /**
   * Submit an answer for a question
   * Note: This will be handled via WebSocket in the Quiz component
   * Keeping this for future REST endpoint if needed
   */
  async submitAnswer(
    quizId: string,
    questionId: string,
    answer: string,
    responseTime?: number,
    userId?: string
  ): Promise<{ is_correct: boolean; score: number; message: string }> {
    // For now, answers are submitted via WebSocket
    // This method is kept for potential REST endpoint in the future
    throw new Error('Answer submission should be done via WebSocket. Use the Quiz component.');
  }

  /**
   * Get top 3 fastest correct answers for a question
   */
  async getTopAnswers(questionId: string): Promise<Array<{
    position: number;
    user_name: string;
    response_time: number;
    score: number;
  }>> {
    const response = await fetch(`${API_BASE_URL}/quiz/questions/${questionId}/top-answers`);
    if (!response.ok) {
      throw new Error(`Failed to fetch top answers: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Get leaderboard for a quiz
   */
  async getQuizLeaderboard(quizId: string): Promise<LeaderboardEntry[]> {
    const response = await fetch(`${API_BASE_URL}/admin/quizzes/${quizId}/leaderboard`);
    if (!response.ok) {
      throw new Error(`Failed to fetch leaderboard: ${response.statusText}`);
    }
    return response.json();
  }
}

export const quizService = new QuizService();

