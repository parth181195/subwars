import { Module } from '@nestjs/common';
import { QuizService } from './quiz.service';
import { SupabaseModule } from '../config/supabase.module';

@Module({
  imports: [SupabaseModule],
  providers: [QuizService],
  exports: [QuizService],
})
export class QuizModule {}

