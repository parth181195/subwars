import {
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AnswerModel } from '../models/answer.model';
import { AnswerService } from '../answer/answer.service';
import { AdminAuthGuard } from './guards/admin-auth.guard';

@UseGuards(AdminAuthGuard)
@Controller('admin/quizzes')
export class AdminAnswerController {
  constructor(
    @InjectModel(AnswerModel)
    private readonly answerModel: typeof AnswerModel,
    private readonly answerService: AnswerService,
  ) {}

  /**
   * Get all answers for a specific quiz (admin endpoint)
   */
  @Get(':id/answers')
  async getQuizAnswers(@Param('id') quizId: string) {
    const answers = await this.answerService.getAnswersByQuizId(quizId);
    
    // The answers already include user data from getAnswersByQuizId
    // Format it properly with email
    const enrichedAnswers = answers.map((answer) => {
      return {
        ...answer,
        user_email: answer.user_email || null,
        user_name: answer.users?.in_game_name || answer.users?.full_name || 'Unknown',
      };
    });
    
    return enrichedAnswers;
  }
}

