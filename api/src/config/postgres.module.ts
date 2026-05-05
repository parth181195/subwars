import { Module, Global, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule, SequelizeModuleOptions } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import postgresConfig from './postgres.config';
import { UserModel } from '../app/models/user.model';
import { QuizModel } from '../app/models/quiz.model';
import { QuestionModel } from '../app/models/question.model';
import { AnswerModel } from '../app/models/answer.model';
import { VoiceLineModel } from '../app/models/voice-line.model';
import { LeaderboardConfigModel } from '../app/models/leaderboard-config.model';
import { AppConfigModel } from '../app/models/app-config.model';
import { HeroModel } from '../app/models/hero.model';
import { AdminUserModel } from '../app/models/admin-user.model';

@Global()
@Module({
  imports: [
    ConfigModule.forFeature(postgresConfig),
    SequelizeModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): SequelizeModuleOptions => {
        const config = configService.get('postgres');
        return {
          dialect: 'postgres',
          host: config.host,
          port: config.port,
          username: config.username,
          password: config.password,
          database: config.database,
          ssl: config.ssl,
          pool: config.pool,
          logging: config.logging,
          timezone: '+00:00', // Use UTC timezone to avoid conversion issues
          models: [UserModel, QuizModel, QuestionModel, AnswerModel, VoiceLineModel, LeaderboardConfigModel, AppConfigModel, HeroModel, AdminUserModel],
          autoLoadModels: true, // We explicitly define models
          synchronize: true, // We'll sync manually in onModuleInit
          define: {
            timestamps: true,
            underscored: false,
          },
        };
      },
      inject: [ConfigService],
    }),
    SequelizeModule.forFeature([UserModel, QuizModel, QuestionModel, AnswerModel, VoiceLineModel, LeaderboardConfigModel, AppConfigModel, AdminUserModel]),
  ],
  exports: [SequelizeModule],
})
export class PostgresModule implements OnModuleInit {
  constructor(private sequelize: Sequelize) {}

