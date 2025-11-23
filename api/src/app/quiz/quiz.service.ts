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
    // Get current quiz status before update
    const { data: currentQuiz } = await this.supabase
      .from('quizzes')
      .select('status')
      .eq('id', id)
      .single();

    // If status is being changed to draft, end any live questions
    if (quizUpdate.status === QuizStatus.DRAFT && currentQuiz?.status !== QuizStatus.DRAFT) {
      // Find all live questions for this quiz
      const { data: liveQuestions, error: questionsError } = await this.supabase
        .from('quiz_questions')
        .select('id')
        .eq('quiz_id', id)
        .eq('is_active', true)
        .eq('status', QuestionStatus.LIVE);

      if (!questionsError && liveQuestions && liveQuestions.length > 0) {
        const endedAt = new Date().toISOString();
        // End all live questions
        const { error: endError } = await this.supabase
          .from('quiz_questions')
          .update({
            is_active: false,
            status: QuestionStatus.COMPLETED,
            ended_at: endedAt,
          })
          .in('id', liveQuestions.map(q => q.id));

        if (endError) {
          throw new BadRequestException(`Failed to end live questions: ${endError.message}`);
        }
      }
    }

    const { data: quiz, error } = await this.supabase
      .from('quizzes')
      .update(quizUpdate)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Failed to update quiz: ${error.message}`);
    }

    const updatedQuiz = quiz as Quiz;

    // If quiz is marked as completed, emit top 3 winners announcement
    if (quizUpdate.status === QuizStatus.COMPLETED) {
      // This will be handled by the gateway via the controller
      // We return the quiz so the controller can trigger the announcement
    }

    return updatedQuiz;
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

  async getQuestionById(id: string): Promise<QuizQuestion | null> {
    const { data: question, error } = await this.supabase
      .from('quiz_questions')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !question) {
      return null;
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
    
    if (!question) {
      throw new NotFoundException(`Question with ID ${questionId} not found`);
    }
    
    // Get the quiz to check its status
    const { data: quiz, error: quizError } = await this.supabase
      .from('quizzes')
      .select('status')
      .eq('id', question.quiz_id)
      .single();
    
    if (quizError || !quiz) {
      throw new BadRequestException('Quiz not found');
    }
    
    // Prevent activating questions if quiz is in draft
    if (quiz.status === QuizStatus.DRAFT) {
      throw new BadRequestException('Cannot activate questions while the quiz is in draft status. Please set the quiz to live first.');
    }
    
    const endedAt = new Date().toISOString();
    
    // Get all currently active questions in the quiz
    const { data: activeQuestions } = await this.supabase
      .from('quiz_questions')
      .select('id, status')
      .eq('quiz_id', question.quiz_id)
      .eq('is_active', true)
      .neq('id', questionId);
    
    // Deactivate all active questions in the quiz
    // If they were live, mark as completed; otherwise keep their current status
    if (activeQuestions && activeQuestions.length > 0) {
      for (const activeQuestion of activeQuestions) {
        const updateData: any = {
          is_active: false,
          ended_at: endedAt,
        };
        
        // If the question was live, mark it as completed
        if (activeQuestion.status === QuestionStatus.LIVE) {
          updateData.status = QuestionStatus.COMPLETED;
        }
        // Otherwise, keep the current status (don't change pending to pending)
        
        await this.supabase
          .from('quiz_questions')
          .update(updateData)
          .eq('id', activeQuestion.id);
      }
    }

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
    
    if (!question) {
      throw new NotFoundException(`Question with ID ${questionId} not found`);
    }
    
    const endedAt = new Date().toISOString();
    
    return this.updateQuestion(questionId, {
      is_active: false,
      status: QuestionStatus.COMPLETED,
      ended_at: endedAt,
    });
  }

  /**
   * Check for and automatically end questions that have exceeded their time limit
   * This should be called periodically (e.g., every 5-10 seconds)
   * Returns array of expired question IDs and quiz IDs
   */
  async checkAndEndExpiredQuestions(): Promise<Array<{ id: string; quiz_id: string }>> {
    try {
      // Get all currently live questions
      const { data: liveQuestions, error } = await this.supabase
        .from('quiz_questions')
        .select('id, quiz_id, started_at, time_limit_seconds')
        .eq('is_active', true)
        .eq('status', QuestionStatus.LIVE);

      if (error || !liveQuestions) {
        return [];
      }

      const now = Date.now();
      const expiredQuestions: Array<{ id: string; quiz_id: string }> = [];

      for (const question of liveQuestions) {
        if (!question.started_at || !question.time_limit_seconds) {
          continue;
        }

        const startedAt = new Date(question.started_at).getTime();
        const elapsed = Math.floor((now - startedAt) / 1000); // seconds
        const timeLimit = question.time_limit_seconds;

        if (elapsed >= timeLimit) {
          expiredQuestions.push({ id: question.id, quiz_id: question.quiz_id });
        }
      }

      // End all expired questions and return them for event emission
      if (expiredQuestions.length > 0) {
        const endedAt = new Date().toISOString();
        for (const question of expiredQuestions) {
          await this.updateQuestion(question.id, {
            is_active: false,
            status: QuestionStatus.COMPLETED,
            ended_at: endedAt,
          });
        }
      }

      return expiredQuestions;
    } catch (error) {
      console.error('Error checking for expired questions:', error);
    }
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

