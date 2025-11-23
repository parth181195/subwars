import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Inject, forwardRef, OnModuleDestroy } from '@nestjs/common';
import { QuizService } from './quiz.service';
import { AnswerService } from '../answer/answer.service';

interface QuizJoinData {
  quizId: string;
  userId?: string;
}

interface AnswerSubmissionData {
  quizId: string;
  questionId: string;
  answer: string;
  userId: string;
}

@WebSocketGateway({
  cors: {
    origin: '*', // Configure properly for production
    credentials: true,
  },
  namespace: '/quiz',
})
export class QuizGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(QuizGateway.name);
  private quizRooms: Map<string, Set<string>> = new Map(); // quizId -> Set of socketIds

  private expiredQuestionCheckInterval: NodeJS.Timeout | null = null;
  
  // Leaderboard update throttling (to avoid excessive DB queries)
  private leaderboardUpdateTimers: Map<string, NodeJS.Timeout> = new Map();
  private leaderboardCache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly LEADERBOARD_UPDATE_THROTTLE = 2000; // Update at most once every 2 seconds
  private readonly LEADERBOARD_CACHE_TTL = 1000; // Cache for 1 second

  constructor(
    @Inject(forwardRef(() => QuizService))
    private readonly quizService: QuizService,
    @Inject(forwardRef(() => AnswerService))
    private readonly answerService: AnswerService,
  ) {}

  afterInit(server: Server) {
    // Server is now initialized, start checking for expired questions every 5 seconds
    this.expiredQuestionCheckInterval = setInterval(async () => {
      await this.checkAndEndExpiredQuestions();
    }, 5000);
    this.logger.log('QuizGateway initialized and expired question checker started');
  }

  async checkAndEndExpiredQuestions() {
    try {
      const expiredQuestions = await this.quizService.checkAndEndExpiredQuestions();
      
      if (!expiredQuestions || expiredQuestions.length === 0) {
        return;
      }

      // End each expired question and emit events
      for (const expired of expiredQuestions) {
        const endedQuestion = await this.quizService.endQuestion(expired.id);
        await this.emitQuestionEnded(expired.quiz_id, endedQuestion);
        this.logger.log(`Automatically ended expired question ${expired.id} in quiz ${expired.quiz_id}`);
      }
    } catch (error) {
      this.logger.error(`Error in expired question check: ${error.message}`, error.stack);
    }
  }

  async handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    
    // Remove client from all quiz rooms
    for (const [quizId, sockets] of this.quizRooms.entries()) {
      if (sockets.has(client.id)) {
        sockets.delete(client.id);
        client.leave(`quiz:${quizId}`);
        
        if (sockets.size === 0) {
          this.quizRooms.delete(quizId);
        }
      }
    }
  }

  onModuleDestroy() {
    // Clean up interval on module destroy
    if (this.expiredQuestionCheckInterval) {
      clearInterval(this.expiredQuestionCheckInterval);
      this.expiredQuestionCheckInterval = null;
    }
    
    // Clear all leaderboard update timers
    this.leaderboardUpdateTimers.forEach((timer) => clearTimeout(timer));
    this.leaderboardUpdateTimers.clear();
    this.leaderboardCache.clear();
  }

  @SubscribeMessage('join-quiz')
  async handleJoinQuiz(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: QuizJoinData,
  ) {
    try {
      const { quizId, userId } = data;
      
      if (!quizId) {
        client.emit('error', { message: 'Quiz ID is required' });
        return;
      }

      // Join the quiz room
      const roomName = `quiz:${quizId}`;
      await client.join(roomName);
      
      // Track this client in the quiz room
      if (!this.quizRooms.has(quizId)) {
        this.quizRooms.set(quizId, new Set());
      }
      this.quizRooms.get(quizId)!.add(client.id);

      // Store userId in socket data
      if (userId) {
        client.data.userId = userId;
        client.data.quizId = quizId;
      }

      this.logger.log(`Client ${client.id} joined quiz ${quizId}`);

      // Send current active question if any
      const activeQuestion = await this.quizService.getCurrentActiveQuestion(quizId);
      if (activeQuestion) {
        // Sanitize question for frontend (remove answer, mask voice line URLs)
        const sanitizedQuestion = this.sanitizeQuestionForFrontend(activeQuestion);
        client.emit('question-live', {
          question: sanitizedQuestion,
          timeRemaining: this.calculateTimeRemaining(activeQuestion),
        });
      }

      client.emit('joined-quiz', { quizId, success: true });
    } catch (error) {
      this.logger.error(`Error joining quiz: ${error.message}`, error.stack);
      client.emit('error', { message: 'Failed to join quiz' });
    }
  }

  @SubscribeMessage('leave-quiz')
  async handleLeaveQuiz(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { quizId: string },
  ) {
    try {
      const { quizId } = data;
      const roomName = `quiz:${quizId}`;
      
      await client.leave(roomName);
      
      if (this.quizRooms.has(quizId)) {
        this.quizRooms.get(quizId)!.delete(client.id);
        if (this.quizRooms.get(quizId)!.size === 0) {
          this.quizRooms.delete(quizId);
        }
      }

      this.logger.log(`Client ${client.id} left quiz ${quizId}`);
      client.emit('left-quiz', { quizId, success: true });
    } catch (error) {
      this.logger.error(`Error leaving quiz: ${error.message}`, error.stack);
      client.emit('error', { message: 'Failed to leave quiz' });
    }
  }

  @SubscribeMessage('submit-answer')
  async handleSubmitAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: AnswerSubmissionData,
  ) {
    try {
      const { quizId, questionId, answer, userId } = data;

      if (!quizId || !questionId || !answer || !userId) {
        client.emit('error', { message: 'Missing required fields' });
        return;
      }

      // Get question to check if it's still active
      const question = await this.quizService.getQuestionById(questionId);
      if (!question || !question.is_active || question.status !== 'live') {
        client.emit('answer-rejected', {
          message: 'Question is not currently active',
        });
        return;
      }

      // Submit answer
      const submittedAnswer = await this.answerService.submitAnswer({
        user_id: userId,
        quiz_id: quizId,
        question_id: questionId,
        answer: answer,
      });

      // Emit answer submitted event
      client.emit('answer-submitted', {
        answer: submittedAnswer,
        success: true,
      });

      // Notify admin about new answer (broadcast to admin clients in the room)
      this.server.to(`quiz:${quizId}`).emit('new-answer', {
        answer: submittedAnswer,
        questionId,
      });

      // Update leaderboard for all clients in the quiz (throttled)
      this.scheduleLeaderboardUpdate(quizId);

      this.logger.log(`Answer submitted by user ${userId} for question ${questionId}`);
    } catch (error) {
      this.logger.error(`Error submitting answer: ${error.message}`, error.stack);
      client.emit('error', { 
        message: error.message || 'Failed to submit answer',
      });
    }
  }

  /**
   * Mask hero name in voice line URLs to prevent revealing the answer
   * Returns a proxy URL that doesn't reveal the hero name
   */
  private maskVoiceLineUrl(url: string, questionId?: string): string {
    if (!url || typeof url !== 'string') return url;
    
    // If we have a questionId, return a proxy URL
    if (questionId) {
      return `/api/quiz/voice-line/${questionId}`;
    }
    
    // Fallback: Replace hero name with generic identifier (for display only)
    const urlPattern = /\/voicelines\/([^\/]+)\//;
    const match = url.match(urlPattern);
    
    if (match && match[1]) {
      return url.replace(`/voicelines/${match[1]}/`, '/voicelines/hero/');
    }
    
    return url;
  }

  /**
   * Sanitize question object for frontend - remove answer and mask voice line URLs
   */
  private sanitizeQuestionForFrontend(question: any): any {
    const sanitized = { ...question };
    
    // Remove the answer
    delete sanitized.correct_answer_hero;
    
    // Mask voice line URLs if it's a voice line question
    if (sanitized.question_type === 'voice_line' && sanitized.question_content) {
      sanitized.question_content = this.maskVoiceLineUrl(sanitized.question_content, sanitized.id);
    }
    
    return sanitized;
  }

  // Public methods to emit events from services
  async emitQuestionLive(quizId: string, question: any) {
    if (!this.server) {
      this.logger.warn('WebSocket server not initialized, cannot emit question-live event');
      return;
    }

    const roomName = `quiz:${quizId}`;
    const timeRemaining = this.calculateTimeRemaining(question);
    
    // Sanitize question for frontend (remove answer, mask voice line URLs)
    const sanitizedQuestion = this.sanitizeQuestionForFrontend(question);

    // Broadcast to quiz participants
    this.server.to(roomName).emit('question-live', {
      question: sanitizedQuestion,
      timeRemaining,
    });

    // Also broadcast to all clients for global notification (home page toaster)
    this.server.emit('question-live', {
      question: sanitizedQuestion,
      timeRemaining,
    });

    this.logger.log(`Question ${question.id} went live for quiz ${quizId}`);
  }

  async emitQuestionEnded(quizId: string, question: any) {
    if (!this.server) {
      this.logger.warn('WebSocket server not initialized, cannot emit question-ended event');
      return;
    }

    const roomName = `quiz:${quizId}`;
    
    // Sanitize question for frontend (remove answer, mask voice line URLs)
    const sanitizedQuestion = this.sanitizeQuestionForFrontend(question);
    
    // Include correct answer in the event (needed for result popup)
    this.server.to(roomName).emit('question-ended', {
      question: {
        ...sanitizedQuestion,
        correct_answer_hero: question.correct_answer_hero, // Include correct answer for result popup
      },
    });

    // Find and announce the fastest correct answer winner
    await this.announceQuestionWinner(quizId, question);

    // Broadcast final leaderboard
    await this.broadcastLeaderboard(quizId);

    this.logger.log(`Question ${question.id} ended for quiz ${quizId}`);
  }

  /**
   * Announce the fastest correct answer winner for a question
   */
  private async announceQuestionWinner(quizId: string, question: any) {
    if (!this.server) return;

    try {
      // Get all answers for this question
      const answers = await this.answerService.getAnswersByQuestionId(question.id);
      
      // Filter correct answers with response time
      const correctAnswers = answers
        .filter(a => a.is_correct && a.response_time !== null && a.response_time !== undefined)
        .sort((a, b) => (a.response_time || 0) - (b.response_time || 0));

      if (correctAnswers.length === 0) {
        this.logger.log(`No correct answers found for question ${question.id}`);
        return;
      }

      const winner = correctAnswers[0];
      
      // Get user info
      const { data: user } = await this.quizService['supabase']
        .from('users')
        .select('in_game_name, full_name')
        .eq('id', winner.user_id)
        .single();

      const userName = user?.in_game_name || user?.full_name || 'Anonymous';

      const winnerData = {
        winner: {
          user_name: userName,
          user_id: winner.user_id,
          response_time: winner.response_time || 0,
          score: winner.score || 0,
        },
        questionNumber: question.order_index + 1,
        questionId: question.id,
      };

      // Broadcast to all clients (not just quiz participants) for global announcement
      this.server.emit('question-winner', winnerData);
      this.logger.log(`Question ${question.id} winner: ${userName} (${winner.response_time}ms)`);
    } catch (error) {
      this.logger.error(`Error announcing question winner: ${error.message}`, error.stack);
    }
  }

  /**
   * Announce top 3 winners when quiz is completed
   */
  async announceQuizWinners(quizId: string) {
    if (!this.server) {
      this.logger.warn('WebSocket server not initialized, cannot announce quiz winners');
      return;
    }

    try {
      // Get leaderboard
      const leaderboard = await this.quizService.getQuizLeaderboard(quizId);
      
      // Get top 3
      const top3 = leaderboard.slice(0, 3);

      if (top3.length === 0) {
        this.logger.log(`No winners found for quiz ${quizId}`);
        return;
      }

      // Get quiz name
      const { data: quiz } = await this.quizService['supabase']
        .from('quizzes')
        .select('name')
        .eq('id', quizId)
        .single();

      const winnersData = {
        winners: top3.map((entry) => ({
          user_name: entry.user_name,
          total_score: entry.total_score,
          correct_answers: entry.correct_answers,
        })),
        quizName: quiz?.name || 'Quiz',
        quizId: quizId,
      };

      // Broadcast to all clients (not just quiz participants) for global announcement
      this.server.emit('quiz-winners', winnersData);
      this.logger.log(`Quiz ${quizId} winners announced: ${top3.map(w => w.user_name).join(', ')}`);
    } catch (error) {
      this.logger.error(`Error announcing quiz winners: ${error.message}`, error.stack);
    }
  }

  /**
   * Schedule a leaderboard update (throttled to avoid excessive DB queries)
   */
  private scheduleLeaderboardUpdate(quizId: string) {
    // Clear existing timer if any
    const existingTimer = this.leaderboardUpdateTimers.get(quizId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Schedule new update
    const timer = setTimeout(() => {
      this.broadcastLeaderboard(quizId);
      this.leaderboardUpdateTimers.delete(quizId);
    }, this.LEADERBOARD_UPDATE_THROTTLE);

    this.leaderboardUpdateTimers.set(quizId, timer);
  }

  async broadcastLeaderboard(quizId: string) {
    try {
      if (!this.server) {
        this.logger.warn('WebSocket server not initialized, cannot broadcast leaderboard');
        return;
      }

      // Check cache first
      const cached = this.leaderboardCache.get(quizId);
      const now = Date.now();
      let leaderboard;

      if (cached && (now - cached.timestamp) < this.LEADERBOARD_CACHE_TTL) {
        // Use cached data
        leaderboard = cached.data;
      } else {
        // Fetch from database
        leaderboard = await this.quizService.getQuizLeaderboard(quizId);
        // Update cache
        this.leaderboardCache.set(quizId, { data: leaderboard, timestamp: now });
      }

      const roomName = `quiz:${quizId}`;
      
      this.server.to(roomName).emit('leaderboard-updated', {
        leaderboard,
      });
    } catch (error) {
      this.logger.error(`Error broadcasting leaderboard: ${error.message}`, error.stack);
    }
  }

  private calculateTimeRemaining(question: any): number | null {
    if (!question.started_at || !question.time_limit_seconds) {
      return null;
    }

    const startTime = new Date(question.started_at).getTime();
    const now = Date.now();
    const elapsed = Math.floor((now - startTime) / 1000); // seconds
    const timeLimit = question.time_limit_seconds;
    const remaining = Math.max(0, timeLimit - elapsed);

    return remaining;
  }
}

