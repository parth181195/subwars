import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
  ForbiddenException,
} from '@nestjs/common';
import * as admin from 'firebase-admin';
import { UserService } from '../../user/user.service';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    @Inject('FIREBASE_AUTH')
    private firebaseAuth: admin.auth.Auth,
    private userService: UserService,
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
      
      // Check if user is banned
      const user = await this.userService.getUserById(decodedToken.uid);
      if (user && user.is_banned) {
        throw new ForbiddenException('Your account has been banned. Please contact support.');
      }

      // Attach user info to request for use in controllers
      request.user = {
        id: decodedToken.uid,
        uid: decodedToken.uid, // Also set uid for compatibility
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
}

