import { Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { QuizService } from './quiz.service';
import { QuizGateway } from './quiz.gateway';
import { QuizController } from './quiz.controller';
import { ServicesModule } from '../services/services.module';
import { AnswerModule } from '../answer/answer.module';
import { BunnyStorageModule } from '../config/bunny-storage.module';
import { VoiceLineModule } from '../voice-line/voice-line.module';
import { UserModule } from '../user/user.module';
import { FirebaseAuthGuard } from './guards/firebase-auth.guard';
import { FirebaseAdminModule } from '../config/firebase-admin.module';
import { QuizAutoModeService } from './quiz-auto-mode.service';
import { QuizModel } from '../models/quiz.model';
import { QuestionModel } from '../models/question.model';
import { LeaderboardConfigModel } from '../models/leaderboard-config.model';
import { HeroModel } from '../models/hero.model';

@Module({
  imports: [
    ServicesModule, // Provides PostgresService
    VoiceLineModule, // Provides VoiceLineService
    UserModule, // Provides UserService
    forwardRef(() => AnswerModule),
    BunnyStorageModule,
    FirebaseAdminModule, // Provides FIREBASE_AUTH
    SequelizeModule.forFeature([QuizModel, QuestionModel, LeaderboardConfigModel, HeroModel]),
  ],
  controllers: [QuizController],
  providers: [QuizService, QuizGateway, FirebaseAuthGuard, QuizAutoModeService],
  exports: [QuizService, QuizGateway, QuizAutoModeService],
})
export class QuizModule {}

