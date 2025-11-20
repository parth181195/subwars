import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  UseInterceptors,
  UploadedFiles,
  UsePipes,
  BadRequestException,
  Request,
  ValidationPipe,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { RegistrationService } from './registration.service';
import { StorageService } from '../storage/storage.service';
import { SteamVerificationService } from '../services/steam-verification.service';
import { DiscordVerificationService } from '../services/discord-verification.service';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { UpdateRegistrationDto } from './dto/update-registration.dto';

@Controller('registration')
export class RegistrationController {
  constructor(
    private readonly registrationService: RegistrationService,
    private readonly storageService: StorageService,
    private readonly steamVerificationService: SteamVerificationService,
    private readonly discordVerificationService: DiscordVerificationService,
  ) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'profileImage', maxCount: 1 },
        { name: 'proofOfPayment', maxCount: 1 },
      ],
      {
        limits: {
          fileSize: 100 * 1024 * 1024, // 100MB max
        },
        fileFilter: (req, file, cb) => {
          if (file.fieldname === 'profileImage') {
            if (!file.mimetype.startsWith('image/')) {
              return cb(new BadRequestException('Profile image must be an image file'), false);
            }
            if (file.size > 5 * 1024 * 1024) {
              return cb(new BadRequestException('Profile image must be less than 5MB'), false);
            }
          } else if (file.fieldname === 'proofOfPayment') {
            const allowedMimes = [
              'image/jpeg',
              'image/jpg',
              'image/png',
              'image/webp',
              'application/pdf',
            ];
            if (!allowedMimes.includes(file.mimetype)) {
              return cb(
                new BadRequestException('Payment proof must be a PDF or image file'),
                false,
              );
            }
          }
          cb(null, true);
        },
      },
    ),
  )
  async createRegistration(
    @Body() createRegistrationDto: CreateRegistrationDto,
    @UploadedFiles()
    files?: {
      profileImage?: Express.Multer.File[];
      proofOfPayment?: Express.Multer.File[];
    },
  ) {
    // Upload files to Firebase Storage first (we need userId for path, so create user first without files)
    // Then create/update user with file URLs
    let profileImageUrl: string | undefined;
    let proofOfPaymentUrl: string | undefined;

    // Create user first to get userId for file uploads
    const tempUser = await this.registrationService.createRegistration(createRegistrationDto);

    // Upload files to Firebase Storage
    if (files?.profileImage && files.profileImage.length > 0) {
      profileImageUrl = await this.storageService.uploadProfileImage(
        tempUser.id,
        files.profileImage[0],
      );
    }

    if (files?.proofOfPayment && files.proofOfPayment.length > 0) {
      proofOfPaymentUrl = await this.storageService.uploadPaymentProof(
        tempUser.id,
        files.proofOfPayment[0],
      );
    }

    // Update user with file URLs if uploaded
    if (profileImageUrl || proofOfPaymentUrl) {
      return this.registrationService.updateRegistration(
        tempUser.id,
        {}, // No DTO updates, just file URLs
        profileImageUrl,
        proofOfPaymentUrl,
      );
    }

    return tempUser;
  }

  @Get('me')
  async getMyRegistration(@Request() req: any) {
    // TODO: Get userId from authenticated user (Supabase JWT)
    const userId = req.user?.id || req.headers['x-user-id'];
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    return this.registrationService.getRegistrationByGoogleId(userId);
  }

  @Get('status')
  async getRegistrationStatus(@Request() req: any) {
    // TODO: Get userId from authenticated user (Supabase JWT)
    const userId = req.user?.id || req.headers['x-user-id'];
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    return this.registrationService.getRegistrationStatus(userId);
  }

  @Get(':id')
  async getRegistration(@Param('id') id: string) {
    return this.registrationService.getRegistrationById(id);
  }

  @Post('verify/steam')
  async verifySteamProfile(@Body('steamProfileLink') steamProfileLink: string) {
    if (!steamProfileLink) {
      throw new BadRequestException('Steam profile link is required');
    }
    const info = await this.steamVerificationService.getSteamProfileInfo(steamProfileLink);
    return {
      steamId: info.steamId,
      isPublic: info.isPublic,
      dota2FriendId: info.dota2FriendId,
      dotabuffProfileUrl: info.dotabuffProfileUrl,
      personaName: info.personaName,
      avatarUrl: info.avatarUrl,
    };
  }

  @Post('verify/discord')
  async verifyDiscordMembership(@Body('discordId') discordId: string) {
    if (!discordId) {
      throw new BadRequestException('Discord ID is required');
    }
    const info = await this.discordVerificationService.verifyDiscordMembership(discordId);
    return {
      userId: info.userId,
      username: info.username,
      isMember: info.isMember,
      joinedAt: info.joinedAt,
      inviteLink: info.isMember ? undefined : this.discordVerificationService.getDiscordInviteLink(),
    };
  }

  @Put('me')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'profileImage', maxCount: 1 },
        { name: 'proofOfPayment', maxCount: 1 },
      ],
      {
        limits: {
          fileSize: 100 * 1024 * 1024, // 100MB max
        },
        fileFilter: (req, file, cb) => {
          if (file.fieldname === 'profileImage') {
            if (!file.mimetype.startsWith('image/')) {
              return cb(new BadRequestException('Profile image must be an image file'), false);
            }
            if (file.size > 5 * 1024 * 1024) {
              return cb(new BadRequestException('Profile image must be less than 5MB'), false);
            }
          } else if (file.fieldname === 'proofOfPayment') {
            const allowedMimes = [
              'image/jpeg',
              'image/jpg',
              'image/png',
              'image/webp',
              'application/pdf',
            ];
            if (!allowedMimes.includes(file.mimetype)) {
              return cb(
                new BadRequestException('Payment proof must be a PDF or image file'),
                false,
              );
            }
          }
          cb(null, true);
        },
      },
    ),
  )
  async updateRegistration(
    @Body() updateRegistrationDto: UpdateRegistrationDto,
    @UploadedFiles()
    files?: {
      profileImage?: Express.Multer.File[];
      proofOfPayment?: Express.Multer.File[];
    },
    @Request() req?: any,
  ) {
    // TODO: Get user ID from authenticated user (Supabase JWT)
    const userId = req?.user?.id || req?.headers['x-user-id'];
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    const user = await this.registrationService.getRegistrationByGoogleId(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    let profileImageUrl: string | undefined;
    let proofOfPaymentUrl: string | undefined;

    if (files?.profileImage && files.profileImage.length > 0) {
      profileImageUrl = await this.storageService.uploadProfileImage(
        user.id,
        files.profileImage[0],
      );
    }

    if (files?.proofOfPayment && files.proofOfPayment.length > 0) {
      proofOfPaymentUrl = await this.storageService.uploadPaymentProof(
        user.id,
        files.proofOfPayment[0],
      );
    }

    return this.registrationService.updateRegistration(
      user.id,
      updateRegistrationDto,
      profileImageUrl,
      proofOfPaymentUrl,
    );
  }
}

