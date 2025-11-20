import { Module } from '@nestjs/common';
import { RegistrationController } from './registration.controller';
import { RegistrationService } from './registration.service';
import { StorageModule } from '../storage/storage.module';
import { ServicesModule } from '../services/services.module';
import { SupabaseModule } from '../config/supabase.module';

@Module({
  imports: [SupabaseModule, StorageModule, ServicesModule],
  controllers: [RegistrationController],
  providers: [RegistrationService],
  exports: [RegistrationService],
})
export class RegistrationModule {}

