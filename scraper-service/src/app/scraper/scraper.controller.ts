import { Controller, Get, Post, Param, Logger } from '@nestjs/common';
import { ScraperService } from './scraper.service';

@Controller('scraper')
export class ScraperController {
  private readonly logger = new Logger(ScraperController.name);

  constructor(private readonly scraperService: ScraperService) {}

  @Post('scrape')
  async startScraping() {
    this.logger.log('Scrape endpoint called');
    return this.scraperService.startScraping();
  }

  @Get('status')
  getStatus() {
    return this.scraperService.getStatus();
  }

  @Get('voice-lines')
  async listVoiceLines() {
    return this.scraperService.listVoiceLines();
  }

  @Get('voice-lines/:hero')
  async getVoiceLinesByHero(@Param('hero') hero: string) {
    return this.scraperService.getVoiceLinesByHero(hero);
  }

  @Get('random')
  async getRandomVoiceLine() {
    const voiceLine = await this.scraperService.getRandomVoiceLine();
    if (!voiceLine) {
      return { message: 'No voice lines found. Please run the scraper first.' };
    }
    return voiceLine;
  }
}

