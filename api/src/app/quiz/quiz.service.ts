import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { Quiz, QuizInsert, QuizUpdate, QuizStatus, QuizQuestion, QuizQuestionInsert, QuizQuestionUpdate, QuestionStatus, QuestionType, Answer } from '../types/database.types';

@Injectable()
export class QuizService {
  constructor(
    @Inject('SUPABASE_ADMIN_CLIENT')
    private supabase: SupabaseClient,
  ) {}

  async createQuiz(quizInsert: QuizInsert): Promise<Quiz> {
    const { data: quiz, error } = await this.supabase
      .from('quizzes')
      .insert({
        ...quizInsert,
        status: quizInsert.status || QuizStatus.DRAFT,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Failed to create quiz: ${error.message}`);
    }

    return quiz as Quiz;
  }

  async getQuizById(id: string): Promise<Quiz> {
    const { data: quiz, error } = await this.supabase
      .from('quizzes')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !quiz) {
      throw new NotFoundException(`Quiz with ID ${id} not found`);
    }

    return quiz as Quiz;
  }

  async getAllQuizzes(): Promise<Quiz[]> {
    const { data: quizzes, error } = await this.supabase
      .from('quizzes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(`Failed to get quizzes: ${error.message}`);
    }

    return (quizzes || []) as Quiz[];
  }

  async getActiveQuizzes(): Promise<Quiz[]> {
    const { data: quizzes, error } = await this.supabase
      .from('quizzes')
      .select('*')
      .eq('status', QuizStatus.LIVE)
      .order('scheduled_at', { ascending: false });

    if (error) {
      throw new BadRequestException(`Failed to get active quizzes: ${error.message}`);
    }

    return (quizzes || []) as Quiz[];
  }

  async updateQuiz(id: string, quizUpdate: QuizUpdate): Promise<Quiz> {
    const { data: quiz, error } = await this.supabase
      .from('quizzes')
      .update(quizUpdate)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Failed to update quiz: ${error.message}`);
    }

    return quiz as Quiz;
  }

  async deleteQuiz(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('quizzes')
      .delete()
      .eq('id', id);

    if (error) {
      throw new BadRequestException(`Failed to delete quiz: ${error.message}`);
    }
  }

  // Quiz Questions
  async createQuestion(questionInsert: QuizQuestionInsert): Promise<QuizQuestion> {
    const { data: question, error } = await this.supabase
      .from('quiz_questions')
      .insert({
        ...questionInsert,
        status: questionInsert.status || QuestionStatus.PENDING,
        is_active: questionInsert.is_active || false,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Failed to create question: ${error.message}`);
    }

    return question as QuizQuestion;
  }

  async getQuestionById(id: string): Promise<QuizQuestion> {
    const { data: question, error } = await this.supabase
      .from('quiz_questions')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !question) {
      throw new NotFoundException(`Question with ID ${id} not found`);
    }

    return question as QuizQuestion;
  }

  async getQuestionsByQuizId(quizId: string): Promise<QuizQuestion[]> {
    const { data: questions, error } = await this.supabase
      .from('quiz_questions')
      .select('*')
      .eq('quiz_id', quizId)
      .order('order_index', { ascending: true });

    if (error) {
      throw new BadRequestException(`Failed to get questions: ${error.message}`);
    }

    return (questions || []) as QuizQuestion[];
  }

  async getCurrentActiveQuestion(quizId: string): Promise<QuizQuestion | null> {
    const { data: question } = await this.supabase
      .from('quiz_questions')
      .select('*')
      .eq('quiz_id', quizId)
      .eq('is_active', true)
      .eq('status', QuestionStatus.LIVE)
      .single();

    return question as QuizQuestion | null;
  }

  async updateQuestion(id: string, questionUpdate: QuizQuestionUpdate): Promise<QuizQuestion> {
    const { data: question, error } = await this.supabase
      .from('quiz_questions')
      .update(questionUpdate)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Failed to update question: ${error.message}`);
    }

    return question as QuizQuestion;
  }

