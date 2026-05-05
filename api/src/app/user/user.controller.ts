import { Controller, Get, Post, Param, UseGuards, Req } from '@nestjs/common';
import { UserService } from './user.service';
import { FirebaseAuthGuard } from '../quiz/guards/firebase-auth.guard';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(FirebaseAuthGuard)
  @Get(':id')
  async getUserById(@Param('id') id: string) {
    const user = await this.userService.getUserById(id);
    if (!user) {
      return { id, is_banned: false }; // Return default if user doesn't exist
    }
    // Return only necessary fields (including is_banned)
    return {
      id: user.id,
      email: user.email,
      is_banned: user.is_banned || false,
    };
  }

  /**
   * Ensure user exists in database (called on login)
   * Creates user record if it doesn't exist
   */
  @UseGuards(FirebaseAuthGuard)
  @Post('ensure')
  async ensureUser(@Req() req: any) {
    const userId = req.user?.uid;
    if (!userId) {
      return { success: false, message: 'User ID not found' };
    }

    try {
      const userExists = await this.userService.ensureUserExists(userId);
      if (userExists) {
        const user = await this.userService.getUserById(userId);
        return {
          success: true,
          message: user ? 'User already exists' : 'User created successfully',
          user: user ? {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            profile_image_url: user.profile_image_url,
          } : null,
        };
      }
      return { success: false, message: 'Failed to create user' };
    } catch (error) {
      console.error('[UserController] Error ensuring user:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

