import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AdminService } from './admin.service';
import { AdminQuizController } from './admin-quiz.controller';
import { AdminQuestionController } from './admin-question.controller';
import { AdminLeaderboardController } from './admin-leaderboard.controller';
import { AdminAnswerController } from './admin-answer.controller';
import { AdminUserController } from './admin-user.controller';
import { AdminSettingsController } from './admin-settings.controller';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { ServicesModule } from '../services/services.module';
import { FirebaseAdminModule } from '../config/firebase-admin.module';
import { QuizModule } from '../quiz/quiz.module';
import { AnswerModule } from '../answer/answer.module';
import { UserModule } from '../user/user.module';
import { StorageModule } from '../storage/storage.module';
import { BunnyStorageModule } from '../config/bunny-storage.module';
import { UserModel } from '../models/user.model';
import { AdminUserModel } from '../models/admin-user.model';

@Module({
  imports: [
    ServicesModule, // Provides FirestoreService
    FirebaseAdminModule, // Provides FIREBASE_AUTH
    QuizModule, // Provides QuizGateway
    AnswerModule, // Provides AnswerService
    UserModule, // Provides UserService
    StorageModule,
    BunnyStorageModule,
    SequelizeModule.forFeature([UserModel, AdminUserModel]),
  ],
  controllers: [
    AdminQuizController,
    AdminQuestionController,
    AdminLeaderboardController,
    AdminAnswerController,
    AdminUserController,
    AdminSettingsController
  ],
  providers: [AdminService, AdminAuthGuard],
  exports: [AdminService],
})
export class AdminModule {}

