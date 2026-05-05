import { Table, Column, Model, DataType, CreatedAt, UpdatedAt, BelongsTo, ForeignKey } from 'sequelize-typescript';
import { QuizQuestion, QuizQuestionInsert, QuestionStatus, QuestionType } from '../types/database.types';
import { QuizModel } from './quiz.model';

@Table({
  tableName: 'questions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
})
export class QuestionModel extends Model<QuizQuestion, QuizQuestionInsert> {
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

  @Column({
    type: DataType.ENUM(...Object.values(QuestionType)),
    field: 'question_type',
    allowNull: false,
  })
  question_type!: QuestionType;

  @Column({
    type: DataType.TEXT,
    field: 'question_content',
    allowNull: false,
  })
  question_content!: string;

  @Column({
    type: DataType.JSONB,
    field: 'question_content_metadata',
    allowNull: true,
  })
  question_content_metadata?: Record<string, any>;

  @Column({
    type: DataType.STRING(255),
    field: 'correct_answer_hero',
    allowNull: false,
  })
  correct_answer_hero!: string;

  @Column({
    type: DataType.TEXT,
    field: 'answer_image_url',
    allowNull: true,
  })
  answer_image_url?: string;

  @Column({
    type: DataType.INTEGER,
    field: 'time_limit_seconds',
    defaultValue: 120,
  })
  time_limit_seconds!: number;

  @Column({
    type: DataType.INTEGER,
    field: 'order_index',
    allowNull: false,
  })
  order_index!: number;

  @Column({
    type: DataType.ENUM(...Object.values(QuestionStatus)),
    allowNull: false,
    defaultValue: QuestionStatus.PENDING,
  })
  status!: QuestionStatus;

  @Column({
    type: DataType.BOOLEAN,
    field: 'is_active',
    defaultValue: false,
  })
  is_active!: boolean;

  @Column({
    type: DataType.DATE,
    field: 'started_at',
    allowNull: true,
  })
  started_at?: Date;

  @Column({
    type: DataType.DATE,
    field: 'ended_at',
    allowNull: true,
  })
  ended_at?: Date;

  @CreatedAt
  @Column({
    type: DataType.DATE,
    field: 'created_at',
  })
  created_at!: Date;

  @UpdatedAt
  @Column({
    type: DataType.DATE,
    field: 'updated_at',
  })
  updated_at!: Date;

  @Column({
    type: DataType.DATE,
    field: 'deleted_at',
    allowNull: true,
  })
  deleted_at?: Date;

  @BelongsTo(() => QuizModel, 'quiz_id')
  quiz?: QuizModel;
}

