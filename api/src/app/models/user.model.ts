import { Table, Column, Model, DataType, CreatedAt, UpdatedAt } from 'sequelize-typescript';
import { User, UserInsert, UserUpdate, RegistrationStatus } from '../types/database.types';

@Table({
  tableName: 'users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
})
export class UserModel extends Model<User, UserInsert> {
  @Column({
    type: DataType.STRING(255),
    primaryKey: true,
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
    field: 'google_id',
  })
  google_id!: string;

  @Column({
    type: DataType.STRING(255),
    field: 'full_name',
  })
  full_name!: string;

  @Column({
    type: DataType.STRING(20),
    field: 'phone_number',
    allowNull: true,
  })
  phone_number?: string;

  @Column({
    type: DataType.STRING(255),
    field: 'in_game_name',
    allowNull: true,
  })
  in_game_name?: string;

  @Column({
    type: DataType.STRING(255),
    field: 'dota2_friend_id',
    allowNull: true,
  })
  dota2_friend_id?: string;

  @Column({
    type: DataType.TEXT,
    field: 'profile_image_url',
    allowNull: true,
  })
  profile_image_url?: string;

  @Column({
    type: DataType.TEXT,
    field: 'steam_profile_link',
    allowNull: true,
  })
  steam_profile_link?: string;

  @Column({
    type: DataType.BOOLEAN,
    field: 'steam_profile_verified',
    defaultValue: false,
  })
  steam_profile_verified!: boolean;

  @Column({
    type: DataType.TEXT,
    field: 'dotabuff_profile_link',
    allowNull: true,
  })
  dotabuff_profile_link?: string;

  @Column({
    type: DataType.STRING(255),
    field: 'rank_and_mmr',
    allowNull: true,
  })
  rank_and_mmr?: string;

  @Column({
    type: DataType.STRING(255),
    field: 'discord_id',
    allowNull: true,
  })
  discord_id?: string;

  @Column({
    type: DataType.BOOLEAN,
    field: 'discord_verified',
    defaultValue: false,
  })
  discord_verified!: boolean;

  @Column({
    type: DataType.TEXT,
    field: 'proof_of_payment_url',
    allowNull: true,
  })
  proof_of_payment_url?: string;

  @Column({
    type: DataType.STRING(255),
    field: 'upi_id',
    allowNull: true,
  })
  upi_id?: string;

  @Column({
    type: DataType.STRING(50),
    field: 'registration_status',
    defaultValue: RegistrationStatus.PENDING,
  })
  registration_status!: RegistrationStatus;

  @Column({
    type: DataType.TEXT,
    field: 'admin_notes',
    allowNull: true,
  })
  admin_notes?: string;

  @Column({
    type: DataType.BOOLEAN,
    field: 'is_banned',
    defaultValue: false,
  })
  is_banned!: boolean;

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

