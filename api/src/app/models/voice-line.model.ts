import { Table, Column, Model, DataType, CreatedAt, UpdatedAt } from 'sequelize-typescript';
import { VoiceLine, VoiceLineInsert } from '../types/database.types';

@Table({
  tableName: 'voice_lines',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
})
export class VoiceLineModel extends Model<VoiceLine, VoiceLineInsert> {
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
    field: 'hero_name',
    allowNull: false,
  })
  hero_name?: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
  name!: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  url!: string;

  @Column({
    type: DataType.TEXT,
    field: 'bunny_cdn_link',
    allowNull: true,
  })
  bunny_cdn_link?: string;

  @Column({
    type: DataType.TEXT,
    field: 'bunny_cdn_path',
    allowNull: true,
  })
  bunny_cdn_path?: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
  })
  category?: string;

  @Column({
    type: DataType.TEXT,
    field: 'line_text',
    allowNull: true,
  })
  line_text?: string;

  @Column({
    type: DataType.DATE,
    field: 'scraped_at',
    allowNull: true,
  })
  scraped_at?: Date;

  @CreatedAt
  @Column({
    type: DataType.DATE,
    field: 'created_at',
  })
  created_at?: Date;

  @UpdatedAt
  @Column({
    type: DataType.DATE,
    field: 'updated_at',
  })
  updated_at?: Date;

  @Column({
    type: DataType.DATE,
    field: 'deleted_at',
    allowNull: true,
  })
  deleted_at?: Date;
}

