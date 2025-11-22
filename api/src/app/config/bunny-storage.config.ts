import { registerAs } from '@nestjs/config';

export interface BunnyStorageConfig {
  storageZone: string;
  apiKey: string;
  region: string;
  cdnUrl: string;
}

export default registerAs('bunnyStorage', (): BunnyStorageConfig => {
  const storageZone = process.env.BUNNY_STORAGE_ZONE;
  const apiKey = process.env.BUNNY_STORAGE_API_KEY;
  const region = process.env.BUNNY_STORAGE_REGION || 'ny'; // Default to New York
  const cdnUrl = process.env.BUNNY_CDN_URL || `https://${storageZone}.b-cdn.net`;

  if (!storageZone || !apiKey) {
    throw new Error(
      'Bunny CDN Storage credentials are required:\n' +
      '  BUNNY_STORAGE_ZONE - Your Bunny CDN storage zone name\n' +
      '  BUNNY_STORAGE_API_KEY - Your Bunny CDN storage API key\n' +
      '  BUNNY_STORAGE_REGION - (Optional) Storage region (default: ny)\n' +
      '  BUNNY_CDN_URL - (Optional) CDN URL (default: https://{storageZone}.b-cdn.net)\n\n' +
      'Get these from: https://bunnycdn.com/dashboard/storagezones'
    );
  }

  return {
    storageZone,
    apiKey,
    region,
    cdnUrl,
  };
});

