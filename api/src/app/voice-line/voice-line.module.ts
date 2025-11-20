import { Module } from '@nestjs/common';
import { VoiceLineService } from './voice-line.service';
import { SupabaseModule } from '../config/supabase.module';

@Module({
  imports: [SupabaseModule],
  providers: [VoiceLineService],
  exports: [VoiceLineService],
})
export class VoiceLineModule {}

