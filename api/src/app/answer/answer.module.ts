import { Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AnswerService } from './answer.service';
import { ServicesModule } from '../services/services.module';
import { QuizModule } from '../quiz/quiz.module';
import { UserModule } from '../user/user.module';
import { AnswerModel } from '../models/answer.model';
import { QuestionModel } from '../models/question.model';
import { QuizModel } from '../models/quiz.model';

@Module({
  imports: [
    ServicesModule, // Provides PostgresService
    UserModule, // Provides UserService
    forwardRef(() => QuizModule),
    SequelizeModule.forFeature([AnswerModel, QuestionModel, QuizModel]),
  ],
  providers: [AnswerService],
  exports: [AnswerService],
})
export class AnswerModule {}

