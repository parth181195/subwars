import { Injectable, NotFoundException, BadRequestException, ConflictException, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import * as bcrypt from 'bcrypt';
import { AdminUser, AdminUserInsert, AdminUserUpdate, AdminRole } from '../types/database.types';

@Injectable()
export class AdminService {
  constructor(
    @Inject('SUPABASE_ADMIN_CLIENT')
    private supabase: SupabaseClient,
  ) {}

  // Admin User Management
  async createAdminUser(adminUserInsert: AdminUserInsert): Promise<AdminUser> {
    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(adminUserInsert.password_hash, saltRounds);

    // Check if admin user already exists
    const { data: existing } = await this.supabase
      .from('admin_users')
      .select('*')
      .eq('email', adminUserInsert.email)
      .single();

    if (existing) {
      throw new ConflictException('Admin user already exists with this email');
    }

    const { data: adminUser, error } = await this.supabase
      .from('admin_users')
      .insert({
        ...adminUserInsert,
        password_hash: passwordHash,
        role: adminUserInsert.role || AdminRole.ADMIN,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Failed to create admin user: ${error.message}`);
    }

    return adminUser as AdminUser;
  }

  async getAdminUserById(id: string): Promise<AdminUser> {
    const { data: adminUser, error } = await this.supabase
      .from('admin_users')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !adminUser) {
      throw new NotFoundException(`Admin user with ID ${id} not found`);
    }

    return adminUser as AdminUser;
  }

  async getAdminUserByEmail(email: string): Promise<AdminUser | null> {
    const { data: adminUser } = await this.supabase
      .from('admin_users')
      .select('*')
      .eq('email', email)
      .single();

    return adminUser as AdminUser | null;
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

    const { data: adminUser, error } = await this.supabase
      .from('admin_users')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Failed to update admin user: ${error.message}`);
    }

    return adminUser as AdminUser;
  }

  async deleteAdminUser(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('admin_users')
      .delete()
      .eq('id', id);

    if (error) {
      throw new BadRequestException(`Failed to delete admin user: ${error.message}`);
    }
  }
}

