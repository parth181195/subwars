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
    // Ensure user exists in users table (create if not exists)
    const userExists = await this.ensureUserExists(answerInsert.user_id);
    if (!userExists) {
      // Final verification - check one more time if user exists
      const { data: finalCheck } = await this.supabase
        .from('users')
        .select('id')
        .eq('id', answerInsert.user_id)
        .single();
      
      if (!finalCheck) {
        throw new BadRequestException(`User ${answerInsert.user_id} does not exist and could not be created. Please ensure you are logged in.`);
      }
    }
    
    // Get the question to check correct answer, calculate score, and check if it's reactivated
    const { data: question, error: questionError } = await this.supabase
      .from('quiz_questions')
      .select('correct_answer_hero, started_at, time_limit_seconds, is_active, status')
      .eq('id', answerInsert.question_id)
      .single();

    if (questionError || !question) {
      throw new NotFoundException('Question not found');
    }

    // Check if answer already exists
    const { data: existing } = await this.supabase
      .from('answers')
      .select('*')
      .eq('user_id', answerInsert.user_id)
      .eq('question_id', answerInsert.question_id)
      .single();

    // If answer exists, check if question is reactivated (live again)
    const isQuestionReactivated = question.is_active && question.status === 'live';
    
    if (existing && !isQuestionReactivated) {
      // Answer exists and question is not reactivated - don't allow resubmission
      throw new ConflictException('Answer already submitted for this question');
    }

    // Normalize the answer for comparison (case-insensitive, trim whitespace)
    const userAnswer = answerInsert.answer.trim().toLowerCase();
    const correctAnswer = question.correct_answer_hero.trim().toLowerCase();
    const isCorrect = userAnswer === correctAnswer;

    // Calculate response time if question started_at is provided
    let responseTime: number | undefined;
    if (question.started_at) {
      const startTime = new Date(question.started_at).getTime();
      const submitTime = new Date().getTime();
      responseTime = Math.max(0, submitTime - startTime); // Ensure non-negative
    }

    // Calculate score based on speed and correctness
    // Formula: Faster answers get higher scores
    // Base score: 100 points for correct answer, 0 for incorrect
    // Speed bonus: Additional points based on how fast the answer was submitted
    // Max score: 1000 points (100 base + 900 speed bonus)
    let score = 0;
    if (isCorrect && responseTime !== undefined && question.started_at) {
      const timeLimit = (question.time_limit_seconds || 120) * 1000; // Convert to milliseconds
      const timeElapsed = Math.min(responseTime, timeLimit);
      
      // Calculate score: faster = higher score
      // Score decreases linearly from 1000 (at 0ms) to 100 (at timeLimit)
      const speedRatio = 1 - (timeElapsed / timeLimit);
      const speedBonus = Math.max(0, Math.round(speedRatio * 900)); // Max 900 bonus points
      score = 100 + speedBonus; // Base 100 + speed bonus
    } else if (isCorrect) {
      // If correct but no timing info, give base score
      score = 100;
    }

    let answer: Answer;
    
    if (existing && isQuestionReactivated) {
      // Question was reactivated - update the existing answer
      const { data: updatedAnswer, error: updateError } = await this.supabase
        .from('answers')
        .update({
          answer: answerInsert.answer,
          is_correct: isCorrect,
          response_time: responseTime,
          score: score,
          submitted_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (updateError) {
        throw new BadRequestException(`Failed to update answer: ${updateError.message}`);
      }

      answer = updatedAnswer as Answer;
    } else {
      // Create new answer
      const { data: newAnswer, error: insertError } = await this.supabase
        .from('answers')
        .insert({
          ...answerInsert,
          is_correct: isCorrect,
          response_time: responseTime,
          score: score,
        })
        .select()
        .single();

      if (insertError) {
        throw new BadRequestException(`Failed to submit answer: ${insertError.message}`);
      }

      answer = newAnswer as Answer;
    }

    // Note: WebSocket events are handled in QuizGateway.handleSubmitAnswer()
    // This service only handles data persistence

    return answer;
  }

  /**
   * Ensure user exists in users table
   * If user doesn't exist, create a basic record from auth.users
   * Returns true if user exists or was created successfully, false otherwise
   */
  private async ensureUserExists(authUserId: string): Promise<boolean> {
    // Check if user already exists in users table
    const { data: existingUser, error: checkError } = await this.supabase
      .from('users')
      .select('id')
      .eq('id', authUserId)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking user existence:', checkError);
      return false;
    }

    if (existingUser) {
      return true; // User already exists
    }

    // Get user info from auth.users
    let authUserData: any = null;
    try {
      const { data: authUser, error: authError } = await this.supabase.auth.admin.getUserById(authUserId);
      
      if (!authError && authUser?.user) {
        authUserData = authUser.user;
      }
    } catch (error) {
      console.error('Error fetching auth user:', error);
    }
    
    // Prepare user data for insertion
    const userEmail = authUserData?.email || `user-${authUserId.slice(0, 8)}@temp.com`;
    const userData: any = {
      id: authUserId,
      email: userEmail,
      full_name: authUserData?.user_metadata?.full_name || 
                 authUserData?.user_metadata?.name || 
                 authUserData?.email?.split('@')[0] || 
                 'Quiz Participant',
      registration_status: 'pending',
    };

    // Add optional fields if available
    if (authUserData?.user_metadata?.avatar_url || authUserData?.user_metadata?.picture) {
      userData.profile_image_url = authUserData.user_metadata.avatar_url || authUserData.user_metadata.picture;
    }

    // Check if user with this email already exists (with different ID)
    const { data: existingUserByEmail, error: emailCheckError } = await this.supabase
      .from('users')
      .select('id, email')
      .eq('email', userEmail)
      .maybeSingle();

    if (emailCheckError) {
      console.error('Error checking user by email:', emailCheckError);
    }

    if (existingUserByEmail && existingUserByEmail.id !== authUserId) {
      console.log(`User with email ${userEmail} exists with ID ${existingUserByEmail.id}, but auth user ID is ${authUserId}. Migrating user...`);
      
      // User exists with different ID - migrate to use auth user ID
      // Step 1: Update all answers to use the new user ID
      const { error: updateAnswersError } = await this.supabase
        .from('answers')
        .update({ user_id: authUserId })
        .eq('user_id', existingUserByEmail.id);

      if (updateAnswersError) {
        console.error('Failed to update answers for user migration:', updateAnswersError);
        // If we can't update answers, we can't safely change the user ID
        // Return false and let the error handler deal with it
        return false;
      }

      // Step 2: Delete the old user record
      const { error: deleteError } = await this.supabase
        .from('users')
        .delete()
        .eq('id', existingUserByEmail.id);

      if (deleteError) {
        console.error('Failed to delete old user record:', deleteError);
        return false;
      }

      console.log(`Successfully migrated user from ${existingUserByEmail.id} to ${authUserId}`);
      
      // After migration, verify the user doesn't already exist with the new ID
      const { data: verifyAfterMigration } = await this.supabase
        .from('users')
        .select('id')
        .eq('id', authUserId)
        .maybeSingle();
      
      if (verifyAfterMigration) {
        console.log('User already exists with authUserId after migration - no need to create');
        return true;
      }
    }

    // Now create/update user record with the correct ID
    // Use insert with ON CONFLICT handling via upsert
    const { data: newUser, error: insertError } = await this.supabase
      .from('users')
      .upsert(userData, {
        onConflict: 'id',
        ignoreDuplicates: false, // Update if exists
      })
      .select()
      .single();

    if (insertError) {
      // If it's still a duplicate email error, it means another request created the user
      // between our delete and insert (race condition)
      if (insertError.code === '23505' && insertError.message?.includes('email')) {
        console.log('Duplicate email error after migration - checking if user exists with authUserId');
        // Check if user with authUserId now exists (might have been created by another request)
        const { data: verifyUser } = await this.supabase
          .from('users')
          .select('id')
          .eq('id', authUserId)
          .maybeSingle();
        
        if (verifyUser) {
          console.log('User exists with authUserId after race condition');
          return true;
        }
        
        // If still not found, try to find by email and update its ID
        const { data: userByEmail } = await this.supabase
          .from('users')
          .select('id')
          .eq('email', userEmail)
          .maybeSingle();
        
        if (userByEmail && userByEmail.id !== authUserId) {
          // Try migration again
          console.log('Retrying user migration due to race condition');
          // This is a recursive situation - for now, just return false
          return false;
        }
      }
      
      console.error('Failed to create/update user record:', insertError);
      // Even if insert fails, verify if user exists (might have been created by another request)
      const { data: verifyUser } = await this.supabase
        .from('users')
        .select('id')
        .eq('id', authUserId)
        .maybeSingle();
      return !!verifyUser;
    }

    return !!newUser;
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

