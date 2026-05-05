import { Table, Column, Model, DataType, CreatedAt, UpdatedAt } from 'sequelize-typescript';

@Table({
  tableName: 'heroes',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
})
export class HeroModel extends Model {
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
    unique: true,
  })
  name!: string;

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

