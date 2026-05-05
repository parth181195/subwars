import { Module } from '@nestjs/common';
import { AppConfigController } from './app-config.controller';
import { ServicesModule } from '../services/services.module';

@Module({
  imports: [ServicesModule], // Provides FirestoreService
  controllers: [AppConfigController],
})
export class AppConfigModule {}

