import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'FIREBASE_STORAGE',
      useFactory: (configService: ConfigService) => {
        const firebaseConfig = configService.get('firebaseStorage');
        
        if (!firebaseConfig?.projectId || !firebaseConfig?.clientEmail || !firebaseConfig?.privateKey) {
          throw new Error('Firebase Storage credentials are required (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)');
        }

        // Initialize Firebase Admin if not already initialized
        if (!admin.apps.length) {
          admin.initializeApp({
            credential: admin.credential.cert({
              projectId: firebaseConfig.projectId,
              clientEmail: firebaseConfig.clientEmail,
              privateKey: firebaseConfig.privateKey,
            }),
            storageBucket: firebaseConfig.storageBucket,
          });
        }

        return admin.storage();
      },
      inject: [ConfigService],
    },
  ],
  exports: ['FIREBASE_STORAGE'],
})
export class FirebaseStorageModule {}

