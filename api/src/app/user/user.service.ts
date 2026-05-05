import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { User, UserInsert, UserUpdate, RegistrationStatus } from '../types/database.types';
import { PostgresService } from '../services/postgres.service';
import * as admin from 'firebase-admin';

@Injectable()
export class UserService {
  constructor(
    private postgres: PostgresService,
    @Inject('FIREBASE_AUTH') private firebaseAuth: admin.auth.Auth,
  ) {}

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    return this.postgres.getById<User>('users', userId);
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    const users = await this.postgres.query<User>(
      'users',
      [{ field: 'email', operator: '==', value: email }],
      undefined,
      1
    );
    return users.length > 0 ? users[0] : null;
  }

  /**
   * Create a new user
   * @param userInsert User data to insert
   * @param userId Optional user ID (Firebase UID). If not provided, a new ID will be generated.
   */
  async createUser(userInsert: UserInsert, userId?: string): Promise<User> {
    try {
      const user = await this.postgres.create<User>(
        'users',
        {
          ...userInsert,
          steam_profile_verified: userInsert.steam_profile_verified || false,
          discord_verified: userInsert.discord_verified || false,
          registration_status: userInsert.registration_status || RegistrationStatus.PENDING,
          is_banned: userInsert.is_banned || false,
        },
        userId // Use Firebase UID as document ID if provided
      );
      return user;
    } catch (error) {
      throw new BadRequestException(`Failed to create user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update user
   */
  async updateUser(userId: string, userUpdate: UserUpdate): Promise<User> {
    const existing = await this.getUserById(userId);
    if (!existing) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    try {
      const updated = await this.postgres.update<User>('users', userId, userUpdate);
      return updated;
    } catch (error) {
      throw new BadRequestException(`Failed to update user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete user
   */
  async deleteUser(userId: string): Promise<void> {
    const existing = await this.getUserById(userId);
    if (!existing) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    await this.postgres.delete('users', userId);
  }

  /**
   * Ensure user exists in users collection
   * If user doesn't exist, create a basic record from Firebase Auth
   * Returns true if user exists or was created successfully, false otherwise
   */
  async ensureUserExists(authUserId: string): Promise<boolean> {
    // Check if user already exists in users table
    const existingUser = await this.getUserById(authUserId);

    if (existingUser) {
      return true; // User already exists
    }

    // Get user info from Firebase Auth
    let authUserData: admin.auth.UserRecord | null = null;
    try {
      authUserData = await this.firebaseAuth.getUser(authUserId);
    } catch (error) {
      console.error('Error fetching auth user:', error);
      return false;
    }
    
    // Prepare user data for insertion
    const userEmail = authUserData?.email || `user-${authUserId.slice(0, 8)}@temp.com`;
    const displayName = authUserData?.displayName || authUserData?.email?.split('@')[0] || 'Quiz Participant';
    const photoURL = authUserData?.photoURL;
    
    const userData: UserInsert = {
      email: userEmail,
      google_id: authUserId, // In Firebase, the UID serves as the google_id
      full_name: displayName,
      registration_status: RegistrationStatus.PENDING,
    };

    // Add optional fields if available
    if (photoURL) {
      userData.profile_image_url = photoURL;
    }

    // Check if user with this email already exists (with different ID)
    const existingUserByEmail = await this.getUserByEmail(userEmail);

    if (existingUserByEmail && existingUserByEmail.id !== authUserId) {
      console.log(`User with email ${userEmail} exists with ID ${existingUserByEmail.id}, but auth user ID is ${authUserId}. This is a migration scenario.`);
      
      // For now, we'll create a new user with the auth user ID
      // In a full migration, you might want to merge data or handle this differently
      // TODO: Handle user migration/mapping if needed
    }

    try {
      // Create user with Firebase UID as document ID
      await this.createUser(userData, authUserId);
      return true;
    } catch (error) {
      console.error('Failed to create user in Firestore:', error);
      // Check if user was created by another concurrent request
      const verifyUser = await this.getUserById(authUserId);
      return !!verifyUser;
    }
  }

  /**
   * Sync user data from Firebase Auth
   * Updates user record with latest info from Firebase Auth
   */
  async syncUserFromFirebaseAuth(userId: string): Promise<User> {
    const existing = await this.getUserById(userId);
    if (!existing) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    try {
      const authUser = await this.firebaseAuth.getUser(userId);
      
      const updates: UserUpdate = {};
      
      if (authUser.email && authUser.email !== existing.email) {
        updates.email = authUser.email;
      }
      
      if (authUser.displayName && authUser.displayName !== existing.full_name) {
        updates.full_name = authUser.displayName;
      }
      
      if (authUser.photoURL && authUser.photoURL !== existing.profile_image_url) {
        updates.profile_image_url = authUser.photoURL;
      }

      if (Object.keys(updates).length > 0) {
        return await this.updateUser(userId, updates);
      }

      return existing;
    } catch (error) {
      console.error('Failed to sync user from Firebase Auth:', error);
      throw new BadRequestException(`Failed to sync user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all users with optional filtering and pagination
   */
  async getAllUsers(
    filters?: Array<{ field: string; operator: 'in' | '<' | '<=' | '==' | '!=' | '>=' | '>'; value: any }>,
    orderBy?: { field: string; direction: 'asc' | 'desc' },
    limit?: number
  ): Promise<User[]> {
    return this.postgres.query<User>('users', filters, orderBy, limit);
  }
}

