import { Module } from '@nestjs/common';
import { VoiceLineService } from './voice-line.service';
import { VoiceLineController } from './voice-line.controller';
import { SupabaseModule } from '../config/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [VoiceLineController],
  providers: [VoiceLineService],
  exports: [VoiceLineService],
})
export class VoiceLineModule {}

