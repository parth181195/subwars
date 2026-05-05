import { Table, Column, Model, DataType, CreatedAt, UpdatedAt } from 'sequelize-typescript';

@Table({
  tableName: 'app_config',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
})
export class AppConfigModel extends Model {
  @Column({
    type: DataType.STRING(255),
    primaryKey: true,
    defaultValue: 'main',
  })
  id!: string;

  @Column({
    type: DataType.TEXT,
    field: 'stream_url',
    allowNull: true,
  })
  stream_url?: string;

  @Column({
    type: DataType.STRING(255),
    field: 'prize_pool',
    allowNull: true,
  })
  prize_pool?: string;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
    defaultValue: [],
  })
  sponsors?: Array<{ name: string; order: number }>;

  @Column({
    type: DataType.BOOLEAN,
    field: 'show_stream',
    allowNull: true,
    defaultValue: false,
  })
  show_stream?: boolean;

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
}

