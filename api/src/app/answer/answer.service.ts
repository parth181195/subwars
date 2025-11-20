import { Injectable, NotFoundException, BadRequestException, ConflictException, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { Answer, AnswerInsert, AnswerUpdate, AnswerWithUser } from '../types/database.types';

@Injectable()
export class AnswerService {
  constructor(
    @Inject('SUPABASE_ADMIN_CLIENT')
    private supabase: SupabaseClient,
  ) {}

  async submitAnswer(answerInsert: AnswerInsert): Promise<Answer> {
    // Check if answer already exists (unique constraint on user_id + question_id)
    const { data: existing } = await this.supabase
      .from('answers')
      .select('*')
      .eq('user_id', answerInsert.user_id)
      .eq('question_id', answerInsert.question_id)
      .single();

    if (existing) {
      throw new ConflictException('Answer already submitted for this question');
    }

    const { data: answer, error } = await this.supabase
      .from('answers')
      .insert({
        ...answerInsert,
        is_correct: answerInsert.is_correct || false,
        score: answerInsert.score || 0,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Failed to submit answer: ${error.message}`);
    }

    return answer as Answer;
  }

  async getAnswerById(id: string): Promise<Answer> {
    const { data: answer, error } = await this.supabase
      .from('answers')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !answer) {
      throw new NotFoundException(`Answer with ID ${id} not found`);
    }

    return answer as Answer;
  }

  async getAnswersByQuizId(quizId: string): Promise<AnswerWithUser[]> {
    const { data: answers, error } = await this.supabase
      .from('answers')
      .select(`
        *,
        users!inner (
          in_game_name,
          profile_image_url
        )
      `)
      .eq('quiz_id', quizId)
      .order('submitted_at', { ascending: false });

    if (error) {
      throw new BadRequestException(`Failed to get answers: ${error.message}`);
    }

    return (answers || []) as AnswerWithUser[];
  }

  async getAnswersByQuestionId(questionId: string): Promise<Answer[]> {
    const { data: answers, error } = await this.supabase
      .from('answers')
      .select('*')
      .eq('question_id', questionId)
      .order('submitted_at', { ascending: false });

    if (error) {
      throw new BadRequestException(`Failed to get answers: ${error.message}`);
    }

    return (answers || []) as Answer[];
  }

  async getAnswersByUserId(userId: string, quizId?: string): Promise<Answer[]> {
    let query = this.supabase
      .from('answers')
      .select('*')
      .eq('user_id', userId)
      .order('submitted_at', { ascending: false });

    if (quizId) {
      query = query.eq('quiz_id', quizId);
    }

    const { data: answers, error } = await query;

    if (error) {
      throw new BadRequestException(`Failed to get answers: ${error.message}`);
    }

    return (answers || []) as Answer[];
  }

  async getLeaderboard(quizId: string): Promise<AnswerWithUser[]> {
    // Get all answers for the quiz with user info
    const { data: answers, error } = await this.supabase
      .from('answers')
      .select(`
        *,
        users!inner (
          in_game_name,
          profile_image_url
        )
      `)
      .eq('quiz_id', quizId)
      .order('submitted_at', { ascending: true });

    if (error) {
      throw new BadRequestException(`Failed to get leaderboard: ${error.message}`);
    }

    if (!answers || answers.length === 0) {
      return [];
    }

    // Aggregate scores by user (sum all scores for each user in the quiz)
    const userScores = new Map<string, { totalScore: number; firstAnswer: AnswerWithUser }>();
    
    answers.forEach((answer: AnswerWithUser) => {
      const userId = answer.user_id;
      if (!userScores.has(userId)) {
        userScores.set(userId, { totalScore: 0, firstAnswer: answer });
      }
      const userData = userScores.get(userId)!;
      userData.totalScore += answer.score || 0;
    });

    // Convert to array and sort by total score (descending), then by earliest submission
    const sortedLeaderboard = Array.from(userScores.values())
      .map((data) => ({
        ...data.firstAnswer,
        score: data.totalScore, // Replace individual score with total score
      }))
      .sort((a, b) => {
        // Sort by score descending
        if ((b.score || 0) !== (a.score || 0)) {
          return (b.score || 0) - (a.score || 0);
        }
        // If scores are equal, sort by earliest submission
        return new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
      });

    return sortedLeaderboard as AnswerWithUser[];
  }

  async updateAnswer(id: string, answerUpdate: AnswerUpdate): Promise<Answer> {
    const { data: answer, error } = await this.supabase
      .from('answers')
      .update(answerUpdate)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Failed to update answer: ${error.message}`);
    }

    return answer as Answer;
  }

  async deleteAnswer(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('answers')
      .delete()
      .eq('id', id);

    if (error) {
      throw new BadRequestException(`Failed to delete answer: ${error.message}`);
    }
  }
}

