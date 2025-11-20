import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { SupabaseModule } from '../config/supabase.module';

@Module({
  imports: [SupabaseModule],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}

