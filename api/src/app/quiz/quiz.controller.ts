import { Controller, Get, Param, Res, HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { QuizService } from './quiz.service';
import { QuizGateway } from './quiz.gateway';
import { BunnyStorageService } from '../storage/bunny-storage.service';

// In-memory cache for voice line files (for scalability)
const voiceLineCache = new Map<string, { buffer: Buffer; contentType: string; timestamp: number }>();
const CACHE_TTL = 3600000; // 1 hour in milliseconds

@Controller('quiz')
export class QuizController {
  constructor(
    private readonly quizService: QuizService,
    private readonly quizGateway: QuizGateway,
    private readonly bunnyStorageService: BunnyStorageService,
  ) {}

  /**
   * Get all active quizzes (public endpoint)
   */
  @Get('active')
  async getActiveQuizzes() {
    const quizzes = await this.quizService.getAllQuizzes();
    return quizzes.filter((quiz) => quiz.status === 'live');
  }

  /**
   * Get a specific quiz by ID (public endpoint - sanitized)
   */
  @Get(':id')
  async getQuizById(@Param('id') id: string) {
    const quiz = await this.quizService.getQuizById(id);
    if (!quiz) {
      throw new HttpException('Quiz not found', HttpStatus.NOT_FOUND);
    }
    return quiz;
  }

  /**
   * Get all questions for a quiz (public endpoint - sanitized)
   */
  @Get(':id/questions')
  async getQuizQuestions(@Param('id') quizId: string) {
    const questions = await this.quizService.getQuizQuestions(quizId);
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
   * Get leaderboard for a quiz (public endpoint)
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
    try {
      // Get all correct answers with user info, ordered by response_time
      const { data: answers, error } = await this.quizService['supabase']
        .from('answers')
        .select(`
          id,
          user_id,
          response_time,
          score,
          users!inner (
            in_game_name,
            full_name
          )
        `)
        .eq('question_id', questionId)
        .eq('is_correct', true)
        .not('response_time', 'is', null)
        .order('response_time', { ascending: true })
        .limit(3);

      if (error) {
        throw new BadRequestException(`Failed to get top answers: ${error.message}`);
      }

      if (!answers || answers.length === 0) {
        return [];
      }

      // Format the response
      return answers.map((answer: any, index: number) => ({
        position: index + 1,
        user_name: answer.users?.in_game_name || answer.users?.full_name || 'Anonymous',
        response_time: answer.response_time,
        score: answer.score || 0,
      }));
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to fetch top answers');
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

      // Cache miss - fetch from database and CDN
      const question = await this.quizService.getQuestionById(questionId);
      
      if (!question || question.question_type !== 'voice_line' || !question.question_content) {
        throw new HttpException('Voice line not found', HttpStatus.NOT_FOUND);
      }

      // Fetch the actual file from Bunny CDN and proxy it
      const voiceLineUrl = question.question_content;
      const response = await fetch(voiceLineUrl);
      
      if (!response.ok) {
        throw new HttpException('Failed to fetch voice line', HttpStatus.BAD_GATEWAY);
      }

      // Buffer the file
      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') || 'audio/mpeg';

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
      
      // Send the file
      res.send(buffer);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
