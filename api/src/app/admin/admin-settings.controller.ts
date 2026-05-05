import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AppConfigModel } from '../models/app-config.model';
import { AdminAuthGuard } from './guards/admin-auth.guard';

interface Sponsor {
  name: string;
  order: number;
}

interface AppConfig {
  streamUrl?: string;
  prizePool?: string;
  sponsors?: Sponsor[];
  showStream?: boolean;
  updated_at?: string;
}

@Controller('admin/settings')
export class AdminSettingsController {
  constructor(
    @InjectModel(AppConfigModel)
    private readonly appConfigModel: typeof AppConfigModel,
  ) {}

  /**
   * Get app configuration
   */
  @UseGuards(AdminAuthGuard)
  @Get('config')
  async getConfig() {
    try {
      const config = await this.appConfigModel.findByPk('main');
      if (config) {
        // Ensure sponsors is always an array
        return {
          streamUrl: config.stream_url || '',
          prizePool: config.prize_pool || '',
          sponsors: Array.isArray(config.sponsors) ? config.sponsors : [],
          showStream: config.show_stream ?? false,
        };
      }
      return { streamUrl: '', prizePool: '', sponsors: [], showStream: false };
    } catch (error) {
      // If config doesn't exist, return defaults
      return { streamUrl: '', prizePool: '', sponsors: [] };
    }
  }

  /**
   * Update app configuration
   */
  @UseGuards(AdminAuthGuard)
  @Post('config')
  async updateConfig(@Body() config: AppConfig) {
    try {
      console.log('[AdminSettings] Received config:', JSON.stringify(config, null, 2));
      console.log('[AdminSettings] Sponsors in request:', config.sponsors?.length || 0);
      
      const existing = await this.appConfigModel.findByPk('main');
      
      // Ensure sponsors is an array and validate structure
      let sponsorsArray: Sponsor[] = [];
      if (Array.isArray(config.sponsors)) {
        sponsorsArray = config.sponsors
          .filter((s: any) => s && typeof s === 'object' && s.name && typeof s.name === 'string' && typeof s.order === 'number')
          .map((s: any) => ({
            name: String(s.name).trim(),
            order: Number(s.order),
          }));
      }
      
      console.log('[AdminSettings] Processed sponsors:', sponsorsArray.length);
      
      const configData = {
        stream_url: config.streamUrl?.trim() || '',
        prize_pool: config.prizePool?.trim() || '',
        sponsors: sponsorsArray,
        show_stream: config.showStream ?? false,
      };

      if (existing) {
        await existing.update(configData);
      } else {
        await this.appConfigModel.create({
          id: 'main',
          ...configData,
        });
      }

      // Verify the save by reading it back
      const saved = await this.appConfigModel.findByPk('main');
      console.log('[AdminSettings] Saved config:', JSON.stringify(saved?.toJSON(), null, 2));
      console.log('[AdminSettings] Sponsors after save:', saved?.sponsors?.length || 0);

      return {
        success: true,
        message: 'Configuration saved successfully',
        config: saved ? {
          streamUrl: saved.stream_url || '',
          prizePool: saved.prize_pool || '',
          sponsors: Array.isArray(saved.sponsors) ? saved.sponsors : [],
          showStream: saved.show_stream ?? false,
        } : {
          streamUrl: configData.stream_url,
          prizePool: configData.prize_pool,
          sponsors: configData.sponsors,
          showStream: configData.show_stream,
        },
      };
    } catch (error) {
      console.error('[AdminSettings] Error saving config:', error);
      throw new BadRequestException(
        `Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}

