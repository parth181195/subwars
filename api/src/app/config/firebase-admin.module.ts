import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'FIREBASE_ADMIN',
      useFactory: (configService: ConfigService): admin.app.App => {
        // Initialize Firebase Admin if not already initialized
        if (!admin.apps.length) {
          const projectId = configService.get<string>('firebase.projectId');
          const privateKey = configService.get<string>('firebase.privateKey')?.replace(/\\n/g, '\n');
          const clientEmail = configService.get<string>('firebase.clientEmail');

          if (!projectId || !privateKey || !clientEmail) {
            throw new Error('Firebase Admin configuration is missing. Please set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL environment variables.');
          }

          return admin.initializeApp({
            credential: admin.credential.cert({
              projectId,
              privateKey,
              clientEmail,
            } as admin.ServiceAccount),
            projectId,
          });
        }

        return admin.apps[0];
      },
      inject: [ConfigService],
    },
    {
      provide: 'FIRESTORE',
      useFactory: (app: admin.app.App, configService: ConfigService) => {
        const databaseId = configService.get<string>('firebase.databaseId') || 'subwars-5';
        // Get Firestore instance and set the database ID
        const firestore = app.firestore();
        // Optimize Firestore settings for better performance
        firestore.settings({ 
          databaseId,
          // Increase max concurrent requests (default is 100)
          // This helps with parallel operations
          ignoreUndefinedProperties: true, // Skip undefined properties to reduce payload size
        });
        return firestore;
      },
      inject: ['FIREBASE_ADMIN', ConfigService],
    },
    {
      provide: 'FIREBASE_AUTH',
      useFactory: (app: admin.app.App) => {
        return app.auth();
      },
      inject: ['FIREBASE_ADMIN'],
    },
  ],
  exports: ['FIREBASE_ADMIN', 'FIRESTORE', 'FIREBASE_AUTH'],
})
export class FirebaseAdminModule {}

