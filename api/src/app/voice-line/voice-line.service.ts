import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { VoiceLine, VoiceLineInsert, VoiceLineUpdate } from '../types/database.types';
import { VoiceLineModel } from '../models/voice-line.model';
import { HeroModel } from '../models/hero.model';

@Injectable()
export class VoiceLineService {
  constructor(
    @InjectModel(VoiceLineModel)
    private readonly voiceLineModel: typeof VoiceLineModel,
    @InjectModel(HeroModel)
    private readonly heroModel: typeof HeroModel,
  ) {}

  async createVoiceLine(voiceLineInsert: VoiceLineInsert, heroName: string): Promise<VoiceLine> {
    try {
      // Create in voice_lines table with hero_name using Sequelize model
      const voiceLine = await this.voiceLineModel.create({
        ...voiceLineInsert,
        hero_name: heroName,
        scraped_at: new Date(),
      } as any);
      return voiceLine.get({ plain: true }) as VoiceLine;
    } catch (error) {
      throw new BadRequestException(`Failed to create voice line: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getVoiceLineById(id: string): Promise<VoiceLine> {
    const voiceLine = await this.voiceLineModel.findByPk(id);

    if (!voiceLine) {
      throw new NotFoundException(`Voice line with ID ${id} not found`);
    }

    return voiceLine.get({ plain: true }) as VoiceLine;
  }

  async getAllVoiceLines(): Promise<VoiceLine[]> {
    try {
      const voiceLines = await this.voiceLineModel.findAll({
        order: [['scraped_at', 'DESC']],
      });
      return voiceLines.map(vl => vl.get({ plain: true })) as VoiceLine[];
    } catch (error) {
      throw new BadRequestException(`Failed to get voice lines: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getVoiceLinesByHero(heroName: string): Promise<VoiceLine[]> {
    try {
      // Query voice lines with hero_name filter using Sequelize
      let voiceLines = await this.voiceLineModel.findAll({
        where: {
          hero_name: heroName,
        },
        order: [['scraped_at', 'DESC']],
      });
      
      // If no results, try case-insensitive hero name lookup
      if (!voiceLines || voiceLines.length === 0) {
        // Get all heroes and find case-insensitive match
        const heroes = await this.heroModel.findAll({
          attributes: ['name'],
        });
        const matchingHero = heroes.find(h => {
          const name = h.get('name') as string;
          return name && name.toLowerCase() === heroName.toLowerCase();
        });
        
        if (matchingHero) {
          const matchingHeroName = matchingHero.get('name') as string;
          voiceLines = await this.voiceLineModel.findAll({
            where: {
              hero_name: matchingHeroName,
            },
            order: [['scraped_at', 'DESC']],
          });
        }
      }
      
      return voiceLines.map(vl => vl.get({ plain: true })) as VoiceLine[];
    } catch (error) {
      throw new BadRequestException(`Failed to get voice lines: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getRandomVoiceLine(heroName?: string): Promise<VoiceLine> {
    try {
      const where = heroName ? { hero_name: heroName } : {};
      const voiceLines = await this.voiceLineModel.findAll({ where });

      if (!voiceLines || voiceLines.length === 0) {
        throw new NotFoundException('No voice lines found');
      }

      // Get random voice line
      const randomIndex = Math.floor(Math.random() * voiceLines.length);
      return voiceLines[randomIndex].get({ plain: true }) as VoiceLine;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to get voice lines: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateVoiceLine(id: string, voiceLineUpdate: VoiceLineUpdate): Promise<VoiceLine> {
    try {
      const voiceLine = await this.voiceLineModel.findByPk(id);
      if (!voiceLine) {
        throw new NotFoundException(`Voice line with ID ${id} not found`);
      }
      await voiceLine.update(voiceLineUpdate as any);
      return voiceLine.get({ plain: true }) as VoiceLine;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to update voice line: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteVoiceLine(id: string): Promise<void> {
    try {
      const voiceLine = await this.voiceLineModel.findByPk(id);
      if (!voiceLine) {
        throw new NotFoundException(`Voice line with ID ${id} not found`);
      }
      await voiceLine.destroy();
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to delete voice line: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

