import { Injectable, BadRequestException } from '@nestjs/common';
import axios from 'axios';

export interface SteamProfileInfo {
  steamId: string;
  profileUrl: string;
  isPublic: boolean;
  personaName?: string;
  avatarUrl?: string;
  dota2FriendId?: string;
  dotabuffProfileUrl?: string;
}

@Injectable()
export class SteamVerificationService {
  private readonly STEAM_API_BASE = 'https://api.steampowered.com';
  private readonly STEAM_PROFILE_BASE = 'https://steamcommunity.com';
  private readonly DOTABUFF_BASE = 'https://www.dotabuff.com/players';

  /**
   * Extract Steam ID from profile URL
   * Supports both:
   * - https://steamcommunity.com/profiles/76561198000000000
   * - https://steamcommunity.com/id/username
   */
  async extractSteamId(profileUrl: string): Promise<string> {
    // Remove trailing slash
    profileUrl = profileUrl.trim().replace(/\/$/, '');

    // Check if it's a numeric Steam ID (64-bit)
    const numericIdMatch = profileUrl.match(/\/profiles\/(\d+)$/);
    if (numericIdMatch) {
      return numericIdMatch[1];
    }

    // Check if it's a vanity URL
    const vanityMatch = profileUrl.match(/\/id\/([^/]+)$/);
    if (vanityMatch) {
      const vanityName = vanityMatch[1];
      try {
        // Try to resolve vanity URL to Steam ID
        const response = await axios.get(
          `${this.STEAM_PROFILE_BASE}/id/${vanityName}?xml=1`,
        );
        const xmlMatch = response.data.match(/<steamID64>(\d+)<\/steamID64>/);
        if (xmlMatch) {
          return xmlMatch[1];
        }
      } catch (error) {
        throw new BadRequestException(
          `Could not resolve Steam profile URL: ${profileUrl}`,
        );
      }
    }

    throw new BadRequestException(`Invalid Steam profile URL: ${profileUrl}`);
  }

  /**
   * Convert Steam ID (64-bit) to Steam ID32 (for Dota 2 Friend ID)
   * Steam ID64 format: 76561198000000000
   * Steam ID32 format: 86894490
   * Formula: Steam ID32 = (Steam ID64 - 76561197960265728) / 2
   */
  steamId64ToId32(steamId64: string): string {
    const bigInt = BigInt(steamId64);
    // Steam ID32 = (Steam ID64 - 76561197960265728) / 2
    const steamId32 = (bigInt - BigInt('76561197960265728')) / BigInt(2);
    return steamId32.toString();
  }

  /**
   * Convert Steam ID32 to Steam ID64
   * Formula: Steam ID64 = Steam ID32 * 2 + 76561197960265728
   */
  steamId32ToId64(steamId32: string): string {
    const bigInt = BigInt(steamId32);
    const steamId64 = bigInt * BigInt(2) + BigInt('76561197960265728');
    return steamId64.toString();
  }

  /**
   * Detect if a number is a Steam ID64 or ID32
   * Steam ID64: typically 17 digits, starts with 7656119
   * Steam ID32: typically 8-10 digits
   */
  detectSteamIdFormat(friendId: string): 'id32' | 'id64' | 'unknown' {
    const num = BigInt(friendId);
    // Steam ID64 typically starts with 7656119 and is 17 digits
    if (friendId.startsWith('7656119') && friendId.length >= 17) {
      return 'id64';
    }
    // Steam ID32 is typically 6-10 digits
    if (friendId.length >= 6 && friendId.length <= 10) {
      return 'id32';
    }
    return 'unknown';
  }

  /**
   * Normalize Friend ID - convert to ID32 format
   * Handles both ID64 and ID32 inputs
   */
  normalizeFriendId(friendId: string): string {
    const format = this.detectSteamIdFormat(friendId);
    if (format === 'id64') {
      // Convert ID64 to ID32
      return this.steamId64ToId32(friendId);
    }
    // Already ID32 or unknown - return as is
    return friendId;
  }

