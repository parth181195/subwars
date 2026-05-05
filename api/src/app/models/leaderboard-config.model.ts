import { Table, Column, Model, DataType, CreatedAt, UpdatedAt } from 'sequelize-typescript';

@Table({
  tableName: 'leaderboard_config',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
})
export class LeaderboardConfigModel extends Model {
  @Column({
    type: DataType.STRING(255),
    primaryKey: true,
    defaultValue: 'hidden_emails',
  })
  id!: string;

  @Column({
    type: DataType.ARRAY(DataType.TEXT),
    allowNull: true,
    defaultValue: [],
  })
  emails?: string[];

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

