#!/usr/bin/env node
/**
 * Script to download voice line audio files and upload them to Bunny CDN in batches
 * Updates the JSON file with Bunny CDN links while keeping original links
 * 
 * Usage:
 *   node scripts/upload-voice-lines-to-bunny.js
 * 
 * Required environment variables:
 *   BUNNY_STORAGE_ZONE - Your Bunny CDN storage zone name (default: df24)
 *   BUNNY_STORAGE_API_KEY - Your Bunny CDN storage API key
 *   BUNNY_STORAGE_REGION - Your Bunny CDN storage region (default: sg)
 * 
 * Optional environment variables:
 *   MAX_CONCURRENT - Maximum concurrent downloads/uploads (default: 20)
 *   BATCH_SIZE - Save progress after processing N voice lines (default: 50)
 *   VERIFY_EXISTING - Verify existing uploads on resume (default: true, set to 'false' to skip)
 */

const fs = require('fs');
const https = require('https');
const http = require('http');
const path = require('path');
const crypto = require('crypto');

// Configuration
const CONFIG = {
  storageZone: process.env.BUNNY_STORAGE_ZONE || 'df24',
  apiKey: process.env.BUNNY_STORAGE_API_KEY || '8b37fb58-0189-4802-a40f9e5884d5-8ebc-446d',
  region: process.env.BUNNY_STORAGE_REGION || 'sg',
  basePath: 'pasoll/subwars5/voicelines',
  jsonFilePath: path.join(__dirname, '..', 'assets', 'voice-lines', 'voice-lines.json'),
  maxConcurrent: parseInt(process.env.MAX_CONCURRENT || '20', 10), // Increased for batch processing
  batchSize: parseInt(process.env.BATCH_SIZE || '50', 10), // Save progress every N files
  verifyExisting: process.env.VERIFY_EXISTING !== 'false', // Verify existing uploads on resume (default: true)
  retryAttempts: 3,
  retryDelay: 2000, // 2 seconds
  downloadTimeout: 30000, // 30 seconds timeout for downloads
  uploadTimeout: 60000, // 60 seconds timeout for uploads
  verifyTimeout: 5000, // 5 seconds timeout for CDN verification
};

// Statistics
let stats = {
  total: 0,
  processed: 0,
  uploaded: 0,
  skipped: 0,
  failed: 0,
  errors: [],
  startTime: Date.now(),
};

/**
 * Sanitize hero name for file path
 */
function sanitizePath(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Get file extension from URL or filename
 */
function getFileExtension(url) {
  const match = url.match(/\.([a-z0-9]+)(?:[\?#]|$)/i);
  return match ? match[1].toLowerCase() : 'mp3';
}

/**
 * Generate a unique filename from the voice line name
 */
function generateFileName(voiceLineName, originalUrl) {
  const sanitized = sanitizePath(voiceLineName);
  const ext = getFileExtension(originalUrl);
  // Create a short hash to ensure uniqueness
  const hash = crypto.createHash('md5').update(originalUrl).digest('hex').substring(0, 8);
  return `${sanitized}-${hash}.${ext}`;
}

/**
 * Download file from URL with timeout
 */
function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const timeout = setTimeout(() => {
      reject(new Error('Download timeout'));
    }, CONFIG.downloadTimeout);
    
    const request = protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        clearTimeout(timeout);
        return downloadFile(response.headers.location).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        clearTimeout(timeout);
        reject(new Error(`Failed to download: ${response.statusCode} ${response.statusMessage}`));
        return;
      }
      
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        clearTimeout(timeout);
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      });
      response.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
    
    request.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    
    request.setTimeout(CONFIG.downloadTimeout, () => {
      clearTimeout(timeout);
      request.destroy();
      reject(new Error('Download timeout'));
    });
  });
}

/**
 * Upload file to Bunny CDN with timeout
 */
