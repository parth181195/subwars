import { Table, Column, Model, DataType, CreatedAt, BelongsTo, ForeignKey } from 'sequelize-typescript';
import { Answer, AnswerInsert } from '../types/database.types';
import { UserModel } from './user.model';
import { QuizModel } from './quiz.model';
import { QuestionModel } from './question.model';

@Table({
  tableName: 'answers',
  timestamps: false, // We use submitted_at instead
})
export class AnswerModel extends Model<Answer, AnswerInsert> {
  @Column({
    type: DataType.UUID,
    primaryKey: true,
    defaultValue: DataType.UUIDV4,
    get() {
      const rawValue = this.getDataValue('id');
      return rawValue ? rawValue.toString() : null;
    },
  })
  id!: string;

  @ForeignKey(() => UserModel)
  @Column({
    type: DataType.STRING(255),
    field: 'user_id',
    allowNull: false,
  })
  user_id!: string;

  @ForeignKey(() => QuizModel)
  @Column({
    type: DataType.UUID,
    field: 'quiz_id',
    allowNull: false,
    get() {
      const rawValue = this.getDataValue('quiz_id');
      return rawValue ? rawValue.toString() : null;
    },
  })
  quiz_id!: string;

  @ForeignKey(() => QuestionModel)
  @Column({
    type: DataType.UUID,
    field: 'question_id',
    allowNull: false,
    get() {
      const rawValue = this.getDataValue('question_id');
      return rawValue ? rawValue.toString() : null;
    },
  })
  question_id!: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
  answer!: string;

  @Column({
    type: DataType.BOOLEAN,
    field: 'is_correct',
    allowNull: false,
    defaultValue: false,
  })
  is_correct!: boolean;

  @Column({
    type: DataType.INTEGER,
    field: 'response_time',
    allowNull: true,
    comment: 'Response time in milliseconds',
  })
  response_time?: number;

  @Column({
    type: DataType.DATE,
    field: 'question_started_at',
    allowNull: true,
  })
  question_started_at?: Date;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  score!: number;

  @Column({
    type: DataType.INTEGER,
    field: 'attempt_count',
    defaultValue: 1,
  })
  attempt_count!: number;

  @CreatedAt
  @Column({
    type: DataType.DATE,
    field: 'submitted_at',
  })
  submitted_at!: Date;

  @Column({
    type: DataType.DATE,
    field: 'updated_at',
    allowNull: true,
  })
  updated_at?: Date;

  @Column({
    type: DataType.DATE,
    field: 'deleted_at',
    allowNull: true,
  })
  deleted_at?: Date;

  @Column({
    type: DataType.BOOLEAN,
    field: 'excluded_from_combined',
    defaultValue: false,
    allowNull: false,
  })
  excluded_from_combined!: boolean;

  @BelongsTo(() => UserModel, 'user_id')
  user?: UserModel;

  @BelongsTo(() => QuizModel, 'quiz_id')
  quiz?: QuizModel;

  @BelongsTo(() => QuestionModel, 'question_id')
  question?: QuestionModel;
}

