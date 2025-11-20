import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'SUPABASE_CLIENT',
      useFactory: (configService: ConfigService): SupabaseClient => {
        const url = configService.get<string>('supabase.url');
        const anonKey = configService.get<string>('supabase.anonKey');
        
        if (!url || !anonKey) {
          throw new Error('Supabase URL and Anon Key are required');
        }

        return createClient(url, anonKey);
      },
      inject: [ConfigService],
    },
    {
      provide: 'SUPABASE_ADMIN_CLIENT',
      useFactory: (configService: ConfigService): SupabaseClient => {
        const url = configService.get<string>('supabase.url');
        const serviceRoleKey = configService.get<string>('supabase.serviceRoleKey');
        
        if (!url || !serviceRoleKey) {
          throw new Error('Supabase URL and Service Role Key are required');
        }

        return createClient(url, serviceRoleKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: ['SUPABASE_CLIENT', 'SUPABASE_ADMIN_CLIENT'],
})
export class SupabaseModule {}

