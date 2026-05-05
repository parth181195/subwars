import { Table, Column, Model, DataType, CreatedAt, UpdatedAt, HasMany } from 'sequelize-typescript';
import { Quiz, QuizInsert, QuizStatus } from '../types/database.types';
import { QuestionModel } from './question.model';

@Table({
  tableName: 'quizzes',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
})
export class QuizModel extends Model<Quiz, QuizInsert> {
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

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
  name!: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  description?: string;

  @Column({
    type: DataType.DATE,
    field: 'scheduled_at',
    allowNull: true,
  })
  scheduled_at?: Date;

  @Column({
    type: DataType.ENUM(...Object.values(QuizStatus)),
    allowNull: false,
    defaultValue: QuizStatus.DRAFT,
  })
  status!: QuizStatus;

  @Column({
    type: DataType.STRING(255),
    field: 'created_by',
    allowNull: true,
  })
  created_by?: string;

  @Column({
    type: DataType.ARRAY(DataType.TEXT),
    field: 'allowed_emails',
    allowNull: true,
  })
  allowed_emails?: string[];

  @Column({
    type: DataType.BOOLEAN,
    field: 'auto_mode_enabled',
    defaultValue: false,
  })
  auto_mode_enabled?: boolean;

  @Column({
    type: DataType.BOOLEAN,
    field: 'auto_mode_paused',
    defaultValue: false,
  })
  auto_mode_paused?: boolean;

  @Column({
    type: DataType.INTEGER,
    field: 'auto_mode_interval_seconds',
    allowNull: true,
  })
  auto_mode_interval_seconds?: number;

  @Column({
    type: DataType.INTEGER,
    field: 'quiz_duration_minutes',
    allowNull: true,
  })
  quiz_duration_minutes?: number;

  @Column({
    type: DataType.BOOLEAN,
    field: 'excluded_from_combined_leaderboard',
    defaultValue: false,
    allowNull: false,
  })
  excluded_from_combined_leaderboard?: boolean;

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

  @HasMany(() => QuestionModel, 'quiz_id')
  questions?: QuestionModel[];
}

