import { Injectable, NotFoundException, BadRequestException, ConflictException, Inject, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import * as bcrypt from 'bcrypt';
import { AdminUser, AdminUserInsert, AdminUserUpdate, AdminRole } from '../types/database.types';
import { AdminUserModel } from '../models/admin-user.model';
import * as admin from 'firebase-admin';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private readonly allowedAdminEmails = [
    'parthjansari@outlook.com',
    'parthrock181195@gmail.com',
  ];

  constructor(
    @InjectModel(AdminUserModel)
    private readonly adminUserModel: typeof AdminUserModel,
    @Inject('FIREBASE_AUTH')
    private firebaseAuth: admin.auth.Auth,
  ) {}

  // Admin User Management
  async createAdminUser(adminUserInsert: AdminUserInsert): Promise<AdminUser> {
    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(adminUserInsert.password_hash, saltRounds);

    // Check if admin user already exists
    const existing = await this.adminUserModel.findOne({
      where: { email: adminUserInsert.email },
    });

    if (existing) {
      throw new ConflictException('Admin user already exists with this email');
    }

    try {
      const adminUser = await this.adminUserModel.create({
        ...adminUserInsert,
        password_hash: passwordHash,
        role: adminUserInsert.role || AdminRole.ADMIN,
      });
      return adminUser.get({ plain: true }) as AdminUser;
    } catch (error) {
      throw new BadRequestException(`Failed to create admin user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getAdminUserById(id: string): Promise<AdminUser> {
    const adminUser = await this.adminUserModel.findByPk(id);

    if (!adminUser) {
      throw new NotFoundException(`Admin user with ID ${id} not found`);
    }

    return adminUser.get({ plain: true }) as AdminUser;
  }

  async getAdminUserByEmail(email: string): Promise<AdminUser | null> {
    try {
      const adminUser = await this.adminUserModel.findOne({
        where: { email },
      });
      return adminUser ? (adminUser.get({ plain: true }) as AdminUser) : null;
    } catch (error) {
      this.logger.error(`Error fetching admin user by email: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  /**
   * Check if an email is authorized for admin access
   * Returns true if email is in allowedAdminEmails list or in admin_users table
   */
  async checkAdminAccess(email: string): Promise<boolean> {
    if (!email) {
      return false;
    }

    // Check against hardcoded allowed emails
    if (this.allowedAdminEmails.includes(email)) {
      return true;
    }

    // Check against admin_users table
    const adminUser = await this.getAdminUserByEmail(email);
    return adminUser !== null;
  }

  /**
   * Get all admin users (from admin_users table)
   */
  async getAllAdminUsers(): Promise<AdminUser[]> {
    try {
      const adminUsers = await this.adminUserModel.findAll({
        order: [['created_at', 'DESC']],
      });
      return adminUsers.map(u => u.get({ plain: true })) as AdminUser[];
    } catch (error) {
      throw new BadRequestException(`Failed to fetch admin users: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Invite a new admin user
   * - Adds email to admin_users table
   * - Creates user in Firebase Auth (if not exists)
   * - Sends password reset/invitation email via Firebase
   */
  async inviteAdminUser(email: string, role: AdminRole = AdminRole.ADMIN): Promise<{ success: boolean; message: string }> {
    // Validate email
    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      throw new BadRequestException('Invalid email address');
    }

    // Check if already in admin_users table
    const existingAdmin = await this.getAdminUserByEmail(email);
    if (existingAdmin) {
      throw new ConflictException('This email is already an admin');
    }

    try {
      // Add to admin_users table (tracking purposes) - do this first
      let adminUserDocId: string | undefined;
      try {
        const adminUser = await this.adminUserModel.create({
          email,
          role,
          password_hash: '', // Not used - we use Firebase Auth
        });
        adminUserDocId = adminUser.id;
      } catch (error) {
        this.logger.error(`Error creating admin user: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : '');
        throw new BadRequestException(`Failed to add admin user: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Try to create/invite user via Firebase Auth
      let firebaseUser: admin.auth.UserRecord;
      try {
        // Check if user already exists
        try {
          firebaseUser = await this.firebaseAuth.getUserByEmail(email);
          this.logger.log(`User ${email} already exists in Firebase Auth. Admin added to tracking table.`);
          return {
            success: true,
            message: `Admin user added. Since ${email} already has a Firebase Auth account, they can sign in directly.`,
          };
        } catch (error: any) {
          // User doesn't exist, create them
          if (error.code === 'auth/user-not-found') {
            // Generate a temporary password (user will need to reset it)
            const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12) + 'A1!';
            firebaseUser = await this.firebaseAuth.createUser({
              email,
              password: tempPassword,
              emailVerified: false,
            });

            // Send password reset email so they can set their own password
            const resetLink = await this.firebaseAuth.generatePasswordResetLink(email);
            // Note: In production, you'd send this link via email service
            this.logger.log(`Password reset link for ${email}: ${resetLink}`);
            
            return {
              success: true,
              message: `Admin user created. Password reset link generated. Send this link to ${email} to complete setup.`,
            };
          }
          throw error;
        }
      } catch (error: any) {
        // Rollback admin_users insertion if invite fails
        if (adminUserDocId) {
          try {
            const adminUserInstance = await this.adminUserModel.findByPk(adminUserDocId);
            if (adminUserInstance) {
              await adminUserInstance.destroy();
            }
          } catch (deleteError) {
            this.logger.error(`Failed to rollback admin user creation: ${deleteError}`);
          }
        }
        
        throw new BadRequestException(`Failed to create Firebase user: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } catch (error) {
      if (error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to invite admin user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate if an email is authorized for admin signup
   * Returns true if email is in allowedAdminEmails or admin_users table
   */
  async validateAdminSignup(email: string): Promise<{ authorized: boolean; message?: string }> {
    const isAuthorized = await this.checkAdminAccess(email);
    
    if (!isAuthorized) {
      return {
        authorized: false,
        message: 'This email is not authorized for admin access. Please contact an administrator to invite you.',
      };
    }

    return {
      authorized: true,
    };
  }

  /**
   * Delete admin user by email
   */
  async deleteAdminUserByEmail(email: string): Promise<void> {
    const adminUser = await this.getAdminUserByEmail(email);
    
    if (!adminUser) {
      throw new NotFoundException(`Admin user with email ${email} not found`);
    }

    try {
      const adminUserInstance = await this.adminUserModel.findByPk(adminUser.id);
      if (!adminUserInstance) {
        throw new NotFoundException(`Admin user with ID ${adminUser.id} not found`);
      }
      await adminUserInstance.destroy();
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to delete admin user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async verifyAdminPassword(email: string, password: string): Promise<AdminUser> {
    const adminUser = await this.getAdminUserByEmail(email);
    
    if (!adminUser) {
      throw new NotFoundException('Invalid email or password');
    }

    const isValid = await bcrypt.compare(password, adminUser.password_hash);
    
    if (!isValid) {
      throw new NotFoundException('Invalid email or password');
    }

    return adminUser;
  }

  async updateAdminUser(id: string, adminUserUpdate: AdminUserUpdate): Promise<AdminUser> {
    const updates: AdminUserUpdate = { ...adminUserUpdate };

    // Hash password if provided
    if (adminUserUpdate.password_hash) {
      const saltRounds = 10;
      updates.password_hash = await bcrypt.hash(adminUserUpdate.password_hash, saltRounds);
    }

    try {
      const adminUserInstance = await this.adminUserModel.findByPk(id);
      if (!adminUserInstance) {
        throw new NotFoundException(`Admin user with ID ${id} not found`);
      }
      await adminUserInstance.update(updates as any);
      await adminUserInstance.reload();
      return adminUserInstance.get({ plain: true }) as AdminUser;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to update admin user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteAdminUser(id: string): Promise<void> {
    try {
      const adminUserInstance = await this.adminUserModel.findByPk(id);
      if (!adminUserInstance) {
        throw new NotFoundException(`Admin user with ID ${id} not found`);
      }
      await adminUserInstance.destroy();
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to delete admin user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

