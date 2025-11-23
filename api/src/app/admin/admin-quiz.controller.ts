import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  Query,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { FileInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';
import { QuizService } from '../quiz/quiz.service';
import { QuizGateway } from '../quiz/quiz.gateway';
import { StorageService } from '../storage/storage.service';
import { BunnyStorageService } from '../storage/bunny-storage.service';
import {
  QuizInsert,
  QuizUpdate,
  QuizQuestionInsert,
  QuizQuestionUpdate,
  QuestionType,
  QuestionStatus,
} from '../types/database.types';

// TODO: Add admin auth guard
// @UseGuards(AdminAuthGuard)
@Controller('admin/quizzes')
export class AdminQuizController {
  constructor(
    private readonly quizService: QuizService,
    @Inject(forwardRef(() => QuizGateway))
    private readonly quizGateway: QuizGateway,
    private readonly storageService: StorageService,
    private readonly bunnyStorageService: BunnyStorageService,
  ) {}

  // Quiz Management
  @Get()
  async getAllQuizzes() {
    return this.quizService.getAllQuizzes();
  }

  // Question Management - More specific routes must come before parameterized routes
  @Get('questions/:questionId')
  async getQuestionById(@Param('questionId') questionId: string) {
    return this.quizService.getQuestionById(questionId);
  }

  @Get('questions/:questionId/answers')
  async getQuestionAnswers(@Param('questionId') questionId: string) {
    return this.quizService.getQuestionAnswers(questionId);
  }

  @Get(':id')
  async getQuizById(@Param('id') id: string) {
    return this.quizService.getQuizById(id);
  }

  @Post()
  async createQuiz(@Body() quizInsert: QuizInsert) {
    return this.quizService.createQuiz(quizInsert);
  }

  @Put(':id')
  async updateQuiz(@Param('id') id: string, @Body() quizUpdate: QuizUpdate) {
    const quiz = await this.quizService.updateQuiz(id, quizUpdate);
    
    // If quiz is marked as completed, announce top 3 winners
    if (quizUpdate.status === 'completed') {
      await this.quizGateway.announceQuizWinners(id);
    }
    
    return quiz;
  }

  @Delete(':id')
  async deleteQuiz(@Param('id') id: string) {
    await this.quizService.deleteQuiz(id);
    return { message: 'Quiz deleted successfully' };
  }

  // Question Management
  @Get(':id/questions')
  async getQuizQuestions(@Param('id') quizId: string) {
    return this.quizService.getQuestionsByQuizId(quizId);
  }

  @Post(':id/questions')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'question_file', maxCount: 1 },
      { name: 'answer_file', maxCount: 1 },
    ])
  )
  async createQuestion(
    @Param('id') quizId: string,
    @Body() body: any,
    @UploadedFiles() files?: { question_file?: Express.Multer.File[]; answer_file?: Express.Multer.File[] },
  ) {
    const questionFile = files?.question_file?.[0];
    const answerFile = files?.answer_file?.[0];
    let questionContent = '';
    let questionContentMetadata: Record<string, any> = {};

    const questionType = body.question_type === 'image' ? QuestionType.IMAGE : QuestionType.VOICE_LINE;
    const correctAnswerHero = body.correct_answer_hero;
    const timeLimitSeconds = parseInt(body.time_limit_seconds || '120', 10);
    const orderIndex = parseInt(body.order_index || '0', 10);

    // Handle image upload or voice line URL
    if (questionType === QuestionType.IMAGE && questionFile) {
      // Upload image to Bunny CDN
      // Sanitize filename: remove/replace special characters
      const sanitizedOriginalName = questionFile.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = `${Date.now()}-${sanitizedOriginalName}`;
      const filePath = `pasoll/subwars5/question/images/${fileName}`;
      questionContent = await this.bunnyStorageService.uploadFileFromMulter(filePath, questionFile);
      questionContentMetadata = {
        originalName: questionFile.originalname,
        mimeType: questionFile.mimetype,
        size: questionFile.size,
      };
    } else if (questionType === QuestionType.VOICE_LINE && body.voice_line_url) {
      questionContent = body.voice_line_url;
      questionContentMetadata = body.voice_line_metadata ? 
        (typeof body.voice_line_metadata === 'string' ? JSON.parse(body.voice_line_metadata) : body.voice_line_metadata) 
        : {};
    } else if (body.question_content) {
      // Direct content URL
      questionContent = body.question_content;
      questionContentMetadata = body.question_content_metadata ? 
        (typeof body.question_content_metadata === 'string' ? JSON.parse(body.question_content_metadata) : body.question_content_metadata)
        : {};
    } else {
      throw new BadRequestException('Question content is required. Provide either a file upload or content URL.');
    }

    // Handle answer image - can be provided as file upload or URL string
    let answerImageUrl: string | undefined = body.answer_image_url || undefined;
    
    if (answerFile) {
      // Upload answer image to Bunny CDN
      // Sanitize filename: remove/replace special characters
      const sanitizedOriginalName = answerFile.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = `${Date.now()}-${sanitizedOriginalName}`;
      const filePath = `pasoll/subwars5/question/answers/${fileName}`;
      answerImageUrl = await this.bunnyStorageService.uploadFileFromMulter(filePath, answerFile);
    }

    const questionInsert: QuizQuestionInsert = {
      quiz_id: quizId,
      question_type: questionType,
      question_content: questionContent,
      question_content_metadata: Object.keys(questionContentMetadata).length > 0 ? questionContentMetadata : undefined,
      correct_answer_hero: correctAnswerHero,
      answer_image_url: answerImageUrl,
      time_limit_seconds: timeLimitSeconds,
      order_index: orderIndex,
      status: QuestionStatus.PENDING,
      is_active: false,
    };

    return this.quizService.createQuestion(questionInsert);
  }

  @Put('questions/:questionId')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'question_file', maxCount: 1 },
      { name: 'answer_file', maxCount: 1 },
    ])
  )
  async updateQuestion(
    @Param('questionId') questionId: string,
    @Body() body: any,
    @UploadedFiles() files?: { question_file?: Express.Multer.File[]; answer_file?: Express.Multer.File[] },
  ) {
    const questionFile = files?.question_file?.[0];
    const answerFile = files?.answer_file?.[0];
    const questionUpdate: QuizQuestionUpdate = {};

    if (body.question_type) {
      questionUpdate.question_type = body.question_type === 'image' ? QuestionType.IMAGE : QuestionType.VOICE_LINE;
    }
    if (body.correct_answer_hero) questionUpdate.correct_answer_hero = body.correct_answer_hero;
    if (body.time_limit_seconds) questionUpdate.time_limit_seconds = parseInt(body.time_limit_seconds, 10);
    if (body.order_index) questionUpdate.order_index = parseInt(body.order_index, 10);

    // Handle question content
    if (questionFile) {
      // Upload question image to Bunny CDN
      // Sanitize filename: remove/replace special characters
      const sanitizedOriginalName = questionFile.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = `${Date.now()}-${sanitizedOriginalName}`;
      const filePath = `pasoll/subwars5/question/images/${fileName}`;
      questionUpdate.question_content = await this.bunnyStorageService.uploadFileFromMulter(filePath, questionFile);
      questionUpdate.question_content_metadata = {
        originalName: questionFile.originalname,
        mimeType: questionFile.mimetype,
        size: questionFile.size,
      };
    } else if (body.voice_line_url) {
      // Handle voice line URL
      questionUpdate.question_content = body.voice_line_url;
      questionUpdate.question_content_metadata = {
        voiceLineUrl: body.voice_line_url,
      };
    } else if (body.question_content) {
      questionUpdate.question_content = body.question_content;
      if (body.question_content_metadata) {
        questionUpdate.question_content_metadata = typeof body.question_content_metadata === 'string' 
          ? JSON.parse(body.question_content_metadata)
          : body.question_content_metadata;
      }
    }

    // Handle answer file upload
    if (answerFile) {
      // Upload answer image to Bunny CDN
      // Sanitize filename: remove/replace special characters
      const sanitizedOriginalName = answerFile.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = `${Date.now()}-${sanitizedOriginalName}`;
      const filePath = `pasoll/subwars5/question/answers/${fileName}`;
      questionUpdate.answer_image_url = await this.bunnyStorageService.uploadFileFromMulter(filePath, answerFile);
    } else if (body.answer_image_url) {
      questionUpdate.answer_image_url = body.answer_image_url;
    }

    return this.quizService.updateQuestion(questionId, questionUpdate);
  }

  @Delete('questions/:questionId')
  async deleteQuestion(@Param('questionId') questionId: string) {
    await this.quizService.deleteQuestion(questionId);
    return { message: 'Question deleted successfully' };
  }

  // Question Control
  @Post('questions/:questionId/make-live')
  async makeQuestionLive(@Param('questionId') questionId: string) {
    const question = await this.quizService.activateQuestion(questionId);
    
    // Emit WebSocket event to all participants
    await this.quizGateway.emitQuestionLive(question.quiz_id, question);
    
    return question;
  }

  @Post('questions/:questionId/end')
  async endQuestion(@Param('questionId') questionId: string) {
    const question = await this.quizService.endQuestion(questionId);
    
    // Emit WebSocket event to all participants
    await this.quizGateway.emitQuestionEnded(question.quiz_id, question);
    
    return question;
  }

  // Answers and Leaderboard
  @Get(':id/leaderboard')
  async getQuizLeaderboard(@Param('id') quizId: string) {
    return this.quizService.getQuizLeaderboard(quizId);
  }
}

