import { Injectable, BadRequestException } from '@nestjs/common';
import axios from 'axios';

export interface DiscordMemberInfo {
  userId: string;
  username: string;
  discriminator?: string;
  isMember: boolean;
  joinedAt?: Date;
  roles?: string[];
}

@Injectable()
export class DiscordVerificationService {
  private readonly DISCORD_API_BASE = 'https://discord.com/api/v10';
  private readonly GUILD_ID = process.env.DISCORD_GUILD_ID || ''; // Your Discord server/guild ID
  private readonly BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || ''; // Discord bot token with members.read permission

  /**
   * Extract Discord user ID from Discord ID string
   * Format can be: "username" or "username#discriminator" or user ID
   */
  extractDiscordUserId(discordId: string): string | null {
    // If it's already a user ID (numeric, 17-19 digits)
    if (/^\d{17,19}$/.test(discordId)) {
      return discordId;
    }

    // If it's in format "username#discriminator", we need to resolve it
    // For now, return null and we'll need to search by username
    return null;
  }

  /**
   * Verify if a Discord user is a member of the specified server
   * This requires a Discord bot with appropriate permissions
   */
  async verifyDiscordMembership(
    discordId: string,
  ): Promise<DiscordMemberInfo> {
    if (!this.BOT_TOKEN || !this.GUILD_ID) {
      throw new BadRequestException(
        'Discord verification is not configured. Please set DISCORD_BOT_TOKEN and DISCORD_GUILD_ID environment variables.',
      );
    }

    try {
      // First, try to get the user by ID or username
      let userId = this.extractDiscordUserId(discordId);
      let username = discordId;

      // If not a user ID, try to search for the user by username
      if (!userId) {
        // Try to search guild members (this requires a bot with appropriate permissions)
        // Note: This is a simplified approach. In production, you might want to use a bot to cache members
        const membersResponse = await axios.get(
          `${this.DISCORD_API_BASE}/guilds/${this.GUILD_ID}/members/search?query=${encodeURIComponent(discordId)}`,
          {
            headers: {
              Authorization: `Bot ${this.BOT_TOKEN}`,
            },
            timeout: 10000,
          },
        );

        if (membersResponse.data && membersResponse.data.length > 0) {
          const member = membersResponse.data[0];
          userId = member.user?.id;
          username = member.user?.username || discordId;
        } else {
          // User not found in server
          return {
            userId: discordId,
            username: discordId,
            isMember: false,
          };
        }
      }

      // Check if user is a member of the guild
      try {
        const memberResponse = await axios.get(
          `${this.DISCORD_API_BASE}/guilds/${this.GUILD_ID}/members/${userId}`,
          {
            headers: {
              Authorization: `Bot ${this.BOT_TOKEN}`,
            },
            timeout: 10000,
          },
        );

        const member = memberResponse.data;
        return {
          userId: member.user?.id || userId,
          username: member.user?.username || username,
          discriminator: member.user?.discriminator,
          isMember: true,
          joinedAt: member.joined_at ? new Date(member.joined_at) : undefined,
          roles: member.roles || [],
        };
      } catch (error) {
        if (axios.isAxiosError(error)) {
          if (error.response?.status === 404) {
            // User is not a member
            return {
              userId: userId || discordId,
              username: username,
              isMember: false,
            };
          }
        }
        throw error;
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          return {
            userId: discordId,
            username: discordId,
            isMember: false,
          };
        }
        throw new BadRequestException(
          `Could not verify Discord membership: ${error.response?.statusText || error.message}`,
        );
      }
      throw new BadRequestException(
        `Could not verify Discord membership: ${error.message}`,
      );
    }
  }

  /**
   * Alternative method: Use Discord OAuth2 to verify membership
   * This requires the user to authorize the app and can verify membership server-side
   */
  async verifyDiscordMembershipViaOAuth(
    discordUserId: string,
    accessToken?: string,
  ): Promise<boolean> {
    if (!accessToken) {
      // Without OAuth token, fall back to bot method
      const memberInfo = await this.verifyDiscordMembership(discordUserId);
      return memberInfo.isMember;
    }

    try {
      // Get user's guild memberships
      const response = await axios.get(
        `${this.DISCORD_API_BASE}/users/@me/guilds`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          timeout: 10000,
        },
      );

      const guilds = response.data;
      return guilds.some((guild: any) => guild.id === this.GUILD_ID);
    } catch (error) {
      throw new BadRequestException(
        `Could not verify Discord membership via OAuth: ${error.message}`,
      );
    }
  }

  /**
   * Get Discord server invite link
   */
  getDiscordInviteLink(): string {
    const inviteCode = process.env.DISCORD_INVITE_CODE || 'qfnfBRU';
    return `https://discord.gg/${inviteCode}`;
  }
}

