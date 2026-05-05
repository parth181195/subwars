import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import firebaseStorageConfig from './config/firebase-storage.config';
import bunnyStorageConfig from './config/bunny-storage.config';
import firebaseAdminConfig from './config/firebase-admin.config';
import postgresConfig from '../config/postgres.config';
import { FirebaseStorageModule } from './config/firebase-storage.module';
import { FirebaseAdminModule } from './config/firebase-admin.module';
import { PostgresModule } from '../config/postgres.module';
import { BunnyStorageModule } from './config/bunny-storage.module';
import { QuizModule } from './quiz/quiz.module';
import { AnswerModule } from './answer/answer.module';
import { VoiceLineModule } from './voice-line/voice-line.module';
import { AdminModule } from './admin/admin.module';
import { UserModule } from './user/user.module';
import { AppConfigModule } from './app-config/app-config.module';
import { RequestLoggingMiddleware } from './common/middleware/request-logging.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [firebaseStorageConfig, bunnyStorageConfig, firebaseAdminConfig, postgresConfig],
    }),
    FirebaseStorageModule,
    FirebaseAdminModule, // Firebase Admin for Auth only
    PostgresModule, // PostgreSQL with Sequelize
    BunnyStorageModule,
    UserModule,
    QuizModule,
    AnswerModule,
    VoiceLineModule,
    AdminModule,
    AppConfigModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestLoggingMiddleware)
      .forRoutes('*path'); // Apply to all routes (using named parameter for path-to-regexp compatibility)
  }
}
