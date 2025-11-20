/**
 * Utility functions for Dotabuff profile links
 */

/**
 * Generate Dotabuff profile URL from Dota 2 Friend ID (Steam ID32)
 * @param dota2FriendId - The Dota 2 Friend ID (Steam ID32)
 * @returns Dotabuff profile URL
 */
export function getDotabuffProfileUrl(dota2FriendId: string): string {
  return `https://www.dotabuff.com/players/${dota2FriendId}`;
}

/**
 * Extract Dota 2 Friend ID from Steam ID64
 * Steam ID64 format: 76561198000000000
 * Steam ID32 format: 86894490
 * @param steamId64 - The Steam ID64
 * @returns The Dota 2 Friend ID (Steam ID32)
 */
export function steamId64ToId32(steamId64: string): string {
  const bigInt = BigInt(steamId64);
  // Steam ID32 = (Steam ID64 - 76561197960265728) / 2
  const steamId32 = (bigInt - BigInt('76561197960265728')) / BigInt(2);
  return steamId32.toString();
}

/**
 * Validate Dota 2 Friend ID format
 * @param friendId - The Friend ID to validate
 * @returns True if valid format
 */
export function validateDota2FriendId(friendId: string): boolean {
  // Dota 2 Friend ID should be numeric, typically 8-10 digits
  return /^\d{6,10}$/.test(friendId);
}