  async onModuleInit() {
    try {
      // First, manually add the is_banned column if it doesn't exist
      // This avoids issues with Sequelize's alter trying to change enum types
      try {
        await this.sequelize.query(`
          ALTER TABLE users 
          ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;
        `);
        console.log('✅ Added is_banned column to users table');
      } catch (error: any) {
        // Column might already exist, ignore error
        if (!error.message?.includes('already exists') && !error.message?.includes('duplicate')) {
          console.warn('⚠️ Could not add is_banned column (might already exist):', error.message);
        }
      }

      // Add updated_at column to admin_users table if it doesn't exist
      try {
        await this.sequelize.query(`
          ALTER TABLE admin_users 
          ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        `);
        console.log('✅ Added updated_at column to admin_users table');
      } catch (error: any) {
        // Column might already exist, ignore error
        if (!error.message?.includes('already exists') && !error.message?.includes('duplicate')) {
          console.warn('⚠️ Could not add updated_at column to admin_users (might already exist):', error.message);
        }
      }

      // Add show_stream column to app_config table if it doesn't exist
      try {
        await this.sequelize.query(`
          ALTER TABLE app_config 
          ADD COLUMN IF NOT EXISTS show_stream BOOLEAN DEFAULT FALSE;
        `);
        console.log('✅ Added show_stream column to app_config table');
      } catch (error: any) {
        // Column might already exist, ignore error
        if (!error.message?.includes('already exists') && !error.message?.includes('duplicate')) {
          console.warn('⚠️ Could not add show_stream column to app_config (might already exist):', error.message);
        }
      }

      // Add deleted_at columns to all tables for soft deletes
      const tables = ['users', 'quizzes', 'questions', 'answers', 'admin_users', 'voice_lines', 'heroes', 'app_config', 'leaderboard_config'];
      for (const table of tables) {
        try {
          await this.sequelize.query(`
            ALTER TABLE ${table} 
            ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
          `);
          console.log(`✅ Added deleted_at column to ${table} table`);
        } catch (error: any) {
          if (!error.message?.includes('already exists') && !error.message?.includes('duplicate')) {
            console.warn(`⚠️ Could not add deleted_at column to ${table} (might already exist):`, error.message);
          }
        }
      }

      // Add created_at to app_config and leaderboard_config if missing
      try {
        await this.sequelize.query(`
          ALTER TABLE app_config 
          ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        `);
        console.log('✅ Added created_at column to app_config table');
      } catch (error: any) {
        if (!error.message?.includes('already exists') && !error.message?.includes('duplicate')) {
          console.warn('⚠️ Could not add created_at column to app_config (might already exist):', error.message);
        }
      }

      try {
        await this.sequelize.query(`
          ALTER TABLE leaderboard_config 
          ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        `);
        console.log('✅ Added created_at column to leaderboard_config table');
      } catch (error: any) {
        if (!error.message?.includes('already exists') && !error.message?.includes('duplicate')) {
          console.warn('⚠️ Could not add created_at column to leaderboard_config (might already exist):', error.message);
        }
      }

      // Add excluded_from_combined column to answers table if it doesn't exist
      try {
        await this.sequelize.query(`
          ALTER TABLE answers 
          ADD COLUMN IF NOT EXISTS excluded_from_combined BOOLEAN DEFAULT FALSE;
        `);
        console.log('✅ Added excluded_from_combined column to answers table');
      } catch (error: any) {
        if (!error.message?.includes('already exists') && !error.message?.includes('duplicate')) {
          console.warn('⚠️ Could not add excluded_from_combined column to answers (might already exist):', error.message);
        }
      }

      // Add excluded_from_combined_leaderboard column to quizzes table if it doesn't exist
      try {
        await this.sequelize.query(`
          ALTER TABLE quizzes 
          ADD COLUMN IF NOT EXISTS excluded_from_combined_leaderboard BOOLEAN DEFAULT FALSE;
        `);
        console.log('✅ Added excluded_from_combined_leaderboard column to quizzes table');
      } catch (error: any) {
        if (!error.message?.includes('already exists') && !error.message?.includes('duplicate')) {
          console.warn('⚠️ Could not add excluded_from_combined_leaderboard column to quizzes (might already exist):', error.message);
        }
      }

      // Add updated_at to heroes and answers if missing
      try {
        await this.sequelize.query(`
          ALTER TABLE heroes 
          ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        `);
        console.log('✅ Added updated_at column to heroes table');
      } catch (error: any) {
        if (!error.message?.includes('already exists') && !error.message?.includes('duplicate')) {
          console.warn('⚠️ Could not add updated_at column to heroes (might already exist):', error.message);
        }
      }

      try {
        await this.sequelize.query(`
          ALTER TABLE answers 
          ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;
        `);
        console.log('✅ Added updated_at column to answers table');
      } catch (error: any) {
        if (!error.message?.includes('already exists') && !error.message?.includes('duplicate')) {
          console.warn('⚠️ Could not add updated_at column to answers (might already exist):', error.message);
        }
      }

      // Sync all models (create tables if they don't exist)
      // alter: false to avoid enum conversion issues
      // force: false means it won't drop existing tables
      await this.sequelize.sync({ alter: false, force: false });
      console.log('✅ Database tables synchronized successfully');
      
      // Verify admin_users table exists
      try {
        const [results] = await this.sequelize.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'admin_users'
          );
        `);
        const tableExists = (results as any[])[0]?.exists;
        if (tableExists) {
          console.log('✅ admin_users table exists');
        } else {
          console.warn('⚠️ admin_users table does not exist - it should have been created by sync');
        }
      } catch (error) {
        console.warn('⚠️ Could not verify admin_users table:', error);
      }
    } catch (error) {
      console.error('❌ Error synchronizing database tables:', error);
      // Don't throw - allow app to continue even if sync fails
      // (tables might already exist)
    }
  }
}

