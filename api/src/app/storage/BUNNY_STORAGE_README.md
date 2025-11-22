# Bunny CDN Storage Configuration

This service provides integration with Bunny CDN Storage for hosting static files like `voice-lines.json` and other assets.

## Setup

### 1. Create Bunny CDN Account

1. Sign up at https://bunnycdn.com
2. Create a Storage Zone in your dashboard: https://bunnycdn.com/dashboard/storagezones
3. Click on your storage zone to view settings

### 2. Get Your Credentials

In your Storage Zone settings, go to **FTP & API Access**:
- **Storage Zone Name**: The name you gave your storage zone (e.g., `pasoll-contest`)
- **Password**: This is your API key (click "View" to reveal it)
- **Region**: Choose the region closest to your users (e.g., `ny`, `la`, `sg`, `de`, `uk`, `fi`)

### 3. Configure Environment Variables

Add to your `.env` file:

```env
# Bunny CDN Storage Configuration
BUNNY_STORAGE_ZONE=your-storage-zone-name
BUNNY_STORAGE_API_KEY=your-bunny-storage-api-key
BUNNY_STORAGE_REGION=ny
BUNNY_CDN_URL=https://your-storage-zone-name.b-cdn.net
```

**Note**: `BUNNY_STORAGE_REGION` and `BUNNY_CDN_URL` are optional. If not provided:
- `BUNNY_STORAGE_REGION` defaults to `ny` (New York)
- `BUNNY_CDN_URL` defaults to `https://{storageZone}.b-cdn.net`

### 4. Usage

Inject `BunnyStorageService` into your services:

```typescript
import { Injectable } from '@nestjs/common';
import { BunnyStorageService } from '../storage/bunny-storage.service';

@Injectable()
export class YourService {
  constructor(private bunnyStorage: BunnyStorageService) {}

  async uploadVoiceLinesJson(jsonBuffer: Buffer) {
    const cdnUrl = await this.bunnyStorage.uploadVoiceLinesJson(jsonBuffer);
    return cdnUrl; // https://your-zone.b-cdn.net/voice-lines/voice-lines.json
  }

  async uploadImage(filePath: string, fileBuffer: Buffer, mimeType: string) {
    const cdnUrl = await this.bunnyStorage.uploadImage(filePath, fileBuffer, mimeType);
    return cdnUrl;
  }

  async uploadFile(filePath: string, fileBuffer: Buffer, contentType: string) {
    const cdnUrl = await this.bunnyStorage.uploadFile(filePath, fileBuffer, contentType);
    return cdnUrl;
  }
}
```

## Available Methods

### `uploadFile(filePath, fileBuffer, contentType)`
Upload any file to Bunny CDN Storage.
- `filePath`: Remote path (e.g., `voice-lines/voice-lines.json`)
- `fileBuffer`: File content as Buffer
- `contentType`: MIME type (e.g., `application/json`, `image/png`)

### `uploadFileFromMulter(filePath, file)`
Upload a file from Express Multer file object.
- `filePath`: Remote path
- `file`: Express.Multer.File

### `uploadVoiceLinesJson(fileBuffer)`
Convenience method to upload voice-lines.json.
- `fileBuffer`: JSON file content as Buffer
- Returns: CDN URL (`https://your-zone.b-cdn.net/voice-lines/voice-lines.json`)

### `uploadImage(filePath, fileBuffer, mimeType)`
Upload an image file.
- `filePath`: Remote path (e.g., `uploads/user-id/image.png`)
- `fileBuffer`: Image file content as Buffer
- `mimeType`: Image MIME type (e.g., `image/png`, `image/jpeg`)

### `deleteFile(filePath)`
Delete a file from Bunny CDN Storage.
- `filePath`: Remote path to delete

### `getCdnUrl(filePath)`
Get the CDN URL for a file path without uploading.
- `filePath`: Remote path
- Returns: Full CDN URL

## Bunny CDN Regions

Available regions:
- `ny` - New York (default)
- `la` - Los Angeles
- `sg` - Singapore
- `de` - Germany
- `uk` - United Kingdom
- `fi` - Finland
- And more...

Choose the region closest to your users for best performance.

## CDN URLs

Files uploaded to Bunny CDN are accessible via:
```
https://{STORAGE_ZONE_NAME}.b-cdn.net/{FILE_PATH}
```

Example:
```
https://pasoll-contest.b-cdn.net/voice-lines/voice-lines.json
```

All files uploaded are **publicly accessible** by default. If you need private access:
1. Configure access settings in Bunny CDN dashboard
2. Use signed URLs (requires additional configuration)

