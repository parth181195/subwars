import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef, Optional, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { QueryTypes, Op } from 'sequelize';
import { Quiz, QuizInsert, QuizUpdate, QuizStatus, QuizQuestion, QuizQuestionInsert, QuizQuestionUpdate, QuestionStatus, QuestionType, Answer, User } from '../types/database.types';
import { PostgresService } from '../services/postgres.service';
import { QuizModel } from '../models/quiz.model';
import { QuestionModel } from '../models/question.model';
import { LeaderboardConfigModel } from '../models/leaderboard-config.model';
import { HeroModel } from '../models/hero.model';
import { VoiceLineService } from '../voice-line/voice-line.service';
import { UserService } from '../user/user.service';
import { QuizGateway } from './quiz.gateway';
import { QuizAutoModeService } from './quiz-auto-mode.service';

@Injectable()
export class QuizService {
  private readonly logger = new Logger(QuizService.name);

  constructor(
    @InjectModel(QuizModel)
    private readonly quizModel: typeof QuizModel,
    @InjectModel(QuestionModel)
    private readonly questionModel: typeof QuestionModel,
    @InjectModel(LeaderboardConfigModel)
    private readonly leaderboardConfigModel: typeof LeaderboardConfigModel,
    @InjectModel(HeroModel)
    private readonly heroModel: typeof HeroModel,
    private postgres: PostgresService,
    private voiceLineService: VoiceLineService,
    private userService: UserService,
    @Inject(forwardRef(() => QuizGateway))
    private quizGateway: QuizGateway,
    @Optional()
    @Inject(forwardRef(() => QuizAutoModeService))
    private autoModeService?: QuizAutoModeService,
  ) {}