function uploadToBunny(filePath, fileBuffer, contentType) {
  return new Promise((resolve, reject) => {
    const fileSize = fileBuffer.length;
    const hostname = `${CONFIG.region}.storage.bunnycdn.com`;
    const apiPath = `/${CONFIG.storageZone}/${filePath}`;

    const options = {
      hostname,
      path: apiPath,
      method: 'PUT',
      headers: {
        'AccessKey': CONFIG.apiKey,
        'Content-Type': contentType || 'application/octet-stream',
        'Content-Length': fileSize,
        'accept': 'application/json',
      },
      timeout: CONFIG.uploadTimeout,
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        if (res.statusCode === 201 || res.statusCode === 200) {
          const cdnUrl = `https://${CONFIG.storageZone}.b-cdn.net/${filePath}`;
          resolve(cdnUrl);
        } else {
          reject(new Error(`Upload failed: ${res.statusCode} - ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request error: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Upload timeout'));
    });

    req.write(fileBuffer);
    req.end();
  });
}

/**
 * Verify if a file exists on Bunny CDN
 */
async function verifyFileExists(cdnUrl) {
  if (!CONFIG.verifyExisting) {
    return true; // Skip verification if disabled
  }
  
  return new Promise((resolve) => {
    const url = new URL(cdnUrl);
    const protocol = url.protocol === 'https:' ? https : http;
    
    const timeout = setTimeout(() => {
      resolve(false); // Timeout = assume file doesn't exist
    }, CONFIG.verifyTimeout);
    
    const req = protocol.request(url, { method: 'HEAD' }, (res) => {
      clearTimeout(timeout);
      resolve(res.statusCode === 200 || res.statusCode === 304);
    });
    
    req.on('error', () => {
      clearTimeout(timeout);
      resolve(false); // Error = assume file doesn't exist, will re-upload
    });
    
    req.on('timeout', () => {
      clearTimeout(timeout);
      req.destroy();
      resolve(false);
    });
    
    req.setTimeout(CONFIG.verifyTimeout);
    req.end();
  });
}

/**
 * Process a single voice line (download + upload)
 */
async function processVoiceLine(hero, voiceLine) {
  const { name, link, category, subCategory } = voiceLine;
  
  // Skip if already has Bunny CDN link (verify if enabled, but skip verification for speed)
  if (voiceLine.bunnyCdnLink) {
    if (CONFIG.verifyExisting) {
      // Only verify a sample to avoid slowing down resume
      // If bunnyCdnLink exists in JSON, assume it's valid (user can disable verification)
      const exists = await verifyFileExists(voiceLine.bunnyCdnLink);
      if (exists) {
        stats.skipped++;
        return voiceLine;
      }
      // File doesn't exist on CDN, continue with upload
      console.log(`  ⚠️  File missing on CDN, re-uploading: ${name}`);
    } else {
      // Skip verification, trust the JSON
      stats.skipped++;
      return voiceLine;
    }
  }

  try {
    // Step 1: Download the audio file
    const audioBuffer = await downloadFile(link);
    
    // Step 2: Generate file path in Bunny CDN
    const heroSanitized = sanitizePath(hero.hero);
    const fileName = generateFileName(name, link);
    const categoryPath = category ? sanitizePath(category) : 'misc';
    const subCategoryPath = subCategory ? sanitizePath(subCategory) : '';
    
    let bunnyPath;
    if (subCategoryPath) {
      bunnyPath = `${CONFIG.basePath}/${heroSanitized}/${categoryPath}/${subCategoryPath}/${fileName}`;
    } else {
      bunnyPath = `${CONFIG.basePath}/${heroSanitized}/${categoryPath}/${fileName}`;
    }
    
    // Step 3: Determine content type
    const ext = getFileExtension(link);
    const contentType = ext === 'ogg' ? 'audio/ogg' : ext === 'mp3' ? 'audio/mpeg' : 'application/octet-stream';
    
    // Step 4: Upload to Bunny CDN with retry
    let bunnyCdnLink;
    let lastError;
    
    for (let attempt = 1; attempt <= CONFIG.retryAttempts; attempt++) {
      try {
        bunnyCdnLink = await uploadToBunny(bunnyPath, audioBuffer, contentType);
        break;
      } catch (error) {
        lastError = error;
        if (attempt < CONFIG.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, CONFIG.retryDelay * attempt));
        }
      }
    }
    
    if (!bunnyCdnLink) {
      throw lastError || new Error('Upload failed after retries');
    }
    
    // Step 5: Update voice line with Bunny CDN link
    stats.uploaded++;
    return {
      ...voiceLine,
      bunnyCdnLink,
      bunnyCdnPath: bunnyPath,
    };
  } catch (error) {
    stats.failed++;
    stats.errors.push({
      hero: hero.hero,
      voiceLine: name,
      error: error.message,
      url: link,
    });
    // Return original voice line if upload fails
    return voiceLine;
  }
}

/**
 * Process a batch of voice lines with concurrency control
 */
async function processBatch(hero, voiceLines, heroIndex, batchIndex) {
  const results = [];
  const queue = voiceLines.map((vl, idx) => ({ voiceLine: vl, index: idx }));
  const semaphore = { count: 0 };
  
  return new Promise((resolve) => {
    function processNext() {
      // If queue is empty and all are processed, resolve
      if (queue.length === 0 && semaphore.count === 0) {
        resolve(results);
        return;
      }
      
      // If we're at max concurrent or queue is empty, wait
      if (semaphore.count >= CONFIG.maxConcurrent || queue.length === 0) {
        return;
      }
      
      const item = queue.shift();
      semaphore.count++;
      
      processVoiceLine(hero, item.voiceLine)
        .then((result) => {
          results[item.index] = result;
          stats.processed++;
          
          // Progress update every 10 files or on completion
          if (stats.processed % 10 === 0 || stats.processed === stats.total) {
            const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1);
            const rate = (stats.processed / elapsed).toFixed(2);
            const remaining = stats.total - stats.processed;
            const eta = remaining > 0 ? ((remaining / rate) / 60).toFixed(1) : 0;
            
            console.log(`  📊 Progress: ${stats.processed}/${stats.total} (${stats.uploaded} uploaded, ${stats.failed} failed, ${stats.skipped} skipped) | Rate: ${rate}/s | ETA: ${eta}m`);
          }
        })
        .catch((error) => {
          console.error(`  ❌ Error: ${error.message}`);
          results[item.index] = item.voiceLine; // Keep original on error
          stats.processed++;
        })
        .finally(() => {
          semaphore.count--;
          processNext();
        });
      
      // Process next item immediately if we're under the limit
      if (semaphore.count < CONFIG.maxConcurrent) {
        processNext();
      }
    }
    
    // Start processing
    for (let i = 0; i < Math.min(CONFIG.maxConcurrent, queue.length); i++) {
      processNext();
    }
  });
}

/**
 * Save progress to JSON file
 */
function saveProgress(heroes) {
  try {
    const jsonData = { heroes };
    fs.writeFileSync(CONFIG.jsonFilePath, JSON.stringify(jsonData, null, 2));
    return true;
  } catch (error) {
    console.error(`  ⚠️  Failed to save progress: ${error.message}`);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('🚀 Starting Batch Voice Lines Upload to Bunny CDN\n');
    console.log(`Storage Zone: ${CONFIG.storageZone}`);
    console.log(`Region: ${CONFIG.region}`);
    console.log(`Base Path: ${CONFIG.basePath}`);
    console.log(`Max Concurrent: ${CONFIG.maxConcurrent}`);
    console.log(`Batch Size: ${CONFIG.batchSize} (save progress every N files)`);
    console.log(`Verify Existing: ${CONFIG.verifyExisting ? 'Yes' : 'No'}\n`);

    // Load JSON file
    console.log('📖 Loading voice-lines.json...');
    const jsonData = JSON.parse(fs.readFileSync(CONFIG.jsonFilePath, 'utf-8'));
    let heroes = jsonData.heroes || [];
    
    console.log(`Found ${heroes.length} heroes\n`);

    // Calculate total voice lines and check resume status
    let totalWithLinks = 0;
    let totalWithoutLinks = 0;
    
    heroes.forEach(hero => {
      (hero.voiceLines || []).forEach(vl => {
        if (vl.bunnyCdnLink) {
          totalWithLinks++;
        } else {
          totalWithoutLinks++;
        }
      });
    });
    
    stats.total = totalWithLinks + totalWithoutLinks;
    
    console.log(`📊 Resume Status:`);
    console.log(`  Total voice lines: ${stats.total}`);
    console.log(`  ✅ Already uploaded: ${totalWithLinks} (will skip)`);
    console.log(`  ⏳ Pending upload: ${totalWithoutLinks}`);
    
    if (totalWithLinks > 0) {
      if (CONFIG.verifyExisting) {
        console.log(`\n  ℹ️  Will verify existing uploads before skipping (set VERIFY_EXISTING=false to skip verification)`);
      } else {
        console.log(`\n  ⚡ Verification disabled - will skip all existing uploads without checking`);
      }
    }
    console.log();

    // Create backup before starting
    const backupPath = CONFIG.jsonFilePath + '.backup.' + Date.now();
    fs.writeFileSync(backupPath, JSON.stringify(jsonData, null, 2));
    console.log(`✅ Backup created: ${backupPath}\n`);

    // Process each hero
    let processedCount = 0;
    for (let heroIndex = 0; heroIndex < heroes.length; heroIndex++) {
      const hero = heroes[heroIndex];
      const voiceLines = hero.voiceLines || [];
      
      if (voiceLines.length === 0) continue;
      
      console.log(`[${heroIndex + 1}/${heroes.length}] 🎭 Processing ${hero.hero} (${voiceLines.length} voice lines)...`);
      
      // Process all voice lines for this hero in parallel
      const updatedVoiceLines = await processBatch(hero, voiceLines, heroIndex, 0);
      heroes[heroIndex].voiceLines = updatedVoiceLines;
      processedCount += voiceLines.length;
      
      // Save progress periodically (every batch size)
      if (processedCount >= CONFIG.batchSize || heroIndex === heroes.length - 1) {
        console.log(`  💾 Saving progress...`);
        saveProgress(heroes);
        processedCount = 0;
      }
      
      console.log(`  ✅ Completed ${hero.hero}\n`);
    }

    // Final save
    console.log('💾 Saving final JSON file...');
    saveProgress(heroes);

    // Print summary
    const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1);
    const rate = (stats.processed / elapsed).toFixed(2);
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 Upload Summary');
    console.log('='.repeat(70));
    console.log(`Total voice lines: ${stats.total}`);
    console.log(`✅ Uploaded: ${stats.uploaded}`);
    console.log(`⏭️  Skipped (already uploaded): ${stats.skipped}`);
    console.log(`❌ Failed: ${stats.failed}`);
    console.log(`📝 Processed: ${stats.processed}`);
    console.log(`⏱️  Time elapsed: ${(elapsed / 60).toFixed(1)} minutes`);
    console.log(`📈 Average rate: ${rate} files/second`);
    
    if (stats.errors.length > 0) {
      console.log('\n⚠️  Errors (first 10):');
      stats.errors.slice(0, 10).forEach((err) => {
        console.log(`  - ${err.hero} / ${err.voiceLine}: ${err.error}`);
      });
      if (stats.errors.length > 10) {
        console.log(`  ... and ${stats.errors.length - 10} more errors`);
      }
      
      // Save errors to file
      const errorPath = path.join(__dirname, '..', 'assets', 'voice-lines', 'upload-errors.json');
      fs.writeFileSync(errorPath, JSON.stringify(stats.errors, null, 2));
      console.log(`\n📄 All errors saved to: ${errorPath}`);
    }

    console.log(`\n✅ Process completed!`);
    console.log(`\n🌐 CDN Base URL: https://${CONFIG.storageZone}.b-cdn.net/${CONFIG.basePath}/`);

  } catch (error) {
    console.error('\n❌ Fatal Error:', error.message);
    console.error(error.stack);
    
    // Try to save progress even on error
    console.log('\n💾 Attempting to save progress...');
    try {
      const jsonData = JSON.parse(fs.readFileSync(CONFIG.jsonFilePath, 'utf-8'));
      saveProgress(jsonData.heroes);
      console.log('✅ Progress saved');
    } catch (e) {
      console.error('❌ Failed to save progress:', e.message);
    }
    
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { processVoiceLine, uploadToBunny, downloadFile };
