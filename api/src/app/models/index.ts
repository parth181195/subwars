import { UserModel } from './user.model';
import { QuizModel } from './quiz.model';
import { QuestionModel } from './question.model';
import { AnswerModel } from './answer.model';
import { VoiceLineModel } from './voice-line.model';

// Define associations
QuizModel.hasMany(QuestionModel, { foreignKey: 'quiz_id', as: 'questions' });
QuestionModel.belongsTo(QuizModel, { foreignKey: 'quiz_id', as: 'quiz' });

AnswerModel.belongsTo(UserModel, { foreignKey: 'user_id', as: 'user' });
AnswerModel.belongsTo(QuizModel, { foreignKey: 'quiz_id', as: 'quiz' });
AnswerModel.belongsTo(QuestionModel, { foreignKey: 'question_id', as: 'question' });

export {
  UserModel,
  QuizModel,
  QuestionModel,
  AnswerModel,
  VoiceLineModel,
};

