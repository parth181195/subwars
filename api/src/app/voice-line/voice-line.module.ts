import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { VoiceLineService } from './voice-line.service';
import { VoiceLineController } from './voice-line.controller';
import { VoiceLineModel } from '../models/voice-line.model';
import { HeroModel } from '../models/hero.model';

@Module({
  imports: [
    ConfigModule,
    SequelizeModule.forFeature([VoiceLineModel, HeroModel]),
  ],
  controllers: [VoiceLineController],
  providers: [VoiceLineService],
  exports: [VoiceLineService],
})
export class VoiceLineModule {}

