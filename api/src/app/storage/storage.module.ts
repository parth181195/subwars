import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { FirebaseStorageModule } from '../config/firebase-storage.module';
import { BunnyStorageModule } from '../config/bunny-storage.module';

@Module({
  imports: [FirebaseStorageModule, BunnyStorageModule],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}

