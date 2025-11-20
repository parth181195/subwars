import { Injectable, ConflictException, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { User, UserInsert, UserUpdate, RegistrationStatus } from '../types/database.types';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { UpdateRegistrationDto } from './dto/update-registration.dto';
import { StorageService } from '../storage/storage.service';
import { SteamVerificationService } from '../services/steam-verification.service';
import { DiscordVerificationService } from '../services/discord-verification.service';

@Injectable()
export class RegistrationService {
  constructor(
    @Inject('SUPABASE_ADMIN_CLIENT')
    private supabase: SupabaseClient,
    private storageService: StorageService,
    private steamVerificationService: SteamVerificationService,
    private discordVerificationService: DiscordVerificationService,
  ) {}

  async createRegistration(
    createRegistrationDto: CreateRegistrationDto,
    profileImageUrl?: string,
    proofOfPaymentUrl?: string,
  ): Promise<User> {
    // Check if user already exists by email
    const { data: existingUserByEmail } = await this.supabase
      .from('users')
      .select('*')
      .eq('email', createRegistrationDto.email)
      .single();

    if (existingUserByEmail) {
      throw new ConflictException('User already registered with this email');
    }

    // Check if user already exists by Google ID (Supabase auth user ID)
    const { data: existingUserByGoogleId } = await this.supabase
      .from('users')
      .select('*')
      .eq('google_id', createRegistrationDto.googleId)
      .single();

    if (existingUserByGoogleId) {
      throw new ConflictException('User already registered with this account');
    }

    // Verify Steam profile if provided
    let steamProfileVerified = false;
    let dotabuffProfileLink: string | undefined;
    
    if (createRegistrationDto.steamProfileLink) {
      try {
        // Validate Steam profile URL
        if (!this.steamVerificationService.validateSteamProfileUrl(createRegistrationDto.steamProfileLink)) {
          throw new BadRequestException('Invalid Steam profile URL format');
        }

        // Get Steam profile info
        const steamInfo = await this.steamVerificationService.getSteamProfileInfo(
          createRegistrationDto.steamProfileLink,
        );

        steamProfileVerified = steamInfo.isPublic;
        
        if (!steamInfo.isPublic) {
          throw new BadRequestException(
            'Steam profile must be set to PUBLIC. Please update your Steam profile privacy settings.',
          );
        }

        // Get Dotabuff profile link
        if (steamInfo.dotabuffProfileUrl) {
          dotabuffProfileLink = steamInfo.dotabuffProfileUrl;
        }

        // If Dota 2 Friend ID is provided, verify it matches Steam profile
        // Auto-correct if it's in the wrong format (ID64 vs ID32)
        if (createRegistrationDto.dota2FriendId && steamInfo.dota2FriendId) {
          // Normalize both to ID32 format for comparison
          const providedNormalized = this.steamVerificationService.normalizeFriendId(createRegistrationDto.dota2FriendId);
          
          if (providedNormalized !== steamInfo.dota2FriendId) {
            // Warn but auto-correct - use the one from Steam profile (more reliable)
            console.warn(
              `Dota 2 Friend ID mismatch: provided=${createRegistrationDto.dota2FriendId} (normalized=${providedNormalized}), steam=${steamInfo.dota2FriendId}. Using Steam profile value.`,
            );
            // Auto-update to use the correct Friend ID from Steam
            createRegistrationDto.dota2FriendId = steamInfo.dota2FriendId;
          } else if (createRegistrationDto.dota2FriendId !== steamInfo.dota2FriendId) {
            // Same value but different format - normalize to ID32
            createRegistrationDto.dota2FriendId = steamInfo.dota2FriendId;
          }
        } else if (steamInfo.dota2FriendId) {
          // No Friend ID provided, auto-fill from Steam profile
          createRegistrationDto.dota2FriendId = steamInfo.dota2FriendId;
        }
      } catch (error) {
        // Re-throw BadRequestException, but wrap others
        if (error instanceof BadRequestException) {
          throw error;
        }
        throw new BadRequestException(
          `Steam profile verification failed: ${error.message}`,
        );
      }
    }

    // Verify Discord membership if provided
    let discordVerified = false;
    if (createRegistrationDto.discordId) {
      try {
        const discordInfo = await this.discordVerificationService.verifyDiscordMembership(
          createRegistrationDto.discordId,
        );
        discordVerified = discordInfo.isMember;

        if (!discordInfo.isMember) {
          const inviteLink = this.discordVerificationService.getDiscordInviteLink();
          throw new BadRequestException(
            `You are not a member of the Discord server. Please join: ${inviteLink}`,
          );
        }
      } catch (error) {
        // Re-throw BadRequestException, but wrap others
        if (error instanceof BadRequestException) {
          throw error;
        }
        throw new BadRequestException(
          `Discord verification failed: ${error.message}`,
        );
      }
    }

    // Create new user registration
    const userInsert: UserInsert = {
      email: createRegistrationDto.email,
      google_id: createRegistrationDto.googleId,
      full_name: createRegistrationDto.fullName,
      phone_number: createRegistrationDto.phoneNumber,
      in_game_name: createRegistrationDto.inGameName,
      dota2_friend_id: createRegistrationDto.dota2FriendId,
      steam_profile_link: createRegistrationDto.steamProfileLink,
      rank_and_mmr: createRegistrationDto.rankAndMmr,
      discord_id: createRegistrationDto.discordId,
      upi_id: createRegistrationDto.upiId,
      profile_image_url: profileImageUrl,
      proof_of_payment_url: proofOfPaymentUrl,
      steam_profile_verified: steamProfileVerified,
      discord_verified: discordVerified,
      dotabuff_profile_link: dotabuffProfileLink,
      registration_status: RegistrationStatus.PENDING,
    };

    const { data: user, error } = await this.supabase
      .from('users')
      .insert(userInsert)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Failed to create registration: ${error.message}`);
    }

    return user as User;
  }

  async getRegistrationById(id: string): Promise<User> {
    const { data: user, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user as User;
  }

  async getRegistrationByEmail(email: string): Promise<User | null> {
    const { data: user } = await this.supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    return user as User | null;
  }

  async getRegistrationByGoogleId(googleId: string): Promise<User | null> {
    const { data: user } = await this.supabase
      .from('users')
      .select('*')
      .eq('google_id', googleId)
      .single();

    return user as User | null;
  }

  async updateRegistration(
    id: string,
    updateRegistrationDto: UpdateRegistrationDto,
    profileImageUrl?: string,
    proofOfPaymentUrl?: string,
  ): Promise<User> {
    const user = await this.getRegistrationById(id);

    // If user is already approved, only allow certain fields to be updated
    if (user.registration_status === RegistrationStatus.APPROVED) {
      // Only allow updating non-critical fields after approval
      const updates: UserUpdate = {};
      
      // Map DTO fields to database fields
      if (updateRegistrationDto.phoneNumber) {
        updates.phone_number = updateRegistrationDto.phoneNumber;
      }
      if (updateRegistrationDto.discordId) {
        updates.discord_id = updateRegistrationDto.discordId;
      }
      if (updateRegistrationDto.inGameName) {
        updates.in_game_name = updateRegistrationDto.inGameName;
      }

      // Re-verify Discord if it changed
      if (updates.discord_id && updates.discord_id !== user.discord_id) {
        try {
          const discordInfo = await this.discordVerificationService.verifyDiscordMembership(
            updates.discord_id,
          );
          updates.discord_verified = discordInfo.isMember;
          if (!discordInfo.isMember) {
            const inviteLink = this.discordVerificationService.getDiscordInviteLink();
            throw new BadRequestException(
              `You are not a member of the Discord server. Please join: ${inviteLink}`,
            );
          }
        } catch (error) {
          if (error instanceof BadRequestException) {
            throw error;
          }
          throw new BadRequestException(
            `Discord verification failed: ${error.message}`,
          );
        }
      }

      if (Object.keys(updates).length > 0) {
        const { data: updatedUser, error } = await this.supabase
          .from('users')
          .update(updates)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          throw new BadRequestException(`Failed to update registration: ${error.message}`);
        }

        return updatedUser as User;
      }

      return user;
    }

    // For pending/rejected registrations, allow full update with verification
    const updates: UserUpdate = {};
    
    // Map DTO fields to database fields
    if (updateRegistrationDto.fullName !== undefined) updates.full_name = updateRegistrationDto.fullName;
    if (updateRegistrationDto.phoneNumber !== undefined) updates.phone_number = updateRegistrationDto.phoneNumber;
    if (updateRegistrationDto.inGameName !== undefined) updates.in_game_name = updateRegistrationDto.inGameName;
    if (updateRegistrationDto.dota2FriendId !== undefined) updates.dota2_friend_id = updateRegistrationDto.dota2FriendId;
    if (updateRegistrationDto.steamProfileLink !== undefined) updates.steam_profile_link = updateRegistrationDto.steamProfileLink;
    if (updateRegistrationDto.rankAndMmr !== undefined) updates.rank_and_mmr = updateRegistrationDto.rankAndMmr;
    if (updateRegistrationDto.discordId !== undefined) updates.discord_id = updateRegistrationDto.discordId;
    if (updateRegistrationDto.upiId !== undefined) updates.upi_id = updateRegistrationDto.upiId;
    if (profileImageUrl) updates.profile_image_url = profileImageUrl;
    if (proofOfPaymentUrl) updates.proof_of_payment_url = proofOfPaymentUrl;
    
    // Reset status to pending if it was rejected
    if (user.registration_status === RegistrationStatus.REJECTED) {
      updates.registration_status = RegistrationStatus.PENDING;
    }

    // Re-verify Steam profile if it changed
    if (updateRegistrationDto.steamProfileLink && updateRegistrationDto.steamProfileLink !== user.steam_profile_link) {
      try {
        if (!this.steamVerificationService.validateSteamProfileUrl(updateRegistrationDto.steamProfileLink)) {
          throw new BadRequestException('Invalid Steam profile URL format');
        }

        const steamInfo = await this.steamVerificationService.getSteamProfileInfo(
          updateRegistrationDto.steamProfileLink,
        );

        updates.steam_profile_verified = steamInfo.isPublic;
        
        if (!steamInfo.isPublic) {
          throw new BadRequestException(
            'Steam profile must be set to PUBLIC. Please update your Steam profile privacy settings.',
          );
        }

        if (steamInfo.dotabuffProfileUrl) {
          updates.dotabuff_profile_link = steamInfo.dotabuffProfileUrl;
        }
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        throw new BadRequestException(
          `Steam profile verification failed: ${error.message}`,
        );
      }
    }

    // Re-verify Discord if it changed
    if (updateRegistrationDto.discordId && updateRegistrationDto.discordId !== user.discord_id) {
      try {
        const discordInfo = await this.discordVerificationService.verifyDiscordMembership(
          updateRegistrationDto.discordId,
        );
        updates.discord_verified = discordInfo.isMember;
        
        if (!discordInfo.isMember) {
          const inviteLink = this.discordVerificationService.getDiscordInviteLink();
          throw new BadRequestException(
            `You are not a member of the Discord server. Please join: ${inviteLink}`,
          );
        }
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        throw new BadRequestException(
          `Discord verification failed: ${error.message}`,
        );
      }
    }

    const { data: updatedUser, error } = await this.supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Failed to update registration: ${error.message}`);
    }

    return updatedUser as User;
  }

  async getMyRegistration(googleId: string): Promise<User | null> {
    return this.getRegistrationByGoogleId(googleId);
  }

  async getRegistrationStatus(userId: string): Promise<{
    exists: boolean;
    status?: RegistrationStatus;
    userId?: string;
  }> {
    // userId can be either Supabase auth user ID or our user ID
    // First try by our user ID
    const { data: userById } = await this.supabase
      .from('users')
      .select('id, registration_status')
      .eq('id', userId)
      .single();

    if (userById) {
      return {
        exists: true,
        status: userById.registration_status as RegistrationStatus,
        userId: userById.id,
      };
    }

    // If not found, try by google_id (in case userId is Supabase auth ID)
    const { data: userByGoogleId } = await this.supabase
      .from('users')
      .select('id, registration_status')
      .eq('google_id', userId)
      .single();

    if (userByGoogleId) {
      return {
        exists: true,
        status: userByGoogleId.registration_status as RegistrationStatus,
        userId: userByGoogleId.id,
      };
    }

    return { exists: false };
  }
}
