import { Table, Column, Model, DataType, CreatedAt, UpdatedAt } from 'sequelize-typescript';
import { AdminUser, AdminUserInsert, AdminRole } from '../types/database.types';

@Table({
  tableName: 'admin_users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
})
export class AdminUserModel extends Model<AdminUser, AdminUserInsert> {
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
  email!: string;

  @Column({
    type: DataType.STRING(255),
    field: 'password_hash',
    allowNull: true,
  })
  password_hash!: string;

  @Column({
    type: DataType.ENUM(...Object.values(AdminRole)),
    allowNull: false,
    defaultValue: AdminRole.ADMIN,
  })
  role!: AdminRole;

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

