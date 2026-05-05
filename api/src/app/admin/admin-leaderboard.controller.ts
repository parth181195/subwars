import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { LeaderboardConfigModel } from '../models/leaderboard-config.model';
import { QuizService } from '../quiz/quiz.service';
import { AnswerService } from '../answer/answer.service';
import { AdminAuthGuard } from './guards/admin-auth.guard';

@UseGuards(AdminAuthGuard)
@Controller('admin/quizzes')
export class AdminLeaderboardController {
  constructor(
    @InjectModel(LeaderboardConfigModel)
    private readonly leaderboardConfigModel: typeof LeaderboardConfigModel,
    private readonly quizService: QuizService,
    private readonly answerService: AnswerService,
  ) {}

  /**
   * Get combined leaderboard across all quizzes (admin endpoint)
   * IMPORTANT: This route must come before :id/leaderboard to avoid route conflicts
   */
  @Get('leaderboard/combined')
  async getCombinedLeaderboard() {
    return this.quizService.getCombinedLeaderboard();
  }

  /**
   * Get leaderboard for a specific quiz (admin endpoint)
   */
  @Get(':id/leaderboard')
  async getQuizLeaderboard(@Param('id') quizId: string) {
    return this.quizService.getQuizLeaderboard(quizId);
  }

  /**
   * Reset leaderboard for a specific quiz (delete all answers)
   */
  @Delete(':id/leaderboard')
  async resetQuizLeaderboard(@Param('id') quizId: string) {
    const deletedCount = await this.answerService.deleteAnswersByQuizId(quizId);
    
    // Leaderboards are now calculated on-the-fly, no need to delete
    
    return {
      message: `Successfully reset leaderboard for quiz ${quizId}`,
      deletedAnswers: deletedCount,
    };
  }

  /**
   * Reset combined leaderboard (delete all answers)
   */
  @Delete('leaderboard/combined')
  async resetCombinedLeaderboard() {
    const deletedCount = await this.answerService.deleteAllAnswers();
    
    // Leaderboards are now calculated on-the-fly, no need to delete
    
    return {
      message: 'Successfully reset combined leaderboard',
      deletedAnswers: deletedCount,
    };
  }

  /**
   * Get hidden emails from leaderboard
   */
  @Get('leaderboard/hidden-emails')
  async getHiddenEmails() {
    try {
      const config = await this.leaderboardConfigModel.findByPk('hidden_emails');
      return {
        hiddenEmails: config?.emails || [],
      };
    } catch (error) {
      return {
        hiddenEmails: [],
      };
    }
  }

  /**
   * Hide email from leaderboard
   */
  @Post('leaderboard/hide-email')
  async hideEmailFromLeaderboard(@Body() body: { email: string }) {
    const { email } = body;
    if (!email) {
      throw new BadRequestException('Email is required');
    }

    try {
      let config = await this.leaderboardConfigModel.findByPk('hidden_emails');
      const currentEmails = config?.emails || [];
      
      if (!currentEmails.includes(email)) {
        const updatedEmails = [...currentEmails, email];
        
        if (config) {
          // Update existing document
          await config.update({ emails: updatedEmails });
        } else {
          // Create new document
          await this.leaderboardConfigModel.create({
            id: 'hidden_emails',
            emails: updatedEmails,
          });
        }

        return {
          message: `Email ${email} hidden from leaderboard`,
          hiddenEmails: updatedEmails,
        };
      }

      return {
        message: `Email ${email} is already hidden`,
        hiddenEmails: currentEmails,
      };
    } catch (error) {
      throw new BadRequestException(`Failed to hide email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Show email in leaderboard (remove from hidden list)
   */
  @Post('leaderboard/show-email')
  async showEmailInLeaderboard(@Body() body: { email: string }) {
    const { email } = body;
    if (!email) {
      throw new BadRequestException('Email is required');
    }

    try {
      const config = await this.leaderboardConfigModel.findByPk('hidden_emails');
      const currentEmails = config?.emails || [];
      const updatedEmails = currentEmails.filter((e: string) => e !== email);

      if (config) {
        await config.update({ emails: updatedEmails });
      } else {
        // If no config exists, create one with empty array
        await this.leaderboardConfigModel.create({
          id: 'hidden_emails',
          emails: [],
        });
      }

      return {
        message: `Email ${email} shown in leaderboard`,
        hiddenEmails: updatedEmails,
      };
    } catch (error) {
      throw new BadRequestException(`Failed to show email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

