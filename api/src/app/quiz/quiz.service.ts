import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { Quiz, QuizInsert, QuizUpdate, QuizStatus, QuizQuestion, QuizQuestionInsert, QuizQuestionUpdate, QuestionStatus } from '../types/database.types';

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
      .update({ is_active: false })
      .eq('quiz_id', question.quiz_id);

    // Activate the selected question
    return this.updateQuestion(questionId, {
      is_active: true,
      status: QuestionStatus.LIVE,
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

