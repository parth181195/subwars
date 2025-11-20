import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { FirebaseStorageModule } from '../config/firebase-storage.module';

@Module({
  imports: [FirebaseStorageModule],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}

