import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { QuizModel } from '../models/quiz.model';
import { QuizService } from '../quiz/quiz.service';
import { QuizGateway } from '../quiz/quiz.gateway';
import { QuizAutoModeService } from '../quiz/quiz-auto-mode.service';
import { QuizInsert, QuizUpdate } from '../types/database.types';
import { AdminAuthGuard } from './guards/admin-auth.guard';

@UseGuards(AdminAuthGuard)
@Controller('admin/quizzes')
export class AdminQuizController {
  constructor(
    @InjectModel(QuizModel)
    private readonly quizModel: typeof QuizModel,
    private readonly quizService: QuizService,
    @Inject(forwardRef(() => QuizGateway))
    private readonly quizGateway: QuizGateway,
    @Inject(forwardRef(() => QuizAutoModeService))
    private readonly autoModeService: QuizAutoModeService,
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

  @Get(':id/next-question-time')
  async getNextQuestionTime(@Param('id') id: string) {
    const nextActivationTime = this.autoModeService.getNextActivationTime(id);
    if (!nextActivationTime) {
      return { nextActivationTime: null, timeRemaining: null };
    }
    
    const now = Date.now();
    const timeRemaining = Math.max(0, Math.floor((nextActivationTime.getTime() - now) / 1000));
    
    return {
      nextActivationTime: nextActivationTime.toISOString(),
      timeRemaining,
    };
  }

  @Post(':id/auto-mode/start-next-question')
  async startNextQuestion(@Param('id') id: string) {
    try {
      const result = await this.autoModeService.startNextQuestion(id);
      return result;
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to start next question'
      );
    }
  }

  @Post()
  async createQuiz(@Body() quizInsert: QuizInsert) {
    return this.quizService.createQuiz(quizInsert);
  }

  @Put(':id')
  async updateQuiz(@Param('id') id: string, @Body() quizUpdate: QuizUpdate) {
    // OPTIMIZED: updateQuiz already fetches current quiz internally
    // Store status before update to check if it changed
    const statusBeforeUpdate = quizUpdate.status;
    
    const quiz = await this.quizService.updateQuiz(id, quizUpdate);
    
    // Emit status changed event if status was in the update and it's different from before
    // (updateQuiz handles the actual status change logic)
    if (statusBeforeUpdate && statusBeforeUpdate !== quiz.status) {
      // Status was changed (or attempted to change), emit event
      await this.quizGateway.emitQuizStatusChanged(quiz.id, quiz.status);
    }
    
    // If quiz is marked as completed, announce top 3 winners
    if (quizUpdate.status === 'completed' && quiz.status === 'completed') {
      await this.quizGateway.announceQuizWinners(id);
    }
    
    return quiz;
  }

  @Delete(':id')
  async deleteQuiz(@Param('id') id: string) {
    await this.quizService.deleteQuiz(id);
    return { message: 'Quiz deleted successfully' };
  }

}