  async activateQuestion(questionId: string): Promise<QuizQuestion> {
    // First, deactivate all other questions in the same quiz
    const question = await this.getQuestionById(questionId);
    
    // Deactivate all questions in the quiz
    await this.supabase
      .from('quiz_questions')
      .update({ 
        is_active: false,
        status: QuestionStatus.PENDING,
        ended_at: new Date().toISOString(),
      })
      .eq('quiz_id', question.quiz_id)
      .neq('id', questionId);

    // Activate the selected question with start time
    const startedAt = new Date().toISOString();
    return this.updateQuestion(questionId, {
      is_active: true,
      status: QuestionStatus.LIVE,
      started_at: startedAt,
      ended_at: null, // Will be set when question ends
    });
  }

  async endQuestion(questionId: string): Promise<QuizQuestion> {
    const question = await this.getQuestionById(questionId);
    const endedAt = new Date().toISOString();
    
    return this.updateQuestion(questionId, {
      is_active: false,
      status: QuestionStatus.COMPLETED,
      ended_at: endedAt,
    });
  }

  // Get answers for a question
  async getQuestionAnswers(questionId: string): Promise<Answer[]> {
    const { data: answers, error } = await this.supabase
      .from('answers')
      .select('*')
      .eq('question_id', questionId)
      .order('response_time', { ascending: true }); // Fastest first

    if (error) {
      throw new BadRequestException(`Failed to get answers: ${error.message}`);
    }

    return (answers || []) as Answer[];
  }

  // Get leaderboard for a quiz
  async getQuizLeaderboard(quizId: string): Promise<Array<{
    user_id: string;
    user_name: string;
    total_score: number;
    total_answers: number;
    correct_answers: number;
    average_response_time: number;
  }>> {
    const { data: answers, error } = await this.supabase
      .from('answers')
      .select('*, users:user_id(full_name, in_game_name)')
      .eq('quiz_id', quizId);

    if (error) {
      throw new BadRequestException(`Failed to get leaderboard: ${error.message}`);
    }

    // Group by user and calculate stats
    const userStats = new Map<string, {
      user_id: string;
      user_name: string;
      total_score: number;
      total_answers: number;
      correct_answers: number;
      response_times: number[];
    }>();

    (answers || []).forEach((answer: any) => {
      const userId = answer.user_id;
      const userInfo = answer.users || {};
      const userName = userInfo.in_game_name || userInfo.full_name || 'Unknown';

      if (!userStats.has(userId)) {
        userStats.set(userId, {
          user_id: userId,
          user_name: userName,
          total_score: 0,
          total_answers: 0,
          correct_answers: 0,
          response_times: [],
        });
      }

      const stats = userStats.get(userId)!;
      stats.total_score += answer.score || 0;
      stats.total_answers += 1;
      if (answer.is_correct) {
        stats.correct_answers += 1;
      }
      if (answer.response_time) {
        stats.response_times.push(answer.response_time);
      }
    });

    // Convert to array and calculate average response time
    return Array.from(userStats.values()).map(stats => ({
      user_id: stats.user_id,
      user_name: stats.user_name,
      total_score: stats.total_score,
      total_answers: stats.total_answers,
      correct_answers: stats.correct_answers,
      average_response_time: stats.response_times.length > 0
        ? Math.round(stats.response_times.reduce((a, b) => a + b, 0) / stats.response_times.length)
        : 0,
    })).sort((a, b) => {
      // Sort by score (desc), then by average response time (asc)
      if (b.total_score !== a.total_score) {
        return b.total_score - a.total_score;
      }
      return a.average_response_time - b.average_response_time;
    });
  }

  async deleteQuestion(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('quiz_questions')
      .delete()
      .eq('id', id);

    if (error) {
      throw new BadRequestException(`Failed to delete question: ${error.message}`);
    }
  }
}

