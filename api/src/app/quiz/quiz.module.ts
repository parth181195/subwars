import { Module, forwardRef } from '@nestjs/common';
import { QuizService } from './quiz.service';
import { QuizGateway } from './quiz.gateway';
import { QuizController } from './quiz.controller';
import { SupabaseModule } from '../config/supabase.module';
import { AnswerModule } from '../answer/answer.module';
import { BunnyStorageModule } from '../config/bunny-storage.module';

@Module({
  imports: [SupabaseModule, forwardRef(() => AnswerModule), BunnyStorageModule],
  controllers: [QuizController],
  providers: [QuizService, QuizGateway],
  exports: [QuizService, QuizGateway],
})
export class QuizModule {}

