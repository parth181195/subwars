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
  UseGuards,
  Query,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { QuizService } from '../quiz/quiz.service';
import { QuizGateway } from '../quiz/quiz.gateway';
import { StorageService } from '../storage/storage.service';
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
  ) {}

  // Quiz Management
  @Get()
  async getAllQuizzes() {
    return this.quizService.getAllQuizzes();
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
    return this.quizService.updateQuiz(id, quizUpdate);
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
  @UseInterceptors(FileInterceptor('question_file'))
  async createQuestion(
    @Param('id') quizId: string,
    @Body() body: any,
    @UploadedFile() questionFile?: Express.Multer.File,
  ) {
    let questionContent = '';
    let questionContentMetadata: Record<string, any> = {};

    const questionType = body.question_type === 'image' ? QuestionType.IMAGE : QuestionType.VOICE_LINE;
    const correctAnswerHero = body.correct_answer_hero;
    const timeLimitSeconds = parseInt(body.time_limit_seconds || '120', 10);
    const orderIndex = parseInt(body.order_index || '0', 10);

    // Handle image upload or voice line URL
    if (questionType === QuestionType.IMAGE && questionFile) {
      // Upload image to storage
      questionContent = await this.storageService.uploadFile(
        `quiz-questions/${quizId}`,
        questionFile,
      );
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

    // Handle answer image URL (can be provided as URL string)
    // For now, we accept URL strings. File uploads for answer images can be handled
    // via a separate endpoint or by pre-uploading and providing the URL.
    const answerImageUrl: string | undefined = body.answer_image_url || undefined;

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
  @UseInterceptors(FileInterceptor('question_file'))
  async updateQuestion(
    @Param('questionId') questionId: string,
    @Body() body: any,
    @UploadedFile() questionFile?: Express.Multer.File,
  ) {
    const questionUpdate: QuizQuestionUpdate = {};

    if (body.question_type) {
      questionUpdate.question_type = body.question_type === 'image' ? QuestionType.IMAGE : QuestionType.VOICE_LINE;
    }
    if (body.correct_answer_hero) questionUpdate.correct_answer_hero = body.correct_answer_hero;
    if (body.time_limit_seconds) questionUpdate.time_limit_seconds = parseInt(body.time_limit_seconds, 10);
    if (body.order_index) questionUpdate.order_index = parseInt(body.order_index, 10);
    if (body.answer_image_url) questionUpdate.answer_image_url = body.answer_image_url;

    // Handle file upload if provided
    if (questionFile) {
      const question = await this.quizService.getQuestionById(questionId);
      questionUpdate.question_content = await this.storageService.uploadFile(
        `quiz-questions/${question.quiz_id}`,
        questionFile,
      );
      questionUpdate.question_content_metadata = {
        originalName: questionFile.originalname,
        mimeType: questionFile.mimetype,
        size: questionFile.size,
      };
    } else if (body.question_content) {
      questionUpdate.question_content = body.question_content;
      if (body.question_content_metadata) {
        questionUpdate.question_content_metadata = typeof body.question_content_metadata === 'string' 
          ? JSON.parse(body.question_content_metadata)
          : body.question_content_metadata;
      }
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
  @Get('questions/:questionId/answers')
  async getQuestionAnswers(@Param('questionId') questionId: string) {
    return this.quizService.getQuestionAnswers(questionId);
  }

  @Get(':id/leaderboard')
  async getQuizLeaderboard(@Param('id') quizId: string) {
    return this.quizService.getQuizLeaderboard(quizId);
  }
}

