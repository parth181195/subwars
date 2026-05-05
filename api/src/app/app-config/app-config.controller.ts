import { Controller, Get } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AppConfigModel } from '../models/app-config.model';

interface Sponsor {
  name: string;
  order: number;
}

/**
 * Public app configuration controller
 * Provides public endpoints for app-wide configuration (not quiz-specific)
 */
@Controller('app-config')
export class AppConfigController {
  constructor(
    @InjectModel(AppConfigModel)
    private readonly appConfigModel: typeof AppConfigModel,
  ) {}

  /**
   * Get prize pool (public endpoint)
   * Returns the current prize pool for SUB WARS tournament
   */
  @Get('prize-pool')
  async getPrizePool() {
    try {
      const config = await this.appConfigModel.findByPk('main');
      if (config && config.prize_pool) {
        return {
          prizePool: config.prize_pool,
        };
      }
      // Return default if config doesn't exist or prizePool is empty
      return {
        prizePool: '₹4,00,000+',
      };
    } catch (error) {
      // Log error for debugging
      console.error('[AppConfig] Error fetching prize pool:', error);
      // Return default if config doesn't exist
      return {
        prizePool: '₹4,00,000+',
      };
    }
  }

  /**
   * Get sponsors (public endpoint)
   * Returns all sponsors sorted by order
   */
  @Get('sponsors')
  async getSponsors() {
    try {
      const config = await this.appConfigModel.findByPk('main');
      if (config && config.sponsors && Array.isArray(config.sponsors) && config.sponsors.length > 0) {
        // Sort by order and return
        const sorted = [...config.sponsors].sort((a, b) => a.order - b.order);
        return {
          sponsors: sorted,
        };
      }
      return {
        sponsors: [],
      };
    } catch (error) {
      console.error('[AppConfig] Error fetching sponsors:', error);
      return {
        sponsors: [],
      };
    }
  }

  /**
   * Get stream configuration (public endpoint)
   * Returns stream URL and whether to show the stream
   */
  @Get('stream')
  async getStream() {
    try {
      const config = await this.appConfigModel.findByPk('main');
      if (config) {
        return {
          streamUrl: config.stream_url || '',
          showStream: config.show_stream ?? false,
        };
      }
      return {
        streamUrl: '',
        showStream: false,
      };
    } catch (error) {
      console.error('[AppConfig] Error fetching stream config:', error);
      return {
        streamUrl: '',
        showStream: false,
      };
    }
  }
}
