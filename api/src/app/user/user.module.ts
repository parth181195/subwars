import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { ServicesModule } from '../services/services.module';
import { FirebaseAdminModule } from '../config/firebase-admin.module';

@Module({
  imports: [
    ServicesModule, // Provides FirestoreService
    FirebaseAdminModule, // Provides FIREBASE_AUTH (Firebase Admin Auth)
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}

