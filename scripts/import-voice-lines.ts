#!/usr/bin/env tsx

/**
 * Import Voice Lines to PostgreSQL
 * 
 * Efficiently imports voice lines from JSON file to PostgreSQL database.
 * Uses bulk inserts with transactions for optimal performance.
 * 
 * Usage:
 *   tsx scripts/import-voice-lines.ts [path/to/voice-lines.json]
 * 
 * Default: assets/voice-lines/voice-lines.json
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

interface VoiceLineData {
  name: string;
  link: string;
  category?: string;
  bunnyCdnLink?: string;
  bunnyCdnPath?: string;
}

interface HeroData {
  hero: string;
  url: string;
  voiceLines: VoiceLineData[];
}

interface VoiceLinesJson {
  heroes: HeroData[];
}

// Try to load .env from api directory first, then root
const envPath = fs.existsSync(path.join(__dirname, '../api/.env'))
  ? path.join(__dirname, '../api/.env')
  : path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

// Database configuration from environment
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sub_wars_5',
};

// Validate password is a string (required for PostgreSQL)
if (!dbConfig.password || typeof dbConfig.password !== 'string') {
  console.error('❌ Error: DB_PASSWORD must be set in environment or .env file');
  console.error(`   Check: ${envPath}`);
  process.exit(1);
}

// Batch size for bulk inserts (PostgreSQL optimal: 1000-10000)
const BATCH_SIZE = 5000;

// Create connection pool
const pool = new Pool({
  ...dbConfig,
  max: 10, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

/**
 * Generate a deterministic UUID from hero name and voice line name
 * This ensures idempotency - same voice line always gets same ID
 */
function generateId(heroName: string, voiceLineName: string): string {
  const input = `${heroName}:${voiceLineName}`;
  const hash = crypto.createHash('sha256').update(input).digest('hex');
  // Convert to UUID format (version 5 style)
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '5' + hash.substring(13, 16), // Version 5
    ((parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80).toString(16) + hash.substring(18, 20), // Variant
    hash.substring(20, 32),
  ].join('-');
}

/**
 * Prepare voice line data for insertion
 */
function prepareVoiceLine(heroName: string, voiceLine: VoiceLineData, scrapedAt: Date) {
  return {
    id: generateId(heroName, voiceLine.name),
    hero_name: heroName,
    name: voiceLine.name,
    url: voiceLine.link || voiceLine.bunnyCdnLink || '',
    bunny_cdn_link: voiceLine.bunnyCdnLink || null,
    bunny_cdn_path: voiceLine.bunnyCdnPath || null,
    category: voiceLine.category || null,
    line_text: null, // Can be populated later if needed
    scraped_at: scrapedAt,
  };
}

/**
 * Bulk insert voice lines using parameterized INSERT (optimized for PostgreSQL)
 * Uses ON CONFLICT for idempotency - safe to run multiple times
 */
async function bulkInsertVoiceLines(voiceLines: any[], client: any): Promise<number> {
  if (voiceLines.length === 0) return 0;

  // Build parameterized query for bulk insert
  // PostgreSQL handles large parameterized queries very efficiently
  const values: any[] = [];
  const placeholders: string[] = [];
  let paramIndex = 1;

  for (const vl of voiceLines) {
    placeholders.push(
      `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`
    );
    values.push(
      vl.id,
      vl.hero_name,
      vl.name,
      vl.url,
      vl.bunny_cdn_link,
      vl.bunny_cdn_path,
      vl.category,
      vl.line_text,
      vl.scraped_at,
    );
  }

  // Use ON CONFLICT for idempotency (safe to re-run)
  const query = `
    INSERT INTO voice_lines (
      id, hero_name, name, url, bunny_cdn_link, bunny_cdn_path, category, line_text, scraped_at
    ) VALUES ${placeholders.join(', ')}
    ON CONFLICT (id) DO UPDATE SET
      hero_name = EXCLUDED.hero_name,
      name = EXCLUDED.name,
      url = EXCLUDED.url,
      bunny_cdn_link = EXCLUDED.bunny_cdn_link,
      bunny_cdn_path = EXCLUDED.bunny_cdn_path,
      category = EXCLUDED.category,
      line_text = EXCLUDED.line_text,
      scraped_at = EXCLUDED.scraped_at,
      updated_at = CURRENT_TIMESTAMP
  `;

  const result = await client.query(query, values);
  return result.rowCount || 0;
}

/**
 * Import voice lines from JSON file
 */
async function importVoiceLines(jsonPath: string): Promise<void> {
  console.log('📖 Reading voice lines JSON file...');
  const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
  const data: VoiceLinesJson = JSON.parse(jsonContent);

  if (!data.heroes || !Array.isArray(data.heroes)) {
    throw new Error('Invalid JSON structure: expected "heroes" array');
  }

  console.log(`✅ Found ${data.heroes.length} heroes`);
  
  // Count total voice lines
  const totalVoiceLines = data.heroes.reduce((sum, hero) => sum + hero.voiceLines.length, 0);
  console.log(`📊 Total voice lines to import: ${totalVoiceLines}`);

  // Get client from pool for transaction
  const client = await pool.connect();
  const scrapedAt = new Date();

  try {
    await client.query('BEGIN');

    console.log('🚀 Starting bulk import...');
    let imported = 0;
    let skipped = 0;
    const allVoiceLines: any[] = [];

    // Prepare all voice lines
    for (const hero of data.heroes) {
      for (const voiceLine of hero.voiceLines) {
        allVoiceLines.push(prepareVoiceLine(hero.hero, voiceLine, scrapedAt));
      }
    }

    console.log(`📦 Processing ${allVoiceLines.length} voice lines in batches of ${BATCH_SIZE}...`);

    // Process in batches
    for (let i = 0; i < allVoiceLines.length; i += BATCH_SIZE) {
      const batch = allVoiceLines.slice(i, i + BATCH_SIZE);
      const inserted = await bulkInsertVoiceLines(batch, client);
      imported += inserted;
      
      const progress = ((i + batch.length) / allVoiceLines.length * 100).toFixed(1);
      console.log(`  ⏳ Progress: ${progress}% (${i + batch.length}/${allVoiceLines.length} processed)`);
    }

    await client.query('COMMIT');
    
    console.log('\n✅ Import completed successfully!');
    console.log(`   📈 Imported/Updated: ${imported} voice lines`);
    console.log(`   ⏭️  Skipped (duplicates): ${totalVoiceLines - imported} voice lines`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Main function
 */
async function main() {
  const jsonPath = process.argv[2] || path.join(__dirname, '../assets/voice-lines/voice-lines.json');

  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ Error: File not found: ${jsonPath}`);
    process.exit(1);
  }

  console.log('🎯 Voice Lines Import Script');
  console.log('=' .repeat(50));
  console.log(`📁 JSON File: ${jsonPath}`);
  console.log(`🗄️  Database: ${dbConfig.database}@${dbConfig.host}:${dbConfig.port}`);
  console.log('=' .repeat(50));
  console.log('');

  try {
    // Test database connection
    console.log('🔌 Testing database connection...');
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful\n');

    // Import voice lines
    const startTime = Date.now();
    await importVoiceLines(jsonPath);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`\n⏱️  Total time: ${duration}s`);
    
  } catch (error) {
    console.error('\n❌ Error during import:');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

