import { Controller, Get, Post, Param, Body, Res, HttpException, HttpStatus, BadRequestException, UseGuards, Req, Inject } from '@nestjs/common';
import { Response } from 'express';
import { QuizService } from './quiz.service';
import { QuizGateway } from './quiz.gateway';
import { BunnyStorageService } from '../storage/bunny-storage.service';
import { AnswerService } from '../answer/answer.service';
import { FirebaseAuthGuard } from './guards/firebase-auth.guard';
import * as admin from 'firebase-admin';

// In-memory cache for voice line files (for scalability)
const voiceLineCache = new Map<string, { buffer: Buffer; contentType: string; timestamp: number }>();
const CACHE_TTL = 3600000; // 1 hour in milliseconds

@Controller('quiz')
export class QuizController {
  constructor(
    private readonly quizService: QuizService,
    private readonly quizGateway: QuizGateway,
    private readonly bunnyStorageService: BunnyStorageService,
    private readonly answerService: AnswerService,
    @Inject('FIREBASE_AUTH')
    private firebaseAuth: admin.auth.Auth,
  ) {}

  /**
   * Get all active quizzes (public endpoint)
   * OPTIMIZED: Filter at database level instead of in-memory
   */
  @Get('active')
  async getActiveQuizzes() {
    return this.quizService.getActiveQuizzes();
  }

  /**
   * Get a specific quiz by ID (public endpoint - sanitized)
   * Returns quiz with user access info (for frontend to check if user can participate)
   */
  @Get(':id')
  async getQuizById(@Param('id') id: string, @Req() req?: any) {
    // Parallelize quiz fetch and token verification (if token exists)
    const authHeader = req?.headers?.authorization;
    const hasToken = authHeader && authHeader.startsWith('Bearer ');
    
    const [quiz, tokenResult] = await Promise.all([
      this.quizService.getQuizById(id),
      // Only verify token if it exists (don't waste time if no auth header)
      hasToken ? (async () => {
        try {
          const token = authHeader.substring(7);
          const decodedToken = await this.firebaseAuth.verifyIdToken(token);
          return { email: decodedToken.email || null, valid: true };
        } catch {
          return { email: null, valid: false };
        }
      })() : Promise.resolve({ email: null, valid: false }),
    ]);
    
    if (!quiz) {
      throw new HttpException('Contest not found', HttpStatus.NOT_FOUND);
    }
    
    // Return quiz
    const sanitizedQuiz = {
      ...quiz,
      can_participate: true,
    };
    
    return sanitizedQuiz;
  }

  /**
   * Get all questions for a quiz (public endpoint - sanitized)
   */
  @Get(':id/questions')
  async getQuizQuestions(@Param('id') quizId: string) {
    const questions = await this.quizService.getQuestionsByQuizId(quizId);
    // Sanitize questions (remove answers, mask voice line URLs)
    return questions.map((q) => this.sanitizeQuestion(q));
  }

  /**
   * Get the current active question for a quiz (public endpoint - sanitized)
   */
  @Get(':id/active-question')
  async getCurrentActiveQuestion(@Param('id') quizId: string) {
    const question = await this.quizService.getCurrentActiveQuestion(quizId);
    if (!question) {
      return null;
    }
    return this.sanitizeQuestion(question);
  }

  /**
   * Get combined leaderboard across all quizzes (public endpoint)
   * IMPORTANT: This route must come before :id/leaderboard to avoid route conflicts
   */
  @Get('leaderboard/combined')
  async getCombinedLeaderboard() {
    return this.quizService.getCombinedLeaderboard();
  }

  /**
   * Get leaderboard for a specific quiz (public endpoint)
   */
  @Get(':id/leaderboard')
  async getQuizLeaderboard(@Param('id') quizId: string) {
    return this.quizService.getQuizLeaderboard(quizId);
  }

  /**
   * Sanitize question object for frontend - remove answer and mask voice line URLs
   */
  private sanitizeQuestion(question: any): any {
    const sanitized = { ...question };
    delete sanitized.correct_answer_hero;
    
    // Mask voice line URLs
    if (sanitized.question_type === 'voice_line' && sanitized.question_content) {
      sanitized.question_content = `/api/quiz/voice-line/${sanitized.id}`;
    }
    
    return sanitized;
  }

  /**
   * Get top 3 fastest correct answers for a question (public endpoint)
   */
  @Get('questions/:questionId/top-answers')
  async getTopAnswers(@Param('questionId') questionId: string) {
    return this.quizService.getTopAnswers(questionId);
  }

