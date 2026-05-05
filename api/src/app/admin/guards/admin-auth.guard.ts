import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { AdminService } from '../admin.service';
import * as admin from 'firebase-admin';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private adminService: AdminService,
    @Inject('FIREBASE_AUTH')
    private firebaseAuth: admin.auth.Auth,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      // Verify the Firebase ID token
      const decodedToken = await this.firebaseAuth.verifyIdToken(token);
      
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
        email: decodedToken.email || '',
        firebaseUid: decodedToken.uid,
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
    const adminUser = await this.adminService.getAdminUserByEmail(email);
    return adminUser !== null;
  }
}

