#!/usr/bin/env node
/**
 * Script to upload voice-lines.json to Bunny CDN Storage
 * 
 * Usage:
 *   node scripts/upload-to-bunny.js
 * 
 * Required environment variables:
 *   BUNNY_STORAGE_ZONE - Your Bunny CDN storage zone name
 *   BUNNY_STORAGE_API_KEY - Your Bunny CDN storage API key
 *   BUNNY_STORAGE_REGION - Your Bunny CDN storage region (e.g., 'ny', 'la', 'sg', 'de')
 */

const fs = require('fs');
const https = require('https');
const path = require('path');
const readline = require('readline');

function getBunnyConfig() {
  const storageZone = process.env.BUNNY_STORAGE_ZONE;
  const apiKey = process.env.BUNNY_STORAGE_API_KEY;
  const region = process.env.BUNNY_STORAGE_REGION || 'ny'; // Default to New York

  if (!storageZone || !apiKey) {
    throw new Error(
      'Missing required environment variables:\n' +
      '  BUNNY_STORAGE_ZONE - Your Bunny CDN storage zone name\n' +
      '  BUNNY_STORAGE_API_KEY - Your Bunny CDN storage API key\n' +
      '  BUNNY_STORAGE_REGION - (Optional) Storage region (default: ny)\n\n' +
      'Get these from: https://bunnycdn.com/dashboard/storagezones'
    );
  }

  return { storageZone, apiKey, region };
}

function uploadFileToBunny(filePath, remotePath, config) {
  return new Promise((resolve, reject) => {
    const fileBuffer = fs.readFileSync(filePath);
    const fileSize = fileBuffer.length;

    // Bunny CDN Storage API endpoint
    const hostname = `${config.region}.storage.bunnycdn.com`;
    const apiPath = `/${config.storageZone}/${remotePath}`;

    const options = {
      hostname,
      path: apiPath,
      method: 'PUT',
      headers: {
        'AccessKey': config.apiKey,
        'Content-Type': 'application/octet-stream', // Binary format as per Bunny CDN docs
        'Content-Length': fileSize,
        'accept': 'application/json',
      },
    };

    console.log(`Uploading to: https://${hostname}${apiPath}`);
    console.log(`File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 201 || res.statusCode === 200) {
          // Construct the CDN URL
          // Bunny CDN URLs are typically: https://STORAGE_ZONE_NAME.b-cdn.net/PATH
          const cdnUrl = `https://${config.storageZone}.b-cdn.net/${remotePath}`;
          console.log(`✓ Upload successful!`);
          console.log(`✓ Status Code: ${res.statusCode}`);
          console.log(`✓ CDN URL: ${cdnUrl}`);
          resolve(cdnUrl);
        } else if (res.statusCode === 401) {
          reject(
            new Error(
              `Unauthorized (401): ${responseData || res.statusMessage}\n` +
              `This usually means:\n` +
              `  1. The storage zone name is incorrect (current: "${config.storageZone}")\n` +
              `  2. The API key doesn't match this storage zone\n` +
              `  3. Check your Bunny CDN dashboard: https://bunnycdn.com/dashboard/storagezones\n` +
              `     - The storage zone name is shown at the top of the storage zone page\n` +
              `     - Get the API key from "FTP & API Access" section\n`
            )
          );
        } else {
          reject(
            new Error(
              `Upload failed with status ${res.statusCode}: ${responseData || res.statusMessage}`
            )
          );
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request error: ${error.message}`));
    });

    // Upload the file
    req.write(fileBuffer);
    req.end();

    // Progress indicator
    let uploaded = 0;
    const progressInterval = setInterval(() => {
      uploaded += 1024 * 1024; // Increment by 1MB
      const percent = Math.min(100, ((uploaded / fileSize) * 100).toFixed(1));
      process.stdout.write(`\rUpload progress: ${percent}%`);
    }, 500);

    req.on('finish', () => {
      clearInterval(progressInterval);
      process.stdout.write('\rUpload progress: 100%     \n');
    });
  });
}

async function main() {
  try {
    console.log('🚀 Bunny CDN Upload Script\n');

    // Get configuration
    const config = getBunnyConfig();
    console.log(`Storage Zone: ${config.storageZone}`);
    console.log(`Region: ${config.region}\n`);

    // File paths
    const projectRoot = path.resolve(__dirname, '..');
    const localFilePath = path.join(projectRoot, 'assets/voice-lines/voice-lines.json');
    const remotePath = 'pasoll/subwars5/voicelines/voice-lines.json';

    // Check if file exists
    if (!fs.existsSync(localFilePath)) {
      throw new Error(`File not found: ${localFilePath}`);
    }

    const stats = fs.statSync(localFilePath);
    console.log(`File: ${localFilePath}`);
    console.log(`Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Remote path: ${remotePath}\n`);

    // Confirm upload
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise((resolve) => {
      rl.question('Continue with upload? (yes/no): ', resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
      console.log('Upload cancelled.');
      process.exit(0);
    }

    console.log('\nStarting upload...\n');

    // Upload file
    const cdnUrl = await uploadFileToBunny(localFilePath, remotePath, config);

    console.log('\n✅ Upload completed successfully!');
    console.log(`\nCDN URL: ${cdnUrl}`);
    console.log('\nYou can access the file at the CDN URL above.');

  } catch (error) {
    console.error('\n❌ Error:', error.message || error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { uploadFileToBunny, getBunnyConfig };