  /**
   * Submit an answer for a question (public endpoint - requires auth)
   */
  @Post('questions/:questionId/answers')
  @UseGuards(FirebaseAuthGuard)
  async submitAnswer(
    @Param('questionId') questionId: string,
    @Body() body: { answer: string; quizId: string; userId: string; responseTime?: number },
    @Req() req: any, // To access req.user from AuthGuard
  ) {
    const { answer, quizId, userId } = body;
    const userEmail = req.user?.email;

    if (!answer || !quizId || !userId) {
      throw new BadRequestException('Missing required fields: answer, quizId, userId');
    }

    try {
      // Convert responseTime from seconds (frontend) to milliseconds (backend)
      // NOTE: Client-provided responseTime is only used for security monitoring/comparison
      // The actual response time is ALWAYS calculated server-side using server time to prevent time manipulation attacks
      const responseTimeMs = body.responseTime !== undefined 
        ? Math.round(body.responseTime * 1000) 
        : undefined;
      
      // Submit answer using the answer service
      // The answer service now uses direct Sequelize queries for maximum performance
      // Quiz restrictions are checked inside submitAnswer
      // Response time is calculated server-side to prevent client time manipulation
      const submittedAnswer = await this.answerService.submitAnswer({
        user_id: userId,
        quiz_id: quizId,
        question_id: questionId,
        answer: answer.trim(),
        response_time: responseTimeMs, // Passed for security monitoring only - actual time calculated server-side
      }, userEmail);

      // Update leaderboard (throttled)
      this.quizGateway.scheduleLeaderboardUpdate(quizId);

      return {
        answer: submittedAnswer,
        success: true,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error.message || 'Failed to submit answer',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Get user's answer for a specific question (requires auth)
   */
  @Get('questions/:questionId/user-answer')
  @UseGuards(FirebaseAuthGuard)
  async getUserAnswer(
    @Param('questionId') questionId: string,
    @Req() req: any,
  ) {
    // FirebaseAuthGuard sets req.user.id and req.user.firebaseUid
    const userId = req.user?.id || req.user?.firebaseUid || req.user?.uid;
    if (!userId) {
      throw new BadRequestException('User ID is required. Please ensure you are authenticated.');
    }

    try {
      const answer = await this.answerService.getUserAnswerForQuestion(userId, questionId);
      return {
        answer: answer,
        hasAnswer: answer !== null,
        attemptsExhausted: answer ? (answer.attempt_count || 0) >= 3 : false,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error.message || 'Failed to get user answer',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Proxy endpoint for voice lines - masks hero name in URL
   * Usage: /quiz/voice-line/:questionId
   * This allows the frontend to request voice lines without seeing the hero name
   * 
   * OPTIMIZED FOR SCALABILITY:
   * - Uses in-memory caching to avoid fetching from CDN multiple times
   * - Streams file directly from cache if available
   * - Handles concurrent requests efficiently
   */
  @Get('voice-line/:questionId')
  async getVoiceLine(@Param('questionId') questionId: string, @Res() res: Response) {
    try {
      // Check cache first
      const cached = voiceLineCache.get(questionId);
      const now = Date.now();
      
      if (cached && (now - cached.timestamp) < CACHE_TTL) {
        // Serve from cache
        const origin = res.req.headers.origin;
        if (origin) {
          res.setHeader('Access-Control-Allow-Origin', origin);
          res.setHeader('Access-Control-Allow-Credentials', 'true');
        }
        res.setHeader('Content-Type', cached.contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        res.setHeader('Accept-Ranges', 'bytes');
        return res.send(cached.buffer);
      }

      // Cache miss - fetch from database (optimize query to only get needed fields)
      const question = await this.quizService.getQuestionById(questionId);
      
      if (!question || question.question_type !== 'voice_line' || !question.question_content) {
        throw new HttpException('Voice line not found', HttpStatus.NOT_FOUND);
      }

      // Stream directly from CDN instead of buffering (much faster for large files)
      const voiceLineUrl = question.question_content;
      const response = await fetch(voiceLineUrl, {
        // Add timeout to prevent hanging requests
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });
      
      if (!response.ok) {
        throw new HttpException('Failed to fetch voice line', HttpStatus.BAD_GATEWAY);
      }

      // Get content type and length
      const contentType = response.headers.get('content-type') || 'audio/mpeg';
      const contentLength = response.headers.get('content-length');

      // Set CORS headers explicitly (required when using @Res())
      const origin = res.req.headers.origin;
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
      
      // Set appropriate headers
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
      res.setHeader('Accept-Ranges', 'bytes'); // Enable range requests for audio
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }

      // Only buffer small files (< 5MB) for caching, stream large files directly
      const contentLengthNum = contentLength ? parseInt(contentLength, 10) : 0;
      const shouldCache = contentLengthNum > 0 && contentLengthNum < 5 * 1024 * 1024; // 5MB threshold

      if (shouldCache) {
        // Buffer small files for caching
        const buffer = Buffer.from(await response.arrayBuffer());
        
        // Store in cache
        voiceLineCache.set(questionId, {
          buffer,
          contentType,
          timestamp: now,
        });

        // Clean up old cache entries (keep only last 10)
        if (voiceLineCache.size > 10) {
          const entries = Array.from(voiceLineCache.entries());
          entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
          const toKeep = entries.slice(0, 10);
          voiceLineCache.clear();
          toKeep.forEach(([key, value]) => voiceLineCache.set(key, value));
        }

        return res.send(buffer);
      } else {
        // Stream large files directly without caching (much faster)
        const reader = response.body?.getReader();
        if (!reader) {
          throw new HttpException('Failed to stream voice line', HttpStatus.BAD_GATEWAY);
        }

        // Stream chunks directly to response
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        return res.end();
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new HttpException('Request timeout while fetching voice line', HttpStatus.GATEWAY_TIMEOUT);
      }
      throw new HttpException('Failed to fetch voice line', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
