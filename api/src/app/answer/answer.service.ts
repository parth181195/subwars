import { Injectable, NotFoundException, BadRequestException, ConflictException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Answer, AnswerInsert, AnswerUpdate, AnswerWithUser, QuestionStatus } from '../types/database.types';
import { PostgresService } from '../services/postgres.service';
import { QuizService } from '../quiz/quiz.service';
import { UserService } from '../user/user.service';
import { AnswerModel } from '../models/answer.model';
import { QuestionModel } from '../models/question.model';
import { QuizModel } from '../models/quiz.model';
import { Op } from 'sequelize';

@Injectable()
export class AnswerService {
  constructor(
    private postgres: PostgresService,
    @Inject(forwardRef(() => QuizService))
    private quizService: QuizService,
    private userService: UserService,
    @InjectModel(AnswerModel)
    private answerModel: typeof AnswerModel,
    @InjectModel(QuestionModel)
    private questionModel: typeof QuestionModel,
    @InjectModel(QuizModel)
    private quizModel: typeof QuizModel,
  ) {}

  async submitAnswer(answerInsert: AnswerInsert, userEmail?: string): Promise<Answer> {
    // Parallelize independent operations: question fetch, quiz check, and existing answer check
    // Use direct Sequelize queries for maximum performance
    // Note: User should already exist (created on login), but we verify it exists
    const [userExists, question, quiz, existingAnswer] = await Promise.all([
      // Verify user exists (should already exist from login)
      this.userService.getUserById(answerInsert.user_id).then(u => !!u).catch(() => false),
      // Get the question directly using Sequelize (much faster than PostgresService)
      this.questionModel.findOne({
        where: {
          id: answerInsert.question_id,
          quiz_id: answerInsert.quiz_id,
        },
      }),
      // Get quiz for email restrictions check
      this.quizModel.findByPk(answerInsert.quiz_id),
      // Check if answer already exists using direct Sequelize query (exclude soft-deleted)
      this.answerModel.findOne({
        where: {
          user_id: answerInsert.user_id,
          question_id: answerInsert.question_id,
          deleted_at: { [Op.is]: null }, // Only find non-deleted answers
        },
      }),
    ]);

    // Verify user exists (should already exist from login)
    if (!userExists) {
      throw new BadRequestException(`User ${answerInsert.user_id} does not exist. Please log in first.`);
    }

    if (!quiz) {
      throw new NotFoundException('Contest not found');
    }

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    // Convert Sequelize model to plain object
    const questionData = question.get({ plain: true }) as any;
    
    // Ensure started_at is in ISO string format if it exists
    if (questionData.started_at instanceof Date) {
      questionData.started_at = questionData.started_at.toISOString();
    }

    const existing = existingAnswer ? existingAnswer.get({ plain: true }) as Answer : null;

    // If answer exists, check retry rules
    if (existing) {
      // Rule 1: If already answered correctly, don't allow further attempts
      if (existing.is_correct) {
        throw new ConflictException('You have already answered this question correctly. Further attempts are not allowed.');
      }

      // Rule 2: Check maximum retry limit (3 attempts total)
      const currentAttemptCount = existing.attempt_count || 1;
      if (currentAttemptCount >= 3) {
        throw new ConflictException('Maximum retry limit (3 attempts) reached for this question.');
      }

      // Rule 3: Check if question is currently active (must be live to submit/retry)
      if (!questionData.is_active || questionData.status !== QuestionStatus.LIVE) {
        throw new ConflictException('Question is not currently active. You can only submit answers during active questions.');
      }
    } else {
      // New answer - check if question is active
      if (!questionData.is_active || questionData.status !== QuestionStatus.LIVE) {
        throw new ConflictException('Question is not currently active.');
      }
    }

    // Normalize the answer for comparison (case-insensitive, trim whitespace)
    const userAnswer = answerInsert.answer.trim().toLowerCase();
    const correctAnswer = questionData.correct_answer_hero.trim().toLowerCase();
    const isCorrect = userAnswer === correctAnswer;

    // Calculate response time using SERVER TIME ONLY to prevent client-side time manipulation
    // Always ignore client-provided response_time to prevent cheating
    let responseTime: number | undefined;
    
    if (questionData.started_at) {
      try {
        // Use server time for all calculations - prevents time manipulation attacks
        const startTime = new Date(questionData.started_at).getTime();
        const serverTime = Date.now(); // Server's current time
        
        // Calculate response time based on server time
        responseTime = Math.max(0, serverTime - startTime);
        
        // Validate response time is reasonable
        const timeLimit = (questionData.time_limit_seconds || 120) * 1000;
        
        // If response time is negative or suspiciously large, cap it
        if (responseTime < 0) {
          // Negative time means client manipulated time - set to 0
          responseTime = 0;
        } else if (responseTime > timeLimit * 2) {
          // If response time is more than 2x the limit, something is wrong - cap at time limit
          responseTime = timeLimit;
        }
        
        // Additional validation: if client provided response_time, compare it to server calculation
        // Log suspicious discrepancies for monitoring
        if (answerInsert.response_time !== undefined && answerInsert.response_time !== null) {
          const clientProvidedTime = Math.max(0, answerInsert.response_time);
          const discrepancy = Math.abs(responseTime - clientProvidedTime);
          
          // If discrepancy is more than 5 seconds, log it as suspicious
          if (discrepancy > 5000) {
            console.warn(`[SECURITY] Suspicious response time discrepancy for user ${answerInsert.user_id}, question ${answerInsert.question_id}: client=${clientProvidedTime}ms, server=${responseTime}ms, diff=${discrepancy}ms`);
          }
        }
      } catch (error) {
        // Invalid date, skip response time calculation
        console.error('Error calculating response time:', error);
        responseTime = undefined;
      }
    }

    // Calculate score based on speed and correctness
    // Formula: Faster answers get higher scores
    // Base score: 100 points for correct answer, 0 for incorrect
    // Speed bonus: Additional points based on how fast the answer was submitted
    // Max score: 1000 points (100 base + 900 speed bonus)
    let score = 0;
    if (isCorrect && responseTime !== undefined && questionData.started_at) {
      const timeLimit = (questionData.time_limit_seconds || 120) * 1000; // Convert to milliseconds
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
    
    if (existingAnswer) {
      // Update existing answer (retry attempt) using direct Sequelize
      const newAttemptCount = (existing.attempt_count || 1) + 1;
      
      await existingAnswer.update({
        answer: answerInsert.answer,
        is_correct: isCorrect,
        response_time: responseTime,
        score: score,
        attempt_count: newAttemptCount,
        // Don't update submitted_at - keep original submission time
      } as any);
      
      await existingAnswer.reload();
      answer = existingAnswer.get({ plain: true }) as Answer;
    } else {
      // Create new answer (first attempt) using direct Sequelize
      // submitted_at will be automatically set by @CreatedAt decorator
      const newAnswer = await this.answerModel.create({
        ...answerInsert,
        is_correct: isCorrect,
        response_time: responseTime,
        score: score,
        attempt_count: 1,
      } as any);
      
      answer = newAnswer.get({ plain: true }) as Answer;
    }

    // Note: WebSocket events are handled in QuizGateway.handleSubmitAnswer()
    // This service only handles data persistence

    return answer;
  }


  async getAnswerById(id: string): Promise<Answer> {
      const answer = await this.answerModel.findOne({
        where: {
          id,
          deleted_at: { [Op.is]: null }, // Exclude soft-deleted answers
        },
      });

    if (!answer) {
      throw new NotFoundException(`Answer with ID ${id} not found`);
    }

    return answer.get({ plain: true }) as Answer;
  }

  async getAnswersByQuizId(quizId: string): Promise<AnswerWithUser[]> {
    try {
      // Query answers excluding soft-deleted records
      const answers = await this.answerModel.findAll({
        where: {
          quiz_id: quizId,
          deleted_at: { [Op.is]: null }, // Exclude soft-deleted answers
        },
        order: [['submitted_at', 'DESC']],
      });
      
      const plainAnswers = answers.map(a => a.get({ plain: true }) as Answer);

      // Fetch all users efficiently using batch get (much faster than individual queries)
      const userIds = Array.from(new Set(plainAnswers.map(a => a.user_id).filter(Boolean))) as string[];
      const usersMap = await this.postgres.getBatchByIds<any>('users', userIds);

      // Combine answers with user data
      return plainAnswers.map(answer => ({
        ...answer,
        users: usersMap.get(answer.user_id) ? {
          in_game_name: usersMap.get(answer.user_id).in_game_name,
          profile_image_url: usersMap.get(answer.user_id).profile_image_url,
        } : undefined,
      })) as AnswerWithUser[];
    } catch (error) {
      throw new BadRequestException(`Failed to get answers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getAnswersByQuestionId(questionId: string): Promise<Answer[]> {
    try {
      // Query answers excluding soft-deleted records
      const answers = await this.answerModel.findAll({
        where: {
          question_id: questionId,
          deleted_at: { [Op.is]: null }, // Exclude soft-deleted answers
        },
        order: [['submitted_at', 'DESC']],
      });
      
      // Return sorted answers
      return answers.map(a => a.get({ plain: true }) as Answer);
    } catch (error) {
      throw new BadRequestException(`Failed to get answers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getAnswersByUserId(userId: string, quizId?: string): Promise<Answer[]> {
    try {
      const where: any = {
        user_id: userId,
        deleted_at: { [Op.is]: null }, // Exclude soft-deleted answers
      };
      
      if (quizId) {
        where.quiz_id = quizId;
      }

      // Query answers excluding soft-deleted records
      const answers = await this.answerModel.findAll({
        where,
        order: [['submitted_at', 'DESC']],
      });
      
      return answers.map(a => a.get({ plain: true }) as Answer);
    } catch (error) {
      throw new BadRequestException(`Failed to get answers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user's answer for a specific question
   */
  async getUserAnswerForQuestion(userId: string, questionId: string): Promise<Answer | null> {
    try {
      const answer = await this.answerModel.findOne({
        where: {
          user_id: userId,
          question_id: questionId,
          deleted_at: { [Op.is]: null }, // Exclude soft-deleted answers
        },
        order: [['submitted_at', 'DESC']], // Get most recent answer if multiple
      });

      return answer ? (answer.get({ plain: true }) as Answer) : null;
    } catch (error) {
      throw new BadRequestException(`Failed to get user answer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getLeaderboard(quizId: string): Promise<AnswerWithUser[]> {
    try {
      // Get all answers for the quiz excluding soft-deleted records
      const answers = await this.answerModel.findAll({
        where: {
          quiz_id: quizId,
          deleted_at: { [Op.is]: null }, // Exclude soft-deleted answers
        },
        order: [['submitted_at', 'ASC']], // Sort by submitted_at ascending for leaderboard (earliest first)
      });
      
      const plainAnswers = answers.map(a => a.get({ plain: true }) as Answer);
      
      // Sort by submitted_at ascending for leaderboard (earliest first)
      const sortedAnswers = plainAnswers.sort((a, b) => {
        const timeA = new Date(a.submitted_at || 0).getTime();
        const timeB = new Date(b.submitted_at || 0).getTime();
        return timeA - timeB;
      });

      if (!sortedAnswers || sortedAnswers.length === 0) {
        return [];
      }

      // Fetch all users efficiently using batch get (much faster than individual queries)
      const userIds = Array.from(new Set(sortedAnswers.map(a => a.user_id).filter(Boolean))) as string[];
      const usersMap = await this.postgres.getBatchByIds<any>('users', userIds);

      // Combine answers with user data
      const answersWithUser: AnswerWithUser[] = sortedAnswers.map(answer => ({
        ...answer,
        users: usersMap.get(answer.user_id) ? {
          in_game_name: usersMap.get(answer.user_id).in_game_name,
          profile_image_url: usersMap.get(answer.user_id).profile_image_url,
        } : undefined,
      }));

      // Aggregate scores by user (sum all scores for each user in the quiz)
      const userScores = new Map<string, { totalScore: number; firstAnswer: AnswerWithUser }>();
      
      answersWithUser.forEach((answer) => {
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

      return sortedLeaderboard;
    } catch (error) {
      throw new BadRequestException(`Failed to get leaderboard: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateAnswer(id: string, answerUpdate: AnswerUpdate): Promise<Answer> {
    try {
      const answer = await this.answerModel.findOne({
        where: {
          id,
          deleted_at: { [Op.is]: null }, // Don't allow updating soft-deleted answers
        },
      });
      
      if (!answer) {
        throw new NotFoundException(`Answer with ID ${id} not found or has been deleted`);
      }
      
      await answer.update(answerUpdate as any);
      await answer.reload();
      return answer.get({ plain: true }) as Answer;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to update answer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteAnswer(id: string): Promise<void> {
    try {
      await this.postgres.delete('answers', id);
    } catch (error) {
      throw new BadRequestException(`Failed to delete answer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Soft delete all answers for a specific quiz (reset quiz leaderboard)
   * Sets deleted_at timestamp instead of actually deleting records
   */
  async deleteAnswersByQuizId(quizId: string): Promise<number> {
    try {
      // Use transaction for atomic soft deletion
      return await this.postgres.runTransaction(async (transaction) => {
        const answers = await this.answerModel.findAll({
          where: {
            quiz_id: quizId,
            deleted_at: { [Op.is]: null }, // Only soft delete non-deleted answers
          },
          transaction,
        });

        if (answers.length === 0) {
          return 0;
        }

        // Soft delete all answers in parallel within transaction
        const now = new Date();
        await Promise.all(
          answers.map(answer => 
            answer.update({ deleted_at: now } as any, { transaction })
          )
        );

        return answers.length;
      });
    } catch (error) {
      throw new BadRequestException(`Failed to soft delete answers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Exclude all answers from combined leaderboard (reset combined leaderboard)
   * Sets excluded_from_combined flag instead of soft deleting, so quiz-specific leaderboards remain intact
   */
  async deleteAllAnswers(): Promise<number> {
    try {
      // Use transaction for atomic update
      return await this.postgres.runTransaction(async (transaction) => {
        const answers = await this.answerModel.findAll({
          where: {
            deleted_at: { [Op.is]: null }, // Only process non-deleted answers
            excluded_from_combined: { [Op.or]: [false, null] }, // Only process answers not already excluded
          },
          transaction,
        });

        if (answers.length === 0) {
          return 0;
        }

        // Mark all answers as excluded from combined leaderboard (but keep them for quiz-specific leaderboards)
        await Promise.all(
          answers.map(answer => 
            answer.update({ excluded_from_combined: true } as any, { transaction })
          )
        );

        return answers.length;
      });
    } catch (error) {
      throw new BadRequestException(`Failed to exclude answers from combined leaderboard: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

