import { Injectable, OnModuleInit, OnModuleDestroy, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { QueryTypes } from 'sequelize';
import { QuizService } from './quiz.service';
import { QuizGateway } from './quiz.gateway';
import { PostgresService } from '../services/postgres.service';
import { Quiz, QuizStatus, QuizQuestion, QuestionStatus } from '../types/database.types';
import { QuizModel } from '../models/quiz.model';
import { QuestionModel } from '../models/question.model';
import * as cron from 'node-cron';

interface AutoModeState {
  quizId: string;
  nextActivationTime: Date | null; // When the next question should be activated
  questionIndex: number;
  questions: QuizQuestion[];
  intervalSeconds: number;
}

@Injectable()
export class QuizAutoModeService implements OnModuleInit, OnModuleDestroy {
  private activeAutoModes: Map<string, AutoModeState> = new Map();
  private cronJob: cron.ScheduledTask | null = null;

  constructor(
    @InjectModel(QuizModel)
    private readonly quizModel: typeof QuizModel,
    @InjectModel(QuestionModel)
    private readonly questionModel: typeof QuestionModel,
    private postgres: PostgresService,
    @Inject(forwardRef(() => QuizService))
    private quizService: QuizService,
    @Inject(forwardRef(() => QuizGateway))
    private quizGateway: QuizGateway,
  ) {}

  onModuleInit() {
    // Set up cron job to check for questions that need activation
    // Runs every second for precise timing (lightweight check, only processes when time matches)
    this.cronJob = cron.schedule('* * * * * *', () => {
      this.checkAndActivateQuestions();
    });

    // Check for quiz changes periodically via polling
    // Runs every 30 seconds to check for quiz status changes (less frequent, more expensive query)
    cron.schedule('*/30 * * * * *', () => {
      this.checkAndManageAutoModes();
    });

    // Initial check to set up auto modes for existing live quizzes
    this.checkAndManageAutoModes();
  }

  onModuleDestroy() {
    // Stop cron job
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    
    // Clear all auto modes
    this.activeAutoModes.clear();
  }

  /**
   * Handle a quiz change (called from periodic check)
   */
  private async handleQuizChange(quiz: Quiz) {
    try {
      if (quiz.auto_mode_enabled) {
        // Check if auto mode is paused
        if (quiz.auto_mode_paused) {
          // If paused, clear next activation time but keep the state
          const state = this.activeAutoModes.get(quiz.id);
          if (state) {
            state.nextActivationTime = null;
          }
        } else {
          // Check if auto mode is already running for this quiz
          if (!this.activeAutoModes.has(quiz.id)) {
            // Start auto mode for this quiz
            await this.startAutoMode(quiz);
          } else {
            const state = this.activeAutoModes.get(quiz.id);
            // If state exists but next activation time is null (was paused), resume it
            if (state && !state.nextActivationTime) {
              await this.resumeAutoMode(quiz.id, state);
            }
          }
        }
      } else {
        // Stop auto mode if it's disabled
        if (this.activeAutoModes.has(quiz.id)) {
          await this.stopAutoMode(quiz.id);
        }
      }
    } catch (error) {
      console.error(`Error handling quiz change for ${quiz.id}:`, error);
    }
  }

  /**
   * Check for live quizzes with auto mode enabled and manage their auto cycling
   */
  private async checkAndManageAutoModes() {
    try {
      // Get all live quizzes using Sequelize model
      const liveQuizzes = await this.quizModel.findAll({
        where: {
          status: QuizStatus.LIVE,
        },
      }) as unknown as Quiz[];

      if (!liveQuizzes || liveQuizzes.length === 0) {
        // Stop all auto modes if no live quizzes
        this.activeAutoModes.clear();
        return;
      }

      // Process each live quiz
      for (const quiz of liveQuizzes) {
        if (quiz.auto_mode_enabled) {
          // Check if auto mode is paused
          if (quiz.auto_mode_paused) {
            // If paused, clear next activation time but keep the state
            const state = this.activeAutoModes.get(quiz.id);
            if (state) {
              state.nextActivationTime = null;
            }
          } else {
          // Check if auto mode is already running for this quiz
          if (!this.activeAutoModes.has(quiz.id)) {
            // Start auto mode for this quiz
            await this.startAutoMode(quiz);
          } else {
              const state = this.activeAutoModes.get(quiz.id);
              // If state exists but next activation time is null (was paused), resume it
              if (state && !state.nextActivationTime) {
                await this.resumeAutoMode(quiz.id, state);
              }
              // Note: We don't verify settings on every check to reduce queries
              // Settings are verified when auto mode is started or when explicitly restarted
            }
          }
        } else {
          // Stop auto mode if it's disabled
          if (this.activeAutoModes.has(quiz.id)) {
            await this.stopAutoMode(quiz.id);
          }
        }
      }

      // Stop auto modes for quizzes that are no longer live
      for (const [quizId, state] of this.activeAutoModes.entries()) {
        const isStillLive = liveQuizzes.some((q) => q.id === quizId);
        if (!isStillLive) {
          await this.stopAutoMode(quizId);
        }
      }
    } catch (error) {
      console.error('Error checking auto modes:', error);
    }
  }

  /**
   * Start auto mode for a quiz
   */
  private async startAutoMode(quiz: Quiz) {
    try {
      // Get all questions for this quiz, sorted by order_index using raw SQL (same pattern as quiz.service.ts)
      const sequelize = this.questionModel.sequelize;
      if (!sequelize) {
        throw new Error('Sequelize instance not available');
      }

      const questionsResult = await sequelize.query(
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
          replacements: { quizId: quiz.id },
          type: QueryTypes.SELECT,
        }
      ) as Array<any>;

      // Convert PostgreSQL timestamp strings to ISO strings
      const questions = questionsResult.map(q => ({
        ...q,
        started_at: q.started_at ? new Date(q.started_at + 'Z').toISOString() : undefined,
        ended_at: q.ended_at ? new Date(q.ended_at + 'Z').toISOString() : undefined,
        created_at: q.created_at ? new Date(q.created_at + 'Z').toISOString() : q.created_at,
        updated_at: q.updated_at ? new Date(q.updated_at + 'Z').toISOString() : q.updated_at,
      })) as QuizQuestion[];

      if (!questions || questions.length === 0) {
        return;
      }

      // Find the current active question or start from the first pending question
      // Skip questions that are already completed (status = COMPLETED)
      let currentIndex = 0;
      const activeQuestionIndex = questions.findIndex(
        (q) => q.is_active && q.status === QuestionStatus.LIVE
      );

      if (activeQuestionIndex >= 0) {
        // There's an active question, start from the next one
        currentIndex = activeQuestionIndex + 1;
      } else {
        // Find the first pending question (skip completed ones)
        const firstPendingIndex = questions.findIndex(
          (q) => q.status === QuestionStatus.PENDING
        );
        if (firstPendingIndex >= 0) {
          currentIndex = firstPendingIndex;
        } else {
          // All questions are completed, don't start auto mode
          return;
        }
      }

      // Skip any completed questions and find the next pending one
      while (currentIndex < questions.length && questions[currentIndex].status === QuestionStatus.COMPLETED) {
        currentIndex++;
      }

      // If we've gone through all questions, don't start auto mode
      if (currentIndex >= questions.length) {
        return;
      }

      const intervalSeconds = quiz.auto_mode_interval_seconds || 120; // Default 2 minutes

      // Activate the first question immediately if there's no active question
      if (activeQuestionIndex < 0 && currentIndex < questions.length) {
        const firstQuestion = questions[currentIndex];
        try {
          await this.quizService.activateQuestion(firstQuestion.id);
          currentIndex++;
          // For the first question, set next activation time to when it ends + interval
          // We'll update this when the question actually ends
          const firstQuestionTimeLimit = firstQuestion.time_limit_seconds || 120;
          const nextActivationTime = new Date(Date.now() + (firstQuestionTimeLimit + intervalSeconds) * 1000);
          this.activeAutoModes.set(quiz.id, {
            quizId: quiz.id,
            nextActivationTime,
            questionIndex: currentIndex,
            questions,
            intervalSeconds,
          });
          return; // Exit early, cron will handle next question after first one ends
        } catch (error) {
          console.error(`Error activating first question in auto mode:`, error);
        }
      }

      // If there's an active question, calculate next activation time based on when it ends
      let nextActivationTime: Date;
      if (activeQuestionIndex >= 0) {
        const activeQuestion = questions[activeQuestionIndex];
        const timeLimit = activeQuestion.time_limit_seconds || 120;
        const startedAt = activeQuestion.started_at ? new Date(activeQuestion.started_at).getTime() : Date.now();
        const endTime = startedAt + (timeLimit * 1000);
        // Next activation = question end time + interval
        nextActivationTime = new Date(endTime + (intervalSeconds * 1000));
      } else {
        // No active question, use current time + interval (shouldn't happen but fallback)
        nextActivationTime = new Date(Date.now() + intervalSeconds * 1000);
      }

      this.activeAutoModes.set(quiz.id, {
        quizId: quiz.id,
        nextActivationTime,
        questionIndex: currentIndex,
        questions,
        intervalSeconds,
      });
    } catch (error) {
      console.error(`Error starting auto mode for quiz ${quiz.id}:`, error);
    }
  }

  /**
   * Activate the next question in the sequence
   * Note: This method assumes the current question has already been ended
   */
  private async activateNextQuestion(
    quizId: string,
    questions: QuizQuestion[],
    currentIndex: number
  ) {
    try {
      const state = this.activeAutoModes.get(quizId);
      if (!state) {
        return;
      }

      // Note: Current question ending is now handled in checkAndActivateQuestions
      // before this method is called, so we don't end it here anymore

      // Skip any completed questions
      while (currentIndex < questions.length && questions[currentIndex].status === QuestionStatus.COMPLETED) {
        currentIndex++;
      }

      // Check if we have more questions
      if (currentIndex >= questions.length) {
        // All questions completed, stop auto mode and set quiz to draft
        await this.stopAutoMode(quizId);
        return;
      }

      // Activate the next question (only if it's pending)
      const nextQuestion = questions[currentIndex];
      if (nextQuestion.status === QuestionStatus.PENDING) {
        try {
          await this.quizService.activateQuestion(nextQuestion.id);
          // Update state - questionIndex will be incremented by cron handler
          // Don't increment here to avoid double increment
        } catch (error) {
          console.error(`Error activating next question in auto mode:`, error);
        }
      } else if (nextQuestion.status === QuestionStatus.COMPLETED) {
        // Should not happen due to skip above, but handle gracefully
        // Skip to next question
      } else {
        // Question is already live or in an unexpected state, skip to next
        // Don't increment here - let cron handler manage it
      }
    } catch (error) {
      console.error(`Error in activateNextQuestion:`, error);
    }
  }

  /**
   * Resume auto mode for a quiz (after being paused)
   */
  private async resumeAutoMode(quizId: string, state: AutoModeState) {
    try {
      const quiz = await this.quizModel.findByPk(quizId) as unknown as Quiz | null;
      if (!quiz || !quiz.auto_mode_enabled || quiz.status !== QuizStatus.LIVE || quiz.auto_mode_paused) {
        return;
      }

      const intervalSeconds = quiz.auto_mode_interval_seconds || state.intervalSeconds || 120;
      
      // Calculate next activation time (current time + interval)
      const nextActivationTime = new Date(Date.now() + intervalSeconds * 1000);

      // Update state with new activation time and interval
      state.nextActivationTime = nextActivationTime;
      state.intervalSeconds = intervalSeconds;
      this.activeAutoModes.set(quizId, state);
    } catch (error) {
      console.error(`Error resuming auto mode for quiz ${quizId}:`, error);
    }
  }

  /**
   * Cron job handler: Check for questions that need to be activated
   * Runs every second for precise timing (lightweight check - only processes when activation time is reached)
   */
  private async checkAndActivateQuestions() {
    const now = new Date();
    
    for (const [quizId, state] of this.activeAutoModes.entries()) {
      // Skip if paused or no activation time set
      if (!state.nextActivationTime) {
        continue;
      }

      // Check if it's time to activate the next question
      if (now >= state.nextActivationTime) {
        try {
          // Verify quiz is still live and auto mode is still enabled before proceeding
          const quiz = await this.quizModel.findByPk(quizId) as unknown as Quiz | null;
          if (!quiz || quiz.status !== QuizStatus.LIVE || !quiz.auto_mode_enabled || quiz.auto_mode_paused) {
            // Quiz is no longer valid for auto mode, stop it
            await this.stopAutoMode(quizId);
            continue;
          }

          const currentQuestionIndex = state.questionIndex;
          
          // First, end the current active question if it exists and hasn't been ended yet
          const activeQuestion = state.questions.find(
            (q) => q.is_active && q.status === QuestionStatus.LIVE
          );
          
          if (activeQuestion) {
            // Check if question has expired (time limit reached)
            const currentQuestion = await this.quizService.getQuestionById(activeQuestion.id);
            if (currentQuestion && currentQuestion.is_active && currentQuestion.status === QuestionStatus.LIVE) {
              const timeLimit = currentQuestion.time_limit_seconds || 120;
              const startedAt = currentQuestion.started_at ? new Date(currentQuestion.started_at).getTime() : Date.now();
              const elapsed = Math.floor((now.getTime() - startedAt) / 1000);
              
              // Only end if question has expired (elapsed >= time limit)
              if (elapsed >= timeLimit) {
                try {
                  await this.quizService.endQuestion(activeQuestion.id, false);
                  await this.quizGateway.emitQuestionEnded(quizId, activeQuestion);
                  
                  // Check if this was the last question (no more questions after current index)
                  if (state.questionIndex >= state.questions.length) {
                    // This was the last question - stop auto mode now that it's ended
                    console.log(`Auto mode: Last question ${activeQuestion.id} ended. Stopping auto mode.`);
                    await this.stopAutoMode(quizId);
                    continue; // Skip to next quiz
                  } else {
                    console.log(`Auto mode: Ended question ${activeQuestion.id} (expired after ${elapsed}s), interval of ${state.intervalSeconds}s has passed, activating next question`);
                  }
                } catch (error) {
                  console.error(`Error ending question in auto mode:`, error);
                }
              } else {
                // Question hasn't expired yet - recalculate nextActivationTime
                const endTime = startedAt + (timeLimit * 1000);
                // If this is the last question, nextActivationTime should be just the end time (no interval)
                // Otherwise, add the interval
                const isLastQuestion = state.questionIndex >= state.questions.length;
                const nextActivationTime = isLastQuestion 
                  ? new Date(endTime)
                  : new Date(endTime + (state.intervalSeconds * 1000));
                state.nextActivationTime = nextActivationTime;
                this.activeAutoModes.set(quizId, state);
                console.log(`Auto mode: Question ${activeQuestion.id} still active (${elapsed}s/${timeLimit}s), next activation at ${nextActivationTime.toISOString()}`);
                continue; // Skip to next quiz, this one isn't ready yet
              }
            }
          }
          
          // At this point, either:
          // 1. There was no active question, OR
          // 2. The active question has been ended and the interval has passed
          // So we can now activate the next question
          
          // Activate the next question
          await this.activateNextQuestion(quizId, state.questions, currentQuestionIndex);
          
          // Calculate next activation time and increment question index (only if auto mode is still active)
          if (this.activeAutoModes.has(quizId)) {
            const updatedState = this.activeAutoModes.get(quizId);
            if (updatedState) {
              // Refresh questions to get updated state
              const sequelize = this.questionModel.sequelize;
              if (sequelize) {
                const questionsResult = await sequelize.query(
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
                
                const questions = questionsResult.map(q => ({
                  ...q,
                  started_at: q.started_at ? new Date(q.started_at + 'Z').toISOString() : undefined,
                  ended_at: q.ended_at ? new Date(q.ended_at + 'Z').toISOString() : undefined,
                  created_at: q.created_at ? new Date(q.created_at + 'Z').toISOString() : q.created_at,
                  updated_at: q.updated_at ? new Date(q.updated_at + 'Z').toISOString() : q.updated_at,
                })) as QuizQuestion[];
                updatedState.questions = questions;
              }
              
              // Find the newly activated question to calculate its end time
              const newlyActivatedQuestion = updatedState.questions.find(
                (q) => q.is_active && q.status === QuestionStatus.LIVE
              );
              
              if (newlyActivatedQuestion && newlyActivatedQuestion.started_at) {
                // Calculate: next question end time + interval
                const timeLimit = newlyActivatedQuestion.time_limit_seconds || 120;
                const startedAt = new Date(newlyActivatedQuestion.started_at).getTime();
                const endTime = startedAt + (timeLimit * 1000);
                
                // Increment index and skip any completed questions
                let nextIndex = currentQuestionIndex + 1;
                while (nextIndex < updatedState.questions.length && 
                       updatedState.questions[nextIndex].status === QuestionStatus.COMPLETED) {
                  nextIndex++;
                }
                
                updatedState.questionIndex = nextIndex;
                
                // Check if this is the last question (no more questions after this one)
                if (updatedState.questionIndex >= updatedState.questions.length) {
                  // This is the last question - set nextActivationTime to when it ends (no interval)
                  // When this question ends, we'll stop auto mode
                  updatedState.nextActivationTime = new Date(endTime);
                  console.log(`Auto mode: Last question activated. Will stop auto mode when it ends at ${updatedState.nextActivationTime.toISOString()}`);
                } else {
                  // Not the last question - set next activation to end time + interval
                  updatedState.nextActivationTime = new Date(endTime + (updatedState.intervalSeconds * 1000));
                  console.log(`Auto mode: Next question will activate at ${updatedState.nextActivationTime.toISOString()} (after current question ends + ${updatedState.intervalSeconds}s interval)`);
                }
                this.activeAutoModes.set(quizId, updatedState);
              } else {
                // No active question found - increment index and check if done
                let nextIndex = currentQuestionIndex + 1;
                while (nextIndex < updatedState.questions.length && 
                       updatedState.questions[nextIndex].status === QuestionStatus.COMPLETED) {
                  nextIndex++;
                }
                
                updatedState.questionIndex = nextIndex;
                
                // Check if all questions are done (no active question and no more questions)
                if (updatedState.questionIndex >= updatedState.questions.length) {
                  await this.stopAutoMode(quizId);
                } else {
                  // Fallback: current time + interval (shouldn't happen)
                  updatedState.nextActivationTime = new Date(now.getTime() + updatedState.intervalSeconds * 1000);
                  this.activeAutoModes.set(quizId, updatedState);
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error in cron job activating question for quiz ${quizId}:`, error);
          // On error, don't increment questionIndex to allow retry on next cron run
          // But update nextActivationTime to prevent immediate retry (add small delay)
          const updatedState = this.activeAutoModes.get(quizId);
          if (updatedState) {
            updatedState.nextActivationTime = new Date(now.getTime() + 5000); // Retry in 5 seconds
            this.activeAutoModes.set(quizId, updatedState);
          }
        }
      }
    }
  }

  /**
   * Manually start the next question in auto mode (bypasses timing)
   * This allows admins to manually advance to the next question
   * @param quizId - The quiz ID
   */
  async startNextQuestion(quizId: string): Promise<{ success: boolean; message: string }> {
    const state = this.activeAutoModes.get(quizId);
    if (!state) {
      throw new Error(`Auto mode is not active for quiz ${quizId}`);
    }

    // Verify quiz is still live and auto mode is still enabled
    const quiz = await this.quizModel.findByPk(quizId) as unknown as Quiz | null;
    if (!quiz || quiz.status !== QuizStatus.LIVE || !quiz.auto_mode_enabled || quiz.auto_mode_paused) {
      throw new Error(`Quiz ${quizId} is not in a valid state for auto mode`);
    }

    const now = new Date();
    const currentQuestionIndex = state.questionIndex;

    // End the current active question if it exists
    const activeQuestion = state.questions.find(
      (q) => q.is_active && q.status === QuestionStatus.LIVE
    );

    if (activeQuestion) {
      try {
        const currentQuestion = await this.quizService.getQuestionById(activeQuestion.id);
        if (currentQuestion && currentQuestion.is_active && currentQuestion.status === QuestionStatus.LIVE) {
          await this.quizService.endQuestion(activeQuestion.id, false);
          await this.quizGateway.emitQuestionEnded(quizId, activeQuestion);
          console.log(`Auto mode: Manually ended question ${activeQuestion.id} to start next question`);
        }
      } catch (error) {
        console.error(`Error ending question in auto mode:`, error);
      }
    }

    // Activate the next question
    await this.activateNextQuestion(quizId, state.questions, currentQuestionIndex);

    // Update state with new activation time
    if (this.activeAutoModes.has(quizId)) {
      const updatedState = this.activeAutoModes.get(quizId);
      if (updatedState) {
        // Refresh questions to get updated state
        const sequelize = this.questionModel.sequelize;
        if (sequelize) {
          const questionsResult = await sequelize.query(
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
          
          const questions = questionsResult.map(q => ({
            ...q,
            started_at: q.started_at ? new Date(q.started_at + 'Z').toISOString() : undefined,
            ended_at: q.ended_at ? new Date(q.ended_at + 'Z').toISOString() : undefined,
            created_at: q.created_at ? new Date(q.created_at + 'Z').toISOString() : q.created_at,
            updated_at: q.updated_at ? new Date(q.updated_at + 'Z').toISOString() : q.updated_at,
          })) as QuizQuestion[];
          updatedState.questions = questions;
        }

        // Find the newly activated question to calculate its end time
        const newlyActivatedQuestion = updatedState.questions.find(
          (q) => q.is_active && q.status === QuestionStatus.LIVE
        );

        if (newlyActivatedQuestion && newlyActivatedQuestion.started_at) {
          // Calculate: next question end time + interval
          const timeLimit = newlyActivatedQuestion.time_limit_seconds || 120;
          const startedAt = new Date(newlyActivatedQuestion.started_at).getTime();
          const endTime = startedAt + (timeLimit * 1000);
          
          // Increment index and skip any completed questions
          let nextIndex = currentQuestionIndex + 1;
          while (nextIndex < updatedState.questions.length && 
                 updatedState.questions[nextIndex].status === QuestionStatus.COMPLETED) {
            nextIndex++;
          }

          updatedState.questionIndex = nextIndex;

          // Check if this is the last question (no more questions after this one)
          if (updatedState.questionIndex >= updatedState.questions.length) {
            // This is the last question - set nextActivationTime to when it ends (no interval)
            // When this question ends, we'll stop auto mode
            updatedState.nextActivationTime = new Date(endTime);
            console.log(`Auto mode: Last question manually started. Will stop auto mode when it ends at ${updatedState.nextActivationTime.toISOString()}`);
            this.activeAutoModes.set(quizId, updatedState);
            return {
              success: true,
              message: 'Last question started. Auto mode will stop when this question ends.',
            };
          } else {
            // Not the last question - set next activation to end time + interval
            updatedState.nextActivationTime = new Date(endTime + (updatedState.intervalSeconds * 1000));
            console.log(`Auto mode: Next question manually started. Next auto activation at ${updatedState.nextActivationTime.toISOString()}`);
            this.activeAutoModes.set(quizId, updatedState);
          }
        } else {
          // No active question found - increment index and check if done
          let nextIndex = currentQuestionIndex + 1;
          while (nextIndex < updatedState.questions.length && 
                 updatedState.questions[nextIndex].status === QuestionStatus.COMPLETED) {
            nextIndex++;
          }

          updatedState.questionIndex = nextIndex;

          // Check if all questions are done (no active question and no more questions)
          if (updatedState.questionIndex >= updatedState.questions.length) {
            await this.stopAutoMode(quizId);
            return {
              success: true,
              message: 'All questions completed - auto mode stopped.',
            };
          } else {
            // Fallback: current time + interval (shouldn't happen)
            updatedState.nextActivationTime = new Date(now.getTime() + updatedState.intervalSeconds * 1000);
            this.activeAutoModes.set(quizId, updatedState);
          }
        }
      }
    }

    return {
      success: true,
      message: 'Next question started successfully',
    };
  }

  /**
   * Stop auto mode for a quiz
   * @param quizId - The quiz ID to stop auto mode for
   * @param skipDraftUpdate - If true, skip setting quiz to completed and disabling auto mode (used when manually setting to draft)
   */
  async stopAutoMode(quizId: string, skipDraftUpdate: boolean = false) {
    // Remove from active auto modes
    this.activeAutoModes.delete(quizId);
    
    // When auto mode completes all questions, disable auto mode and set quiz status to completed
    if (!skipDraftUpdate) {
      try {
        const quiz = await this.quizModel.findByPk(quizId) as unknown as Quiz | null;
        if (quiz && quiz.status === QuizStatus.LIVE) {
          // Disable auto mode and set quiz status to completed
          await this.quizService.updateQuiz(quizId, {
            status: QuizStatus.COMPLETED,
            auto_mode_enabled: false,
            auto_mode_paused: false, // Also reset pause state
          });
          console.log(`Auto mode completed for quiz ${quizId}. Auto mode disabled and quiz set to completed.`);
        }
      } catch (error) {
        console.error(`Error disabling auto mode and setting quiz to completed after completion:`, error);
      }
    }
  }

  /**
   * Manually restart auto mode for a quiz (useful when quiz settings change)
   */
  async restartAutoMode(quizId: string) {
    // Clear the auto mode state without setting quiz to draft (we're restarting, not stopping)
    this.activeAutoModes.delete(quizId);
    
    // Immediately check if quiz is live and should have auto mode, then start it
    try {
      const quiz = await this.quizModel.findByPk(quizId) as unknown as Quiz | null;
      if (quiz && quiz.status === QuizStatus.LIVE && quiz.auto_mode_enabled && !quiz.auto_mode_paused) {
        await this.startAutoMode(quiz);
      }
    } catch (error) {
      console.error(`Error restarting auto mode for quiz ${quizId}:`, error);
      // Fallback: let checkAndManageAutoModes handle it
      await this.checkAndManageAutoModes();
    }
  }

  /**
   * Get next question activation time for a quiz (for admin display)
   */
  getNextActivationTime(quizId: string): Date | null {
    const state = this.activeAutoModes.get(quizId);
    return state?.nextActivationTime || null;
  }
}

