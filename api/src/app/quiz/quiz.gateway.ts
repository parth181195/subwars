import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Inject, forwardRef } from '@nestjs/common';
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
export class QuizGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(QuizGateway.name);
  private quizRooms: Map<string, Set<string>> = new Map(); // quizId -> Set of socketIds

  constructor(
    @Inject(forwardRef(() => QuizService))
    private readonly quizService: QuizService,
    @Inject(forwardRef(() => AnswerService))
    private readonly answerService: AnswerService,
  ) {}

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
        client.emit('question-live', {
          question: activeQuestion,
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

      // Update leaderboard for all clients in the quiz
      await this.broadcastLeaderboard(quizId);

      this.logger.log(`Answer submitted by user ${userId} for question ${questionId}`);
    } catch (error) {
      this.logger.error(`Error submitting answer: ${error.message}`, error.stack);
      client.emit('error', { 
        message: error.message || 'Failed to submit answer',
      });
    }
  }

  // Public methods to emit events from services
  async emitQuestionLive(quizId: string, question: any) {
    const roomName = `quiz:${quizId}`;
    const timeRemaining = this.calculateTimeRemaining(question);

    this.server.to(roomName).emit('question-live', {
      question,
      timeRemaining,
    });

    this.logger.log(`Question ${question.id} went live for quiz ${quizId}`);
  }

  async emitQuestionEnded(quizId: string, question: any) {
    const roomName = `quiz:${quizId}`;
    
    this.server.to(roomName).emit('question-ended', {
      question,
    });

    // Broadcast final leaderboard
    await this.broadcastLeaderboard(quizId);

    this.logger.log(`Question ${question.id} ended for quiz ${quizId}`);
  }

  async broadcastLeaderboard(quizId: string) {
    try {
      const leaderboard = await this.quizService.getQuizLeaderboard(quizId);
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

