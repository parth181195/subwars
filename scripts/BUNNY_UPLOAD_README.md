# Upload Voice Lines to Bunny CDN

This script uploads the `voice-lines.json` file to Bunny CDN Storage.

## Prerequisites

1. Create a Bunny CDN account at https://bunnycdn.com
2. Create a Storage Zone in your Bunny CDN dashboard
3. Get your Storage Zone name and API key from: https://bunnycdn.com/dashboard/storagezones

## Setup

1. Set environment variables:

```bash
export BUNNY_STORAGE_ZONE=your-storage-zone-name
export BUNNY_STORAGE_API_KEY=your-bunny-storage-api-key
export BUNNY_STORAGE_REGION=ny  # Optional: 'ny', 'la', 'sg', 'de', etc. (default: 'ny')
```

Or create a `.env` file in the project root:

```bash
BUNNY_STORAGE_ZONE=your-storage-zone-name
BUNNY_STORAGE_API_KEY=your-bunny-storage-api-key
BUNNY_STORAGE_REGION=ny
```

## Usage

Run the upload script:

```bash
node scripts/upload-to-bunny.js
```

Or with environment variables inline:

```bash
BUNNY_STORAGE_ZONE=your-zone BUNNY_STORAGE_API_KEY=your-key node scripts/upload-to-bunny.js
```

## What it does

1. Reads `assets/voice-lines/voice-lines.json` (15MB file)
2. Uploads it to Bunny CDN Storage at path: `voice-lines/voice-lines.json`
3. Returns the CDN URL: `https://your-storage-zone-name.b-cdn.net/voice-lines/voice-lines.json`

## Bunny CDN Regions

Available regions:
- `ny` - New York (default)
- `la` - Los Angeles
- `sg` - Singapore
- `de` - Germany
- `uk` - United Kingdom
- `fi` - Finland
- And more...

Choose the region closest to your users.

## Accessing the File

After upload, the file will be accessible at:
```
https://YOUR_STORAGE_ZONE_NAME.b-cdn.net/voice-lines/voice-lines.json
```

The file will be publicly accessible by default. If you need private access, you can:
1. Configure access in Bunny CDN dashboard
2. Use signed URLs (requires additional configuration)

