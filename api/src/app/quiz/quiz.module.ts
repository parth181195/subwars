import { Module, forwardRef } from '@nestjs/common';
import { QuizService } from './quiz.service';
import { QuizGateway } from './quiz.gateway';
import { SupabaseModule } from '../config/supabase.module';
import { AnswerModule } from '../answer/answer.module';

@Module({
  imports: [SupabaseModule, forwardRef(() => AnswerModule)],
  providers: [QuizService, QuizGateway],
  exports: [QuizService, QuizGateway],
})
export class QuizModule {}

