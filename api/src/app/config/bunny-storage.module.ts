import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import bunnyStorageConfig from './bunny-storage.config';
import { BunnyStorageService } from '../storage/bunny-storage.service';

@Global()
@Module({
  imports: [ConfigModule.forFeature(bunnyStorageConfig)],
  providers: [BunnyStorageService],
  exports: [BunnyStorageService],
})
export class BunnyStorageModule {}