  async createQuiz(quizInsert: QuizInsert): Promise<Quiz> {
    try {
      const status = quizInsert.status || QuizStatus.DRAFT;
      
      // If creating a quiz with live status, ensure no other quizzes are live
      if (status === QuizStatus.LIVE) {
        const liveQuizzes = await this.postgres.query<Quiz>(
          'quizzes',
          [{ field: 'status', operator: '==', value: QuizStatus.LIVE }]
        );

        // Set all other live quizzes to draft (parallelize where possible)
        if (liveQuizzes && liveQuizzes.length > 0) {
          // Fetch all live questions for all quizzes in parallel
          const quizQuestionsPromises = liveQuizzes.map(async (liveQuiz) => {
            const liveQuestions = await this.postgres.query<QuizQuestion>(
              'questions',
              [
                { field: 'quiz_id', operator: '==', value: liveQuiz.id },
                { field: 'is_active', operator: '==', value: true },
                { field: 'status', operator: '==', value: QuestionStatus.LIVE }
              ]
            );
            return { quiz: liveQuiz, questions: liveQuestions };
          });
          
          const quizQuestions = await Promise.all(quizQuestionsPromises);
          
          // Process all quizzes in parallel
          await Promise.all(
            quizQuestions.map(async ({ quiz, questions }) => {
              const endedAt = new Date().toISOString();
              
              // End all live questions in parallel
              if (questions && questions.length > 0) {
                await Promise.all(
                  questions.map(question =>
                    this.postgres.update<QuizQuestion>(
                      'questions',
                      question.id,
                      {
                        is_active: false,
                        status: QuestionStatus.COMPLETED,
                        ended_at: endedAt,
                      }
                    )
                  )
                );
              }

              // Set the quiz to draft
              await this.postgres.update<Quiz>('quizzes', quiz.id, {
                status: QuizStatus.DRAFT,
              });

              // Emit WebSocket event (non-blocking)
              this.quizGateway.emitQuizStatusChanged(quiz.id, QuizStatus.DRAFT).catch(err => {
                console.error(`Error emitting quiz status change for ${quiz.id}:`, err);
              });
            })
          );
        }
      }

      const quiz = await this.postgres.create<Quiz>('quizzes', {
        ...quizInsert,
        status,
      });
      return quiz;
    } catch (error) {
      throw new BadRequestException(`Failed to create quiz: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getQuizById(id: string): Promise<Quiz> {
    const quiz = await this.quizModel.findByPk(id);
    
    if (!quiz) {
      throw new NotFoundException(`Contest with ID ${id} not found`);
    }

    return quiz.get({ plain: true }) as Quiz;
  }

  async getAllQuizzes(): Promise<Quiz[]> {
    try {
      const quizzes = await this.quizModel.findAll({
        order: [['created_at', 'DESC']],
      });
      return quizzes.map(q => q.toJSON() as Quiz);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('recovery mode')) {
        throw new BadRequestException('Database is temporarily unavailable. Please try again in a moment.');
      }
      throw new BadRequestException(`Failed to get quizzes: ${errorMessage}`);
    }
  }

  async getActiveQuizzes(): Promise<Quiz[]> {
    try {
      // Return quizzes with status 'live' or 'completed'
      const quizzes = await this.quizModel.findAll({
        where: {
          status: {
            [Op.in]: [QuizStatus.LIVE, QuizStatus.COMPLETED],
          },
        },
        order: [['created_at', 'DESC']],
      });
      return quizzes.map(q => q.toJSON() as Quiz);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('recovery mode')) {
        throw new BadRequestException('Database is temporarily unavailable. Please try again in a moment.');
      }
      throw new BadRequestException(`Failed to get active quizzes: ${errorMessage}`);
    }
  }

  async updateQuiz(id: string, quizUpdate: QuizUpdate): Promise<Quiz> {
    // Get current quiz status before update using Sequelize model
    const currentQuizInstance = await this.quizModel.findByPk(id);
    
    if (!currentQuizInstance) {
      throw new NotFoundException(`Contest with ID ${id} not found`);
    }

    const currentQuiz = currentQuizInstance.get({ plain: true }) as Quiz;

    // If status is being changed to live, ensure no other quizzes are live
    if (quizUpdate.status === QuizStatus.LIVE && currentQuiz.status !== QuizStatus.LIVE) {
      await this.handleLiveQuizConflict(id);
    }

    // Validate: Auto mode can only be enabled if quiz is live
    if (quizUpdate.auto_mode_enabled === true && currentQuiz.status !== QuizStatus.LIVE) {
      throw new BadRequestException('Auto mode can only be enabled when the quiz status is "live". Please set the quiz to live first.');
    }

    // If status is being changed to draft, end any live questions and stop auto mode
    if (quizUpdate.status === QuizStatus.DRAFT && currentQuiz.status !== QuizStatus.DRAFT) {
      // Parallelize: stop auto mode and find live questions simultaneously
      const [liveQuestionsRaw] = await Promise.all([
        this.questionModel.findAll({
          where: {
            quiz_id: id,
            is_active: true,
            status: QuestionStatus.LIVE,
          },
        }),
        // Stop auto mode if it's running (skip draft update since we're already setting to draft)
        this.autoModeService && currentQuiz.auto_mode_enabled
          ? this.autoModeService.stopAutoMode(id, true)
          : Promise.resolve(),
      ]);

      const liveQuestions = liveQuestionsRaw.map(q => q.get({ plain: true })) as QuizQuestion[];

      if (liveQuestions && liveQuestions.length > 0) {
        // End all live questions using endQuestion method (emits WebSocket events)
        await Promise.all(
          liveQuestions.map(question => this.endQuestion(question.id, true))
        );
      }

      // Ensure auto mode is disabled when quiz is set to draft
      if (currentQuiz.auto_mode_enabled) {
        quizUpdate.auto_mode_enabled = false;
        quizUpdate.auto_mode_paused = false; // Also reset pause state
      }
    }

    try {
      // Check if we need to restart auto mode (check before update to avoid extra query)
      const needsAutoModeRestart = this.autoModeService && (
        quizUpdate.auto_mode_enabled !== undefined || 
        quizUpdate.auto_mode_interval_seconds !== undefined ||
        (quizUpdate.status === QuizStatus.LIVE && currentQuiz.auto_mode_enabled)
      );

      // Update quiz using Sequelize model directly
      await currentQuizInstance.update(quizUpdate as any);
      await currentQuizInstance.reload();
      const updatedQuiz = currentQuizInstance.get({ plain: true }) as Quiz;

      // Restart auto mode if needed (non-blocking to speed up response)
      // Auto mode restart is fast and doesn't need to block the API response
      if (needsAutoModeRestart) {
        // Don't await - let it run in background to speed up response
        this.autoModeService.restartAutoMode(id).catch(err => {
          console.error(`Error restarting auto mode for quiz ${id}:`, err);
        });
      }

      // Emit WebSocket event if status changed (non-blocking)
      if (quizUpdate.status !== undefined && quizUpdate.status !== currentQuiz.status) {
        this.quizGateway.emitQuizStatusChanged(id, quizUpdate.status).catch(err => {
          console.error(`Error emitting quiz status change for ${id}:`, err);
        });
      }

      // If quiz is marked as completed, emit top 3 winners announcement
      if (quizUpdate.status === QuizStatus.COMPLETED) {
        // This will be handled by the gateway via the controller
        // We return the quiz so the controller can trigger the announcement
      }

      return updatedQuiz;
    } catch (error) {
      throw new BadRequestException(`Failed to update quiz: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle live quiz conflicts - set other live quizzes to draft and end their questions
   * @param excludeQuizId - Quiz ID to exclude from the conflict check (the one being set to live)
   */
  private async handleLiveQuizConflict(excludeQuizId: string): Promise<void> {
    const liveQuizzesRaw = await this.quizModel.findAll({
      where: {
        status: QuizStatus.LIVE,
        id: { [Op.ne]: excludeQuizId },
      },
    });
    const liveQuizzes = liveQuizzesRaw.map(q => q.get({ plain: true })) as Quiz[];

    if (!liveQuizzes || liveQuizzes.length === 0) {
      return;
    }

    // Fetch all live questions for all quizzes in parallel
    const quizQuestionsPromises = liveQuizzes.map(async (liveQuiz) => {
      const liveQuestionsRaw = await this.questionModel.findAll({
        where: {
          quiz_id: liveQuiz.id,
          is_active: true,
          status: QuestionStatus.LIVE,
        },
      });
      const liveQuestions = liveQuestionsRaw.map(q => q.get({ plain: true })) as QuizQuestion[];
      return { quiz: liveQuiz, questions: liveQuestions };
    });
    
    const quizQuestions = await Promise.all(quizQuestionsPromises);
    
    // Process all quizzes in parallel
    await Promise.all(
      quizQuestions.map(async ({ quiz, questions }) => {
        // End all live questions in parallel
        if (questions && questions.length > 0) {
          await Promise.all(
            questions.map(question => this.endQuestion(question.id, true))
          );
        }

        // Set the quiz to draft using Sequelize model
        const quizInstance = await this.quizModel.findByPk(quiz.id);
        if (quizInstance) {
          await quizInstance.update({
            status: QuizStatus.DRAFT,
          } as any);
        }

        // Emit WebSocket event (non-blocking)
        this.quizGateway.emitQuizStatusChanged(quiz.id, QuizStatus.DRAFT).catch(err => {
          console.error(`Error emitting quiz status change for ${quiz.id}:`, err);
        });
      })
    );
  }

  async deleteQuiz(id: string): Promise<void> {
    try {
      // Questions will be deleted via CASCADE DELETE in PostgreSQL
      // For now, we'll delete the quiz document
      // Questions subcollection will need to be handled separately if needed
      await this.postgres.delete('quizzes', id);
    } catch (error) {
      throw new BadRequestException(`Failed to delete quiz: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Quiz Questions (stored as subcollection: quizzes/{quizId}/questions/{questionId})
  async createQuestion(questionInsert: QuizQuestionInsert): Promise<QuizQuestion> {
    try {
      // Build question data, filtering out undefined values
      const questionData: Omit<QuizQuestion, 'id' | 'created_at' | 'updated_at'> = {
        quiz_id: questionInsert.quiz_id,
        question_type: questionInsert.question_type,
        question_content: questionInsert.question_content,
        correct_answer_hero: questionInsert.correct_answer_hero,
        order_index: questionInsert.order_index,
        status: questionInsert.status || QuestionStatus.PENDING,
        is_active: questionInsert.is_active || false,
        time_limit_seconds: questionInsert.time_limit_seconds || 120,
      } as Omit<QuizQuestion, 'id' | 'created_at' | 'updated_at'>;

      // Only include optional fields if they have values
      if (questionInsert.question_content_metadata !== undefined && questionInsert.question_content_metadata !== null) {
        questionData.question_content_metadata = questionInsert.question_content_metadata;
      }

      if (questionInsert.answer_image_url !== undefined && questionInsert.answer_image_url !== null) {
        questionData.answer_image_url = questionInsert.answer_image_url;
      }

      const question = await this.postgres.create<QuizQuestion>(
        'questions',
        questionData
      );
      return question;
    } catch (error) {
      throw new BadRequestException(`Failed to create question: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getQuestionById(id: string): Promise<QuizQuestion | null> {
    // In PostgreSQL, questions are in a single table, so we can query directly
    try {
      const question = await this.postgres.getById<QuizQuestion>('questions', id);
      return question;
    } catch (error) {
      console.error('Error getting question by ID:', error);
      return null;
    }
  }
  
  // Helper method to get question by ID with quiz ID (more efficient)
  async getQuestionByIdWithQuiz(quizId: string, questionId: string): Promise<QuizQuestion | null> {
    try {
      // Verify quiz_id matches
      const question = await this.postgres.getById<QuizQuestion>('questions', questionId);
      if (question && question.quiz_id === quizId) {
        return question;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async getQuestionsByQuizId(quizId: string): Promise<QuizQuestion[]> {
    try {
      // Use raw SQL to ensure started_at and ended_at are read in UTC
      const sequelize = this.questionModel.sequelize;
      if (!sequelize) {
        throw new Error('Sequelize instance not available');
      }

      const questions = await sequelize.query(
        `SELECT 
          id,
          quiz_id,
          question_type,
          question_content,
          question_content_metadata,
          correct_answer_hero,
          answer_image_url,
          time_limit_seconds,
          order_index,
          status,
          is_active,
          (started_at AT TIME ZONE 'UTC')::text as started_at,
          (ended_at AT TIME ZONE 'UTC')::text as ended_at,
          created_at,
          updated_at
        FROM questions
        WHERE quiz_id = :quizId
        ORDER BY order_index ASC`,
        {
          replacements: { quizId },
          type: QueryTypes.SELECT,
        }
      ) as Array<any>;

      // Convert PostgreSQL timestamp strings to ISO strings
      return questions.map(q => ({
        ...q,
        started_at: q.started_at ? new Date(q.started_at + 'Z').toISOString() : undefined,
        ended_at: q.ended_at ? new Date(q.ended_at + 'Z').toISOString() : undefined,
        created_at: q.created_at ? new Date(q.created_at + 'Z').toISOString() : q.created_at,
        updated_at: q.updated_at ? new Date(q.updated_at + 'Z').toISOString() : q.updated_at,
      })) as QuizQuestion[];
    } catch (error) {
      throw new BadRequestException(`Failed to get questions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getCurrentActiveQuestion(quizId: string): Promise<QuizQuestion | null> {
    try {
      // Use raw SQL to ensure started_at is read in UTC
      const sequelize = this.questionModel.sequelize;
      if (!sequelize) {
        return null;
      }

      const questions = await sequelize.query(
        `SELECT 
          id,
          quiz_id,
          question_type,
          question_content,
          question_content_metadata,
          correct_answer_hero,
          answer_image_url,
          time_limit_seconds,
          order_index,
          status,
          is_active,
          (started_at AT TIME ZONE 'UTC')::text as started_at,
          (ended_at AT TIME ZONE 'UTC')::text as ended_at,
          created_at,
          updated_at
        FROM questions
        WHERE quiz_id = :quizId
          AND is_active = true
          AND status = :status
        ORDER BY started_at DESC
        LIMIT 1`,
        {
          replacements: { 
            quizId,
            status: QuestionStatus.LIVE,
          },
          type: QueryTypes.SELECT,
        }
      ) as Array<any>;

      if (questions.length === 0) {
        return null;
      }

      const q = questions[0];
      // Convert PostgreSQL timestamp strings to ISO strings
      return {
        ...q,
        started_at: q.started_at ? new Date(q.started_at + 'Z').toISOString() : undefined,
        ended_at: q.ended_at ? new Date(q.ended_at + 'Z').toISOString() : undefined,
        created_at: q.created_at ? new Date(q.created_at + 'Z').toISOString() : q.created_at,
        updated_at: q.updated_at ? new Date(q.updated_at + 'Z').toISOString() : q.updated_at,
      } as QuizQuestion;
    } catch (error) {
      this.logger.error(`Error getting current active question: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  async updateQuestion(id: string, questionUpdate: QuizQuestionUpdate): Promise<QuizQuestion> {
    try {
      // Use Sequelize model directly for better consistency and type safety
      const question = await this.questionModel.findByPk(id);
      if (!question) {
        throw new NotFoundException(`Question with ID ${id} not found`);
      }

      // Prepare update data - handle undefined values properly
      const updateData: any = { ...questionUpdate };
      
      // If ended_at is explicitly set to undefined, set it to null to clear it
      if ('ended_at' in questionUpdate && questionUpdate.ended_at === undefined) {
        updateData.ended_at = null;
      }
      
      // Convert ISO string dates to Date objects if needed
      if (updateData.started_at && typeof updateData.started_at === 'string') {
        updateData.started_at = new Date(updateData.started_at);
      }
      if (updateData.ended_at && typeof updateData.ended_at === 'string') {
        updateData.ended_at = new Date(updateData.ended_at);
      }

      await question.update(updateData);
      
      // Reload to get the latest data
      await question.reload();
      
      return question.get({ plain: true }) as QuizQuestion;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to update question: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async activateQuestion(questionId: string): Promise<QuizQuestion> {
    // First, get the question to find its quiz_id
    const question = await this.getQuestionById(questionId);
    
    if (!question) {
      throw new NotFoundException(`Question with ID ${questionId} not found`);
    }
    
    const quizId = question.quiz_id;
    
    // Get the quiz to check its status
    const quiz = await this.getQuizById(quizId);
    
    if (!quiz) {
      throw new NotFoundException(`Contest with ID ${quizId} not found`);
    }
    
    // Prevent activating questions if quiz is in draft
    if (quiz.status === QuizStatus.DRAFT) {
      throw new BadRequestException('Cannot activate questions while the contest is in draft status. Please set the contest to live first.');
    }
    
    // Prevent activating questions if quiz is completed
    if (quiz.status === QuizStatus.COMPLETED) {
      throw new BadRequestException('Cannot activate questions for a completed contest.');
    }
    
    const endedAt = new Date().toISOString();
    
    // Get all active questions in the quiz (excluding the current one)
    const activeQuestions = await this.postgres.query<QuizQuestion>(
      'questions',
      [
        { field: 'quiz_id', operator: '==', value: quizId },
        { field: 'is_active', operator: '==', value: true },
        { field: 'id', operator: '!=', value: questionId }
      ]
    );
    
    // Deactivate all active questions in the quiz
    // If they were live, mark as completed; otherwise keep their current status
    if (activeQuestions && activeQuestions.length > 0) {
      await Promise.all(
        activeQuestions.map(async (activeQuestion) => {
          const updateData: Partial<QuizQuestionUpdate> = {
            is_active: false,
            ended_at: endedAt,
          };
          
          // If the question was live, mark it as completed
          if (activeQuestion.status === QuestionStatus.LIVE) {
            updateData.status = QuestionStatus.COMPLETED;
          }
          
          await this.postgres.update<QuizQuestion>(
            'questions',
            activeQuestion.id,
            updateData
          );
        })
      );
    }

    // Activate the selected question with start time
    // Use raw SQL to set timestamp in UTC to avoid any timezone conversion issues
    const startedAt = new Date();
    const startedAtISO = startedAt.toISOString();
    this.logger.log(`Activating question ${questionId} with started_at: ${startedAtISO} (UTC)`);
    
    // Use Sequelize model directly to ensure the update is applied correctly
    const questionToActivate = await this.questionModel.findByPk(questionId);
    if (!questionToActivate) {
      throw new NotFoundException(`Question with ID ${questionId} not found`);
    }

    // Use raw SQL update to ensure UTC timestamp is set correctly without timezone conversion
    const sequelize = this.questionModel.sequelize;
    if (!sequelize) {
      throw new Error('Sequelize instance not available');
    }

    // Update using raw SQL to ensure UTC timestamp is preserved
    // Use NOW() AT TIME ZONE 'UTC' to get current UTC time from PostgreSQL
    await sequelize.query(
      `UPDATE questions 
       SET is_active = true, 
           status = :status, 
           started_at = (NOW() AT TIME ZONE 'UTC'), 
           ended_at = NULL,
           updated_at = NOW()
       WHERE id = :questionId`,
      {
        replacements: {
          questionId,
          status: QuestionStatus.LIVE,
        },
        type: QueryTypes.UPDATE,
      }
    );

    // Reload to get the latest data from database
    await questionToActivate.reload();
    
    // Fetch started_at using raw SQL to ensure we get it in UTC correctly
    if (!sequelize) {
      throw new Error('Sequelize instance not available');
    }
    
    const startedAtResult = await sequelize.query(
      `SELECT (started_at AT TIME ZONE 'UTC')::text as started_at_utc
       FROM questions 
       WHERE id = :questionId`,
      {
        replacements: { questionId },
        type: QueryTypes.SELECT,
      }
    ) as Array<{ started_at_utc: string }>;
    
    // Get the question data - ensure started_at is properly formatted
    const activatedQuestion = questionToActivate.get({ plain: true }) as QuizQuestion;
    
    // Use the UTC timestamp from raw SQL query
    if (startedAtResult && startedAtResult.length > 0 && startedAtResult[0].started_at_utc) {
      // Parse the PostgreSQL timestamp string and convert to ISO string
      const pgTimestamp = startedAtResult[0].started_at_utc;
      // PostgreSQL returns timestamps in format like "2025-12-07 21:41:32.047"
      // Convert to ISO string format
      const utcDate = new Date(pgTimestamp + 'Z'); // Add Z to indicate UTC
      activatedQuestion.started_at = utcDate.toISOString();
      this.logger.log(`Question ${questionId} activated. Using UTC started_at from DB: ${activatedQuestion.started_at}`);
    } else if (questionToActivate.started_at) {
      // Fallback to model's started_at if raw query fails
      activatedQuestion.started_at = questionToActivate.started_at.toISOString();
      this.logger.warn(`Question ${questionId} activated. Using model started_at (fallback): ${activatedQuestion.started_at}`);
    } else {
      this.logger.error(`Question ${questionId} activated. No started_at found!`);
    }
    
    // Ensure all required fields are present
    if (!activatedQuestion.id) {
      activatedQuestion.id = questionToActivate.id;
    }
    if (!activatedQuestion.quiz_id) {
      activatedQuestion.quiz_id = questionToActivate.quiz_id;
    }
    if (!activatedQuestion.question_type) {
      activatedQuestion.question_type = questionToActivate.question_type;
    }
    if (activatedQuestion.time_limit_seconds === undefined || activatedQuestion.time_limit_seconds === null) {
      activatedQuestion.time_limit_seconds = questionToActivate.time_limit_seconds;
    }
    if (activatedQuestion.order_index === undefined || activatedQuestion.order_index === null) {
      activatedQuestion.order_index = questionToActivate.order_index;
    }
    if (activatedQuestion.status !== QuestionStatus.LIVE) {
      activatedQuestion.status = QuestionStatus.LIVE;
    }
    if (activatedQuestion.is_active !== true) {
      activatedQuestion.is_active = true;
    }
    
    // Verify the update worked
    const now = new Date();
    const startedAtTime = activatedQuestion.started_at ? new Date(activatedQuestion.started_at).getTime() : null;
    const elapsed = startedAtTime ? Math.floor((now.getTime() - startedAtTime) / 1000) : null;
    this.logger.log(`Question ${questionId} activated. started_at: ${activatedQuestion.started_at}, elapsed: ${elapsed}s, is_active: ${activatedQuestion.is_active}, status: ${activatedQuestion.status}, time_limit: ${activatedQuestion.time_limit_seconds}, order_index: ${activatedQuestion.order_index}`);
    
    // Validate required fields before emitting
    if (!activatedQuestion.started_at) {
      this.logger.error(`Question ${questionId} missing started_at! Cannot emit question-live event.`);
      throw new Error(`Question ${questionId} is missing started_at after activation`);
    }
    if (!activatedQuestion.time_limit_seconds) {
      this.logger.error(`Question ${questionId} missing time_limit_seconds! Cannot emit question-live event.`);
      throw new Error(`Question ${questionId} is missing time_limit_seconds`);
    }

    // Emit Socket.IO event to notify all clients (including auto mode)
    await this.quizGateway.emitQuestionLive(quizId, activatedQuestion);

    return activatedQuestion;
  }

  async endQuestion(questionId: string, emitEvent = true): Promise<QuizQuestion> {
    const question = await this.getQuestionById(questionId);
    
    if (!question) {
      throw new NotFoundException(`Question with ID ${questionId} not found`);
    }
    
    const endedAt = new Date().toISOString();
    const endedQuestion = await this.updateQuestion(questionId, {
      quiz_id: question.quiz_id, // Provide quiz_id for update
      is_active: false,
      status: QuestionStatus.COMPLETED,
      ended_at: endedAt,
    });

    // Emit Socket.IO event to notify all clients (if not called from auto mode service)
    if (emitEvent) {
      await this.quizGateway.emitQuestionEnded(question.quiz_id, endedQuestion);
    }

    return endedQuestion;
  }

  /**
   * Check for and automatically end questions that have exceeded their time limit
   * This should be called periodically (e.g., every 5-10 seconds)
   * Returns array of expired question IDs and quiz IDs
   */
  async checkAndEndExpiredQuestions(): Promise<Array<{ id: string; quiz_id: string }>> {
    try {
      // Use Sequelize models directly for better performance and type safety
      const expiredQuestions: Array<{ id: string; quiz_id: string }> = [];

      // Get all currently live questions using raw SQL to ensure UTC timestamps are read correctly
      // The database column is TIMESTAMP (without timezone), so we need to explicitly treat it as UTC
      const sequelize = this.questionModel.sequelize;
      if (!sequelize) {
        this.logger.error('Sequelize instance not available');
        return [];
      }

      const liveQuestionsRaw = await sequelize.query(
        `SELECT 
          q.id,
          q.quiz_id,
          (q.started_at AT TIME ZONE 'UTC')::timestamptz as started_at_utc,
          q.time_limit_seconds
        FROM questions q
        WHERE q.is_active = true 
          AND q.status = :status
          AND q.started_at IS NOT NULL
          AND q.time_limit_seconds IS NOT NULL`,
        {
          replacements: {
            status: QuestionStatus.LIVE,
          },
          type: QueryTypes.SELECT,
        }
      ) as Array<{
        id: string;
        quiz_id: string;
        started_at_utc: Date;
        time_limit_seconds: number;
      }>;

      const now = Date.now();

      for (const question of liveQuestionsRaw) {
        if (!question.started_at_utc || !question.time_limit_seconds) {
          continue;
        }

        // started_at_utc is already in UTC from the SQL query (converted using AT TIME ZONE 'UTC')
        const startedAt = new Date(question.started_at_utc).getTime();
        const elapsed = Math.floor((now - startedAt) / 1000); // seconds
        const timeLimit = question.time_limit_seconds;

        // Log the calculation for debugging
        const startedAtISO = new Date(question.started_at_utc).toISOString();
        this.logger.debug(`Question ${question.id}: started_at=${startedAtISO}, elapsed=${elapsed}s, limit=${timeLimit}s`);

        // Only mark as expired if elapsed time is actually greater than or equal to time limit
        // Check elapsed > 0 to ensure question was actually started (not just activated)
        if (elapsed >= timeLimit && elapsed > 0) {
          this.logger.log(`Question ${question.id} expired: elapsed=${elapsed}s, limit=${timeLimit}s, started_at=${startedAtISO}`);
          expiredQuestions.push({ id: question.id, quiz_id: question.quiz_id });
        } else if (elapsed < 0) {
          // Negative elapsed time means started_at is in the future (shouldn't happen, but log it)
          this.logger.warn(`Question ${question.id} has started_at in the future: elapsed=${elapsed}s, started_at=${startedAtISO}`);
        }
      }

      // End all expired questions and return them for event emission
      if (expiredQuestions.length > 0) {
        const endedAt = new Date().toISOString();
        for (const question of expiredQuestions) {
          try {
            // Verify question is still active before ending (prevent race conditions)
            const currentQuestion = await this.getQuestionById(question.id);
            if (currentQuestion && currentQuestion.is_active && currentQuestion.status === QuestionStatus.LIVE) {
              await this.endQuestion(question.id, true);
            }
          } catch (error) {
            console.error(`Error ending expired question ${question.id}:`, error);
            // Continue with other questions even if one fails
          }
        }
      }

      return expiredQuestions;
    } catch (error) {
      console.error('Error checking for expired questions:', error);
      return [];
    }
  }

  // Get answers for a question
  async getQuestionAnswers(questionId: string): Promise<Array<Answer & { user_email?: string | null }>> {
    try {
      // Query without orderBy to avoid requiring composite index
      // Sort in memory instead
      // Use optimized method from PostgresService that includes user data
      const answers = await this.postgres.getAnswersByQuestionId(questionId);
      
      // Get unique user IDs
      const userIds = Array.from(new Set(answers.map(a => a.user_id).filter(Boolean))) as string[];

      // Fetch all users efficiently using batch get (much faster than individual queries)
      const usersMap = await this.postgres.getBatchByIds<User>('users', userIds);

      // Enrich answers with user email
      const enrichedAnswers = answers.map(answer => {
        const user = answer.user_id ? usersMap.get(answer.user_id) : null;
        return {
          ...answer,
          user_email: user?.email || null,
        };
      });
      
      // Sort by response_time ascending (fastest first), handling null/undefined
      return enrichedAnswers.sort((a, b) => {
        const timeA = a.response_time ?? Infinity; // Put null/undefined at the end
        const timeB = b.response_time ?? Infinity;
        return timeA - timeB;
      });
    } catch (error) {
      throw new BadRequestException(`Failed to get answers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get top 3 fastest correct answers for a question with user info
  async getTopAnswers(questionId: string): Promise<Array<{
    position: number;
    user_name: string;
    response_time: number;
    score: number;
  }>> {
    try {
      // Query without orderBy to avoid requiring composite index
      // Filter and sort in memory instead
      // Use optimized method from PostgresService
      return await this.postgres.getTopAnswers(questionId, 3);
    } catch (error) {
      throw new BadRequestException(`Failed to get top answers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
    try {
      // Get hidden emails config using direct model
      const config = await this.leaderboardConfigModel.findByPk('hidden_emails').catch(() => null);
      const hiddenEmails = config?.emails || [];
      
      // Use optimized leaderboard method from PostgresService
      return await this.postgres.getQuizLeaderboard(quizId, hiddenEmails);
    } catch (error) {
      throw new BadRequestException(`Failed to get leaderboard: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get combined leaderboard across all quizzes
  async getCombinedLeaderboard(): Promise<Array<{
    user_id: string;
    user_name: string;
    user_email?: string;
    total_score: number;
    total_answers: number;
    correct_answers: number;
    average_response_time: number;
    quizzes_played: number;
  }>> {
    try {
      // Get hidden emails config using direct model
      const config = await this.leaderboardConfigModel.findByPk('hidden_emails').catch(() => null);
      const hiddenEmails = config?.emails || [];

      // Use optimized combined leaderboard method from PostgresService
      return await this.postgres.getCombinedLeaderboard(hiddenEmails);
    } catch (error) {
      throw new BadRequestException(`Failed to get combined leaderboard: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Auto-generate questions
  async autoGenerateQuestions(
    quizId: string,
    options: {
      count: number;
      questionType?: QuestionType;
      timeLimitSeconds?: number;
      excludeHeroes?: string[];
    },
  ): Promise<QuizQuestion[]> {
    const { count, questionType = QuestionType.VOICE_LINE, timeLimitSeconds = 120, excludeHeroes = [] } = options;

    if (count <= 0 || count > 100) {
      throw new BadRequestException('Question count must be between 1 and 100');
    }

    // Verify quiz exists
    const quiz = await this.getQuizById(quizId);
    if (!quiz) {
      throw new NotFoundException(`Contest with id ${quizId} not found`);
    }

    // Get existing questions to determine next order_index
    const existingQuestions = await this.getQuestionsByQuizId(quizId);
    const nextOrderIndex = existingQuestions.length;

    // Get unique heroes from voice_lines table (where the actual data is)
    // This is more reliable than the heroes table which might be empty
    const sequelize = this.questionModel.sequelize;
    if (!sequelize) {
      throw new Error('Sequelize instance not available');
    }

    const heroResults = await sequelize.query(
      `SELECT DISTINCT hero_name as name 
       FROM voice_lines 
       WHERE hero_name IS NOT NULL 
       ORDER BY hero_name`,
      {
        type: QueryTypes.SELECT,
      }
    ) as Array<{ name: string }>;

    const heroSet = new Set<string>();
    
    heroResults.forEach((hero) => {
      if (hero?.name && !excludeHeroes.includes(hero.name)) {
        heroSet.add(hero.name);
      }
    });

    const availableHeroes = Array.from(heroSet);
    
    if (availableHeroes.length === 0) {
      throw new BadRequestException('No heroes available for question generation. Make sure voice lines are imported into the database.');
    }

    // Generate questions
    const generatedQuestions: QuizQuestion[] = [];
    const usedHeroVoiceLineCombos = new Set<string>(); // Track used hero+voiceLine to avoid duplicates

    for (let i = 0; i < count; i++) {
      // Randomly select a hero
      const randomHero = availableHeroes[Math.floor(Math.random() * availableHeroes.length)];
      
      // Fetch voice lines for this hero from PostgreSQL
      let heroVoiceLines;
      try {
        heroVoiceLines = await this.voiceLineService.getVoiceLinesByHero(randomHero);
      } catch (error) {
        // Skip this hero if no voice lines found, try another
        i--;
        continue;
      }

      if (!heroVoiceLines || heroVoiceLines.length === 0) {
        // Skip this hero if no voice lines found, try another
        i--;
        continue;
      }

      // Filter out already used voice lines for this hero (with valid URLs)
      // New structure has url directly on the voice line
      const availableVoiceLines = heroVoiceLines.filter(
        (vl) => {
          const url = vl.url || vl.voice_line_url || (vl as any).audio_url;
          return url && !usedHeroVoiceLineCombos.has(`${randomHero}:${url}`);
        }
      );

      if (availableVoiceLines.length === 0) {
        // All voice lines for this hero are used, try another hero
        i--;
        continue;
      }

      // Randomly select a voice line
      const randomVoiceLine = availableVoiceLines[Math.floor(Math.random() * availableVoiceLines.length)];
      const voiceLineUrl = randomVoiceLine.url || randomVoiceLine.voice_line_url || (randomVoiceLine as any).audio_url;

      if (!voiceLineUrl) {
        i--;
        continue;
      }

      // Mark this combo as used
      usedHeroVoiceLineCombos.add(`${randomHero}:${voiceLineUrl}`);

      // Create the question
      const questionInsert: QuizQuestionInsert = {
        quiz_id: quizId,
        question_type: questionType,
        question_content: voiceLineUrl,
        correct_answer_hero: randomHero,
        time_limit_seconds: timeLimitSeconds,
        order_index: nextOrderIndex + i,
        status: QuestionStatus.PENDING,
        is_active: false,
      };

      try {
        const question = await this.createQuestion(questionInsert);
        generatedQuestions.push(question);
      } catch (error) {
        // Log error but continue generating other questions
        console.error(`Failed to create question ${i + 1}:`, error);
      }
    }

    return generatedQuestions;
  }

  async deleteQuestion(id: string): Promise<void> {
    // Need to find the quiz_id first
    const question = await this.getQuestionById(id);
    
    if (!question) {
      throw new NotFoundException(`Question with ID ${id} not found`);
    }
    
    try {
      const questionInstance = await this.questionModel.findByPk(id);
      if (!questionInstance) {
        throw new NotFoundException(`Question with ID ${id} not found`);
      }
      await questionInstance.destroy();
    } catch (error) {
      throw new BadRequestException(`Failed to delete question: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

}

