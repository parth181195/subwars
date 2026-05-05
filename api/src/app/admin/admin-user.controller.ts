import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { AdminRole } from '../types/database.types';
import { UserService } from '../user/user.service';
import { InjectModel } from '@nestjs/sequelize';
import { UserModel } from '../models/user.model';
import { Op } from 'sequelize';
import { QuizGateway } from '../quiz/quiz.gateway';

interface InviteAdminDto {
  email: string;
  role?: AdminRole;
}

interface SignupValidationDto {
  email: string;
}

@Controller('admin/users')
export class AdminUserController {
  constructor(
    private readonly adminService: AdminService,
    private readonly userService: UserService,
    @InjectModel(UserModel)
    private readonly userModel: typeof UserModel,
    private readonly quizGateway: QuizGateway,
  ) {}

  /**
   * Get all admin users
   */
  @UseGuards(AdminAuthGuard)
  @Get()
  async getAllAdminUsers() {
    return this.adminService.getAllAdminUsers();
  }

  /**
   * Invite a new admin user
   * - Adds email to admin_users table
   * - Creates user in Supabase Auth (if not exists)
   * - Sends magic link invitation email
   */
  @UseGuards(AdminAuthGuard)
  @Post('invite')
  async inviteAdminUser(
    @Body() inviteDto: InviteAdminDto,
    @CurrentUser() currentUser: { email: string },
  ) {
    if (!inviteDto.email) {
      throw new BadRequestException('Email is required');
    }

    try {
      const result = await this.adminService.inviteAdminUser(
        inviteDto.email,
        inviteDto.role || AdminRole.ADMIN,
      );
      return result;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to invite admin user: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Validate if an email is authorized for admin signup
   * This endpoint is PUBLIC (not guarded) for signup page
   */
  @Post('validate-signup')
  async validateAdminSignup(@Body() signupDto: SignupValidationDto) {
    if (!signupDto.email) {
      throw new BadRequestException('Email is required');
    }

    return this.adminService.validateAdminSignup(signupDto.email);
  }

  /**
   * Delete admin user by email
   */
  @UseGuards(AdminAuthGuard)
  @Delete(':email')
  async deleteAdminUser(
    @Param('email') email: string,
    @CurrentUser() currentUser: { email: string },
  ) {
    // Prevent self-deletion
    if (email === currentUser.email) {
      throw new BadRequestException('You cannot delete your own admin account');
    }

    await this.adminService.deleteAdminUserByEmail(email);
    return { success: true, message: `Admin user ${email} has been removed` };
  }

  /**
   * Get all users with search and pagination
   */
  @UseGuards(AdminAuthGuard)
  @Get('list')
  async getAllUsers(
    @Query('search') search?: string,
    @Query('banned') banned?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const offset = (pageNum - 1) * limitNum;

    const where: any = {};

    // Search filter
    if (search) {
      where[Op.or] = [
        { email: { [Op.iLike]: `%${search}%` } },
        { full_name: { [Op.iLike]: `%${search}%` } },
        { in_game_name: { [Op.iLike]: `%${search}%` } },
      ];
    }

    // Banned filter
    if (banned === 'true') {
      where.is_banned = true;
    } else if (banned === 'false') {
      where.is_banned = false;
    }

    const { count, rows } = await this.userModel.findAndCountAll({
      where,
      limit: limitNum,
      offset,
      order: [['created_at', 'DESC']],
    });

    return {
      users: rows.map((user) => user.get({ plain: true })),
      total: count,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(count / limitNum),
    };
  }

  /**
   * Ban a user
   */
  @UseGuards(AdminAuthGuard)
  @Put(':userId/ban')
  async banUser(@Param('userId') userId: string) {
    const user = await this.userService.getUserById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.is_banned) {
      throw new BadRequestException('User is already banned');
    }

    const updatedUser = await this.userService.updateUser(userId, { is_banned: true });
    
    // Notify user via WebSocket to logout
    this.quizGateway.emitUserBanned(userId);
    
    return {
      success: true,
      message: `User ${user.email} has been banned`,
      user: updatedUser,
    };
  }

  /**
   * Unban a user
   */
  @UseGuards(AdminAuthGuard)
  @Put(':userId/unban')
  async unbanUser(@Param('userId') userId: string) {
    const user = await this.userService.getUserById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.is_banned) {
      throw new BadRequestException('User is not banned');
    }

    const updatedUser = await this.userService.updateUser(userId, { is_banned: false });
    
    return {
      success: true,
      message: `User ${user.email} has been unbanned`,
      user: updatedUser,
    };
  }
}

