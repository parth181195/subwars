/**
 * Example Firebase Admin Auth Guard Implementation
 * 
 * This is an example of how to replace Supabase JWT verification with Firebase Admin SDK.
 * To use this:
 * 1. Install firebase-admin: npm install firebase-admin
 * 2. Initialize Firebase Admin in your app module
 * 3. Replace the existing AdminAuthGuard with this implementation
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { AdminService } from '../admin.service';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private adminService: AdminService,
    private configService: ConfigService,
  ) {
    // Initialize Firebase Admin if not already initialized
    if (!admin.apps.length) {
      const serviceAccount = {
        projectId: this.configService.get<string>('firebase.projectId'),
        privateKey: this.configService.get<string>('firebase.privateKey')?.replace(/\\n/g, '\n'),
        clientEmail: this.configService.get<string>('firebase.clientEmail'),
      };

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
      });
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      // Verify the Firebase ID token
      const decodedToken = await admin.auth().verifyIdToken(token);
      
      const email = decodedToken.email;
      if (!email) {
        throw new UnauthorizedException('User email not found in token');
      }

      // Check if user is an admin
      const isAdmin = await this.checkAdminAccess(email);
      
      if (!isAdmin) {
        throw new UnauthorizedException('Access denied. Admin privileges required.');
      }

      // Attach user info to request for use in controllers
      request.user = {
        id: decodedToken.uid,
        email: decodedToken.email,
        firebaseUid: decodedToken.uid, // Store Firebase UID
      };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      
      // Handle Firebase-specific errors
      if (error instanceof Error) {
        if (error.message.includes('id-token-expired')) {
          throw new UnauthorizedException('Token expired. Please sign in again.');
        }
        if (error.message.includes('id-token-revoked')) {
          throw new UnauthorizedException('Token revoked. Please sign in again.');
        }
      }
      
      throw new UnauthorizedException(
        `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async checkAdminAccess(email: string): Promise<boolean> {
    // Hardcoded allowed emails (from admin-react environment config)
    const allowedEmails = [
      'parthjansari@outlook.com',
      'parthrock181195@gmail.com',
    ];

    if (allowedEmails.includes(email)) {
      return true;
    }

    // Check against admin_users table
    // Note: You may need to update this query to use Firebase UID instead of email
    const adminUser = await this.adminService.getAdminUserByEmail(email);
    return adminUser !== null;
  }
}

