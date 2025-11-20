import { Module } from '@nestjs/common';
import { AnswerService } from './answer.service';
import { SupabaseModule } from '../config/supabase.module';

@Module({
  imports: [SupabaseModule],
  providers: [AnswerService],
  exports: [AnswerService],
})
export class AnswerModule {}

