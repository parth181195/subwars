import { Module, forwardRef } from '@nestjs/common';
import { AnswerService } from './answer.service';
import { SupabaseModule } from '../config/supabase.module';
import { QuizModule } from '../quiz/quiz.module';

@Module({
  imports: [SupabaseModule, forwardRef(() => QuizModule)],
  providers: [AnswerService],
  exports: [AnswerService],
})
export class AnswerModule {}

