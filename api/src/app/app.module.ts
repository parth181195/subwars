import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import supabaseConfig from './config/supabase.config';
import firebaseStorageConfig from './config/firebase-storage.config';
import { SupabaseModule } from './config/supabase.module';
import { FirebaseStorageModule } from './config/firebase-storage.module';
import { RegistrationModule } from './registration/registration.module';
import { QuizModule } from './quiz/quiz.module';
import { AnswerModule } from './answer/answer.module';
import { VoiceLineModule } from './voice-line/voice-line.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [supabaseConfig, firebaseStorageConfig],
    }),
    SupabaseModule,
    FirebaseStorageModule,
    RegistrationModule,
    QuizModule,
    AnswerModule,
    VoiceLineModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
