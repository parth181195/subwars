import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminQuizController } from './admin-quiz.controller';
import { SupabaseModule } from '../config/supabase.module';
import { QuizModule } from '../quiz/quiz.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [SupabaseModule, QuizModule, StorageModule],
  controllers: [AdminQuizController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}