  /**
   * Verify if Steam profile is public
   * A public profile should return profile data, private profiles return 403 or error
   */
  async verifyProfileIsPublic(profileUrl: string): Promise<boolean> {
    try {
      // Extract Steam ID
      const steamId = await this.extractSteamId(profileUrl);

      // Try to access profile data via Steam API
      // Note: This requires a Steam API key. For now, we'll check if profile page is accessible
      try {
        const response = await axios.get(
          `${this.STEAM_PROFILE_BASE}/profiles/${steamId}/?xml=1`,
          {
            timeout: 10000,
            validateStatus: (status) => status < 500, // Don't throw on 4xx
          },
        );

        // If we get XML data, profile is likely public
        if (response.data && typeof response.data === 'string') {
          // Check for privacy indicators
          if (
            response.data.includes('<privacyState>public</privacyState>') ||
            response.data.includes('<personaname>') ||
            !response.data.includes('<privacyState>private</privacyState>')
          ) {
            return true;
          }
        }

        // If response is not XML or indicates private, check HTTP status
        if (response.status === 403 || response.status === 404) {
          return false;
        }

        // For other statuses, try parsing as public
        return response.status === 200;
      } catch (error) {
        // If axios error, check status code
        if (axios.isAxiosError(error)) {
          if (error.response?.status === 403 || error.response?.status === 404) {
            return false;
          }
        }
        // For other errors, assume private
        return false;
      }
    } catch (error) {
      throw new BadRequestException(
        `Could not verify Steam profile: ${error.message}`,
      );
    }
  }

  /**
   * Get Steam profile information
   */
  async getSteamProfileInfo(profileUrl: string): Promise<SteamProfileInfo> {
    const steamId = await this.extractSteamId(profileUrl);
    const isPublic = await this.verifyProfileIsPublic(profileUrl);

    const profileInfo: SteamProfileInfo = {
      steamId,
      profileUrl,
      isPublic,
    };

    if (isPublic) {
      try {
        // Try to get profile data from XML
        const response = await axios.get(
          `${this.STEAM_PROFILE_BASE}/profiles/${steamId}/?xml=1`,
          {
            timeout: 10000,
          },
        );

        if (response.data && typeof response.data === 'string') {
          // Extract persona name
          const personaMatch = response.data.match(/<personaname><!\[CDATA\[(.+?)\]\]><\/personaname>/);
          if (personaMatch) {
            profileInfo.personaName = personaMatch[1];
          }

          // Extract avatar URL
          const avatarMatch = response.data.match(/<avatarfull><!\[CDATA\[(.+?)\]\]><\/avatarfull>/);
          if (avatarMatch) {
            profileInfo.avatarUrl = avatarMatch[1];
          }
        }

        // Get Dota 2 Friend ID from Steam profile
        const dota2FriendId = this.steamId64ToId32(steamId);
        profileInfo.dota2FriendId = dota2FriendId;

        // Also try to extract Friend ID from profile XML if available
        // Steam profiles sometimes have a "steamID" field which is the ID32
        if (response.data && typeof response.data === 'string') {
          const steamIDMatch = response.data.match(/<steamID>(\d+)<\/steamID>/);
          if (steamIDMatch) {
            // Use the extracted ID32 if available (it's more reliable)
            profileInfo.dota2FriendId = steamIDMatch[1];
          }
        }

        // Generate Dotabuff profile URL
        profileInfo.dotabuffProfileUrl = this.getDotabuffProfileUrl(profileInfo.dota2FriendId);
      } catch (error) {
        // If we can't get additional info, at least we know it's public
        console.warn(`Could not fetch detailed Steam profile info: ${error.message}`);
      }
    }

    return profileInfo;
  }

  /**
   * Generate Dotabuff profile URL from Dota 2 Friend ID
   */
  getDotabuffProfileUrl(dota2FriendId: string): string {
    return `${this.DOTABUFF_BASE}/${dota2FriendId}`;
  }

  /**
   * Validate Steam profile URL format
   */
  validateSteamProfileUrl(url: string): boolean {
    const steamProfilePattern = /^https?:\/\/(www\.)?steamcommunity\.com\/(profiles\/\d+|id\/[a-zA-Z0-9_-]+)\/?$/;
    return steamProfilePattern.test(url);
  }
}

