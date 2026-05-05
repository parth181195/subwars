import { Controller, Get, Param, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { VoiceLineService } from './voice-line.service';
import { HeroModel } from '../models/hero.model';
import { VoiceLineModel } from '../models/voice-line.model';

interface HeroInfo {
  hero: string;
  url: string;
}

interface VoiceLine {
  name: string;
  link: string;
  bunnyCdnLink?: string;
  bunnyCdnPath?: string;
  category?: string;
}

interface VoiceLinesData {
  heroes: Array<{
    hero: string;
    url: string;
    voiceLines: Array<VoiceLine>;
  }>;
}

@Controller('voice-lines')
export class VoiceLineController {
  private readonly logger = new Logger(VoiceLineController.name);
  private heroesCache: { data: HeroInfo[]; timestamp: number } | null = null;
  private readonly CACHE_TTL = 3600000; // 1 hour in milliseconds

  constructor(
    private voiceLineService: VoiceLineService,
    @InjectModel(HeroModel)
    private readonly heroModel: typeof HeroModel,
    @InjectModel(VoiceLineModel)
    private readonly voiceLineModel: typeof VoiceLineModel,
  ) {}

  /**
   * Get list of all heroes (just names and URLs)
   * FAST endpoint - returns only hero metadata, not voice lines (~124 heroes)
   * Use this for hero dropdown/selection
   */
  @Get('heroes')
  async getHeroes(): Promise<{ heroes: HeroInfo[] }> {
    try {
      // Check cache first (but log cache status)
      if (this.heroesCache && (Date.now() - this.heroesCache.timestamp) < this.CACHE_TTL) {
        this.logger.log(`Loaded ${this.heroesCache.data.length} heroes from cache`);
        return { heroes: this.heroesCache.data };
      }
      
      // Cache expired or doesn't exist - clear it
      if (this.heroesCache) {
        this.logger.log('Cache expired, fetching fresh data');
        this.heroesCache = null;
      }

      // Query unique hero names from voice_lines table using Sequelize
      const voiceLines = await this.voiceLineModel.findAll({
        attributes: ['hero_name'],
        group: ['hero_name'],
      });
      const heroSet = new Set<string>();
      voiceLines.forEach((vl) => {
        const heroName = vl.get('hero_name') as string;
        if (heroName) {
          heroSet.add(heroName);
        }
      });

      if (heroSet.size === 0) {
        throw new NotFoundException('No heroes found in database');
      }

      this.logger.log(`Found ${heroSet.size} unique heroes from Firestore`);

      // Fetch hero URLs from heroes table using Sequelize
      const heroesData: HeroInfo[] = [];
      for (const heroName of heroSet) {
        try {
          const heroDoc = await this.heroModel.findOne({
            where: { name: heroName },
          });
          heroesData.push({
            hero: heroName,
            url: (heroDoc?.get('url') as string) || '',
          });
        } catch (error) {
          // If hero doc doesn't exist, add with empty URL
          heroesData.push({
            hero: heroName,
            url: '',
          });
        }
      }
      
      const heroes = heroesData.sort((a, b) => a.hero.localeCompare(b.hero));

      this.logger.log(`Found ${heroes.length} unique heroes after deduplication`);

      // Clear cache and update with new data
      this.heroesCache = {
        data: heroes,
        timestamp: Date.now(),
      };

      this.logger.log(`Successfully loaded ${heroes.length} heroes from Firestore`);
      return { heroes };
    } catch (error) {
      this.logger.error('Failed to load heroes:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      return { heroes: [] };
    }
  }

  /**
   * Get voice lines for a specific hero
   * FAST endpoint - queries only one hero's voice lines using indexed hero_name
   * Returns only voice lines for the requested hero (~100-500 per hero)
   */
  @Get('hero/:heroName')
  async getVoiceLinesForHero(@Param('heroName') heroName: string): Promise<{
    hero: string;
    url: string;
    voiceLines: VoiceLine[];
  }> {
    try {
      // Decode hero name (in case it's URL encoded)
      const decodedHeroName = decodeURIComponent(heroName);

      // Fetch voice lines for this specific hero from Firestore
      const voiceLineDocs = await this.voiceLineService.getVoiceLinesByHero(decodedHeroName);

      if (!voiceLineDocs || voiceLineDocs.length === 0) {
        this.logger.warn(`No voice lines found for hero "${decodedHeroName}" - this might be a case mismatch or missing data`);
        // Return empty array instead of throwing error to allow UI to handle gracefully
        return {
          hero: decodedHeroName,
          url: '',
          voiceLines: [],
        };
      }

      // Transform to expected format (new structure has name and url directly)
      const voiceLines: VoiceLine[] = voiceLineDocs.map((vl) => {
        return {
          name: vl.name || 'Voice Line',
          link: vl.url || '',
          bunnyCdnLink: vl.bunny_cdn_link || '',
          bunnyCdnPath: vl.bunny_cdn_path || '',
          category: vl.category || '',
        };
      });

      this.logger.log(`Successfully loaded ${voiceLines.length} voice lines for hero "${decodedHeroName}"`);
      
      // Fetch hero document to get hero URL using Sequelize
      let heroUrl = '';
      try {
        const heroDoc = await this.heroModel.findOne({
          where: { name: decodedHeroName },
        });
        heroUrl = (heroDoc?.get('url') as string) || '';
      } catch (error) {
        // Hero might not exist, use empty URL
      }
      
      return {
        hero: decodedHeroName,
        url: heroUrl,
        voiceLines,
      };
    } catch (error) {
      this.logger.error(`Failed to load voice lines for hero ${heroName}:`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException(`Failed to load voice lines for hero "${heroName}"`);
    }
  }

  /**
   * Legacy endpoint - get all voice lines for all heroes
   * WARNING: This is SLOW with 48k records! 
   * Use /voice-lines/heroes and /voice-lines/hero/:heroName instead for better performance
   */
  @Get()
  async getVoiceLines(): Promise<VoiceLinesData> {
    try {
      // Fetch all heroes first (fast)
      const heroesResponse = await this.getHeroes();
      const heroes = heroesResponse.heroes;

      // Fetch voice lines for each hero (parallel but still slow with many heroes)
      const heroesWithVoiceLines = await Promise.all(
        heroes.map(async (heroInfo) => {
          try {
            const heroData = await this.getVoiceLinesForHero(heroInfo.hero);
            return {
              hero: heroData.hero,
              url: heroData.url,
              voiceLines: heroData.voiceLines,
            };
          } catch (error) {
            // If individual hero fetch fails, return empty
            this.logger.warn(`Failed to fetch voice lines for ${heroInfo.hero}: ${error}`);
            return {
              hero: heroInfo.hero,
              url: heroInfo.url,
              voiceLines: [],
            };
          }
        })
      );

      return {
        heroes: heroesWithVoiceLines,
      };
    } catch (error) {
      this.logger.error('Failed to load all voice lines:', error);
      return { heroes: [] };
    }
  }
}

