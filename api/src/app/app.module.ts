import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import supabaseConfig from './config/supabase.config';
import firebaseStorageConfig from './config/firebase-storage.config';
import bunnyStorageConfig from './config/bunny-storage.config';
import { SupabaseModule } from './config/supabase.module';
import { FirebaseStorageModule } from './config/firebase-storage.module';
import { BunnyStorageModule } from './config/bunny-storage.module';
import { QuizModule } from './quiz/quiz.module';
import { AnswerModule } from './answer/answer.module';
import { VoiceLineModule } from './voice-line/voice-line.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [supabaseConfig, firebaseStorageConfig, bunnyStorageConfig],
    }),
    SupabaseModule,
    FirebaseStorageModule,
    BunnyStorageModule,
    QuizModule,
    AnswerModule,
    VoiceLineModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
