import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs-extra';
import * as path from 'path';

interface ScrapeStatus {
  isRunning: boolean;
  currentHero?: string;
  totalHeroes?: number;
  completedHeroes?: number;
  downloadedFiles?: number;
  errors?: string[];
}

interface VoiceLineMetadata {
  heroName: string;
  fileName: string;
  filePath: string;
  originalUrl: string;
  responseType?: string;
  scrapedAt: string;
}

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);
  private status: ScrapeStatus = {
    isRunning: false,
    downloadedFiles: 0,
    errors: [],
  };

  private readonly BASE_URL = 'https://dota2.fandom.com';
  private readonly CATEGORY_URL = `${this.BASE_URL}/wiki/Category:Responses`;
  
  /**
   * Get the voice lines directory path
   * Works from both development and built locations
   */
  private getVoiceLinesDir(): string {
    const cwd = process.cwd();
    // If running from scraper-service folder (development)
    if (cwd.includes('scraper-service')) {
      return path.join(cwd, '..', 'assets', 'voice-lines');
    }
    // If running from dist/scraper-service folder (production)
    if (cwd.includes('dist')) {
      return path.join(cwd, '..', '..', 'assets', 'voice-lines');
    }
    // Fallback: from root
    return path.join(cwd, 'assets', 'voice-lines');
  }

  /**
   * Start scraping Dota 2 wiki for voice lines
   */
  async startScraping(): Promise<{ message: string }> {
    if (this.status.isRunning) {
      return { message: 'Scraper is already running' };
    }

    this.status = {
      isRunning: true,
      currentHero: undefined,
      totalHeroes: 0,
      completedHeroes: 0,
      downloadedFiles: 0,
      errors: [],
    };

    // Run scraping in background
    this.scrapeVoiceLines().catch((error) => {
      this.logger.error('Scraping failed:', error);
      this.status.isRunning = false;
      this.status.errors?.push(error.message);
    });

    return { message: 'Scraping started successfully' };
  }

  /**
   * Get current scraping status
   */
  getStatus(): ScrapeStatus {
    return { ...this.status };
  }

  /**
   * Main scraping logic
   */
  private async scrapeVoiceLines(): Promise<void> {
    try {
      this.logger.log('Starting Dota 2 voice line scraper...');

      // Ensure voice-lines directory exists
      const voiceLinesDir = this.getVoiceLinesDir();
      await fs.ensureDir(voiceLinesDir);

      // Step 1: Get all hero pages from category
      this.logger.log('Fetching hero list from category page...');
      const heroPages = await this.getHeroPages();
      this.status.totalHeroes = heroPages.length;
      this.logger.log(`Found ${heroPages.length} hero pages`);

      // Step 2: Scrape each hero page
      for (let i = 0; i < heroPages.length; i++) {
        const heroPage = heroPages[i];
        this.status.currentHero = heroPage.heroName;
        this.status.completedHeroes = i;

        this.logger.log(`[${i + 1}/${heroPages.length}] Scraping ${heroPage.heroName}...`);

        try {
          await this.scrapeHeroPage(heroPage);
        } catch (error) {
          const errorMsg = `Failed to scrape ${heroPage.heroName}: ${error.message}`;
          this.logger.error(errorMsg);
          this.status.errors?.push(errorMsg);
        }

        // Small delay to avoid overwhelming the server
        await this.delay(500);
      }

      this.status.isRunning = false;
      this.status.completedHeroes = heroPages.length;
      this.status.currentHero = undefined;

      this.logger.log(
        `Scraping completed! Downloaded ${this.status.downloadedFiles} voice lines`
      );
    } catch (error) {
      this.status.isRunning = false;
      this.status.errors?.push(error.message);
      throw error;
    }
  }

  /**
   * Get all hero pages from the category page
   */
  private async getHeroPages(): Promise<Array<{ heroName: string; url: string }>> {
    try {
      const response = await axios.get(this.CATEGORY_URL, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      const $ = cheerio.load(response.data);
      const heroPages: Array<{ heroName: string; url: string }> = [];

      // Find all links to hero response pages
      // The category page lists heroes with links like "/wiki/Hero_Name/Responses"
      $('a[href*="/Responses"]').each((_, element) => {
        const href = $(element).attr('href');
        if (href && href.includes('/Responses')) {
          const heroName = this.extractHeroNameFromUrl(href);
          if (heroName) {
            const fullUrl = href.startsWith('http')
              ? href
              : `${this.BASE_URL}${href}`;
            heroPages.push({ heroName, url: fullUrl });
          }
        }
      });

      // Remove duplicates
      const uniqueHeroes = Array.from(
        new Map(heroPages.map((h) => [h.heroName, h])).values()
      );

      return uniqueHeroes;
    } catch (error) {
      this.logger.error('Failed to fetch category page:', error);
      throw error;
    }
  }

  /**
   * Extract hero name from URL
   */
  private extractHeroNameFromUrl(url: string): string | null {
    // URL format: /wiki/Hero_Name/Responses or /wiki/Hero_Name/Responses#Section
    const match = url.match(/\/wiki\/([^\/]+)\/Responses/);
    if (match && match[1]) {
      // Replace underscores with spaces and clean up
      return match[1].replace(/_/g, ' ').trim();
    }
    return null;
  }

  /**
   * Scrape a single hero page for voice lines
   */
  private async scrapeHeroPage(heroPage: {
    heroName: string;
    url: string;
  }): Promise<void> {
    try {
      const response = await axios.get(heroPage.url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      const $ = cheerio.load(response.data);
      const voiceLinesDir = this.getVoiceLinesDir();
      const heroDir = path.join(
        voiceLinesDir,
        this.sanitizeFileName(heroPage.heroName)
      );
      await fs.ensureDir(heroDir);

      // Find all audio file links
      // Audio files are typically in <audio> tags or links to .ogg/.mp3 files
      const audioLinks = new Set<string>();

      // Method 1: Find <audio> tags with src attribute
      $('audio source').each((_, element) => {
        const src = $(element).attr('src');
        if (src && (src.endsWith('.ogg') || src.endsWith('.mp3'))) {
          const fullUrl = src.startsWith('http') ? src : `${this.BASE_URL}${src}`;
          audioLinks.add(fullUrl);
        }
      });

      // Method 2: Find direct links to audio files
      $('a[href$=".ogg"], a[href$=".mp3"]').each((_, element) => {
        const href = $(element).attr('href');
        if (href) {
          const fullUrl = href.startsWith('http') ? href : `${this.BASE_URL}${href}`;
          audioLinks.add(fullUrl);
        }
      });

      // Method 3: Find links in response sections that might point to audio
      $('.mw-parser-output a').each((_, element) => {
        const href = $(element).attr('href');
        if (href && (href.includes('.ogg') || href.includes('.mp3'))) {
          const fullUrl = href.startsWith('http') ? href : `${this.BASE_URL}${href}`;
          audioLinks.add(fullUrl);
        }
      });

      this.logger.log(
        `Found ${audioLinks.size} audio links for ${heroPage.heroName}`
      );

      // Download each audio file
      let fileIndex = 1;
      const metadata: VoiceLineMetadata[] = [];

      for (const audioUrl of audioLinks) {
        try {
          const fileName = await this.downloadAudioFile(
            audioUrl,
            heroDir,
            heroPage.heroName,
            fileIndex
          );

          if (fileName) {
            metadata.push({
              heroName: heroPage.heroName,
              fileName,
              filePath: path.join(heroDir, fileName).replace(process.cwd(), ''),
              originalUrl: audioUrl,
              scrapedAt: new Date().toISOString(),
            });

            fileIndex++;
            this.status.downloadedFiles = (this.status.downloadedFiles || 0) + 1;
          }

          // Small delay between downloads
          await this.delay(300);
        } catch (error) {
          this.logger.warn(
            `Failed to download ${audioUrl}: ${error.message}`
          );
        }
      }

      // Save metadata JSON file
      if (metadata.length > 0) {
        const metadataPath = path.join(heroDir, 'metadata.json');
        await fs.writeJson(metadataPath, metadata, { spaces: 2 });
      }
    } catch (error) {
      this.logger.error(`Failed to scrape hero page ${heroPage.url}:`, error);
      throw error;
    }
  }

  /**
   * Download an audio file
   */
  private async downloadAudioFile(
    url: string,
    heroDir: string,
    heroName: string,
    index: number
  ): Promise<string | null> {
    try {
      // Extract file extension from URL
      const urlPath = new URL(url).pathname;
      const extension = path.extname(urlPath) || '.ogg'; // Default to .ogg for Dota 2
      const fileName = `${this.sanitizeFileName(heroName)}_${index}${extension}`;
      const filePath = path.join(heroDir, fileName);

      // Skip if file already exists
      if (await fs.pathExists(filePath)) {
        this.logger.debug(`File already exists, skipping: ${fileName}`);
        return fileName;
      }

      // Download the file
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 30000,
      });

      await fs.writeFile(filePath, response.data);
      this.logger.debug(`Downloaded: ${fileName}`);

      return fileName;
    } catch (error) {
      this.logger.error(`Failed to download ${url}:`, error.message);
      return null;
    }
  }

  /**
   * Sanitize file name
   */
  private sanitizeFileName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .toLowerCase();
  }

  /**
   * List all scraped voice lines
   */
  async listVoiceLines(): Promise<{
    heroes: string[];
    totalFiles: number;
    voiceLines: Record<string, VoiceLineMetadata[]>;
  }> {
    try {
      const heroes: string[] = [];
      const voiceLines: Record<string, VoiceLineMetadata[]> = {};
      let totalFiles = 0;

      const voiceLinesDir = this.getVoiceLinesDir();
      if (!(await fs.pathExists(voiceLinesDir))) {
        return { heroes: [], totalFiles: 0, voiceLines: {} };
      }

      const heroDirs = await fs.readdir(voiceLinesDir);

      for (const heroDir of heroDirs) {
        const heroPath = path.join(voiceLinesDir, heroDir);
        const stats = await fs.stat(heroPath);

        if (stats.isDirectory()) {
          const metadataPath = path.join(heroPath, 'metadata.json');

          if (await fs.pathExists(metadataPath)) {
            try {
              const metadata: VoiceLineMetadata[] = await fs.readJson(metadataPath);
              heroes.push(heroDir);
              voiceLines[heroDir] = metadata;
              totalFiles += metadata.length;
            } catch (error) {
              this.logger.warn(`Failed to read metadata for ${heroDir}:`, error);
            }
          } else {
            // Count files if no metadata
            const files = await fs.readdir(heroPath);
            const audioFiles = files.filter(
              (f) => f.endsWith('.ogg') || f.endsWith('.mp3')
            );
            heroes.push(heroDir);
            voiceLines[heroDir] = [];
            totalFiles += audioFiles.length;
          }
        }
      }

      return { heroes, totalFiles, voiceLines };
    } catch (error) {
      this.logger.error('Failed to list voice lines:', error);
      throw error;
    }
  }

  /**
   * Get voice lines for a specific hero
   */
  async getVoiceLinesByHero(heroName: string): Promise<VoiceLineMetadata[]> {
    const sanitizedHeroName = this.sanitizeFileName(heroName);
    const voiceLinesDir = this.getVoiceLinesDir();
    const heroDir = path.join(voiceLinesDir, sanitizedHeroName);
    const metadataPath = path.join(heroDir, 'metadata.json');

    if (await fs.pathExists(metadataPath)) {
      try {
        return await fs.readJson(metadataPath);
      } catch (error) {
        this.logger.error(`Failed to read metadata for ${heroName}:`, error);
        return [];
      }
    }

    return [];
  }

  /**
   * Get a random voice line
   */
  async getRandomVoiceLine(
    heroName?: string
  ): Promise<VoiceLineMetadata | null> {
    try {
      const list = await this.listVoiceLines();
      let availableLines: VoiceLineMetadata[] = [];

      if (heroName) {
        availableLines = list.voiceLines[this.sanitizeFileName(heroName)] || [];
      } else {
        // Get all voice lines
        for (const hero in list.voiceLines) {
          availableLines.push(...list.voiceLines[hero]);
        }
      }

      if (availableLines.length === 0) {
        return null;
      }

      const randomIndex = Math.floor(Math.random() * availableLines.length);
      return availableLines[randomIndex];
    } catch (error) {
      this.logger.error('Failed to get random voice line:', error);
      return null;
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

