import { Component, OnInit, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { RegistrationService } from '../../services/registration.service';

interface RegistrationDetails {
  id: string;
  email: string;
  full_name: string;
  phone_number?: string;
  in_game_name?: string;
  dota2_friend_id?: string;
  steam_profile_link?: string;
  steam_profile_verified: boolean;
  dotabuff_profile_link?: string;
  rank_and_mmr?: string;
  discord_id?: string;
  discord_verified: boolean;
  profile_image_url?: string;
  proof_of_payment_url?: string;
  upi_id?: string;
  registration_status: 'pending' | 'approved' | 'rejected' | 'payment_pending';
  admin_notes?: string;
  created_at: string;
  updated_at: string;
}

@Component({
  selector: 'app-registration-status',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './registration-status.component.html',
  styleUrls: ['./registration-status.component.css']
})
export class RegistrationStatusComponent implements OnInit {
  loading = true;
  error: string | null = null;
  registration: RegistrationDetails | null = null;
  private isBrowser: boolean;

  constructor(
    private authService: AuthService,
    private registrationService: RegistrationService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit() {
    if (!this.isBrowser) {
      return;
    }

    const user = this.authService.currentUser;
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }

    this.loadRegistration();
  }

  async loadRegistration() {
    const user = this.authService.currentUser;
    if (!user?.id) {
      this.error = 'User not authenticated';
      this.loading = false;
      return;
    }

    try {
      const registration = await this.registrationService.getMyRegistration(user.id).toPromise();
      if (registration) {
        this.registration = registration;
      } else {
        // User not registered yet, redirect to registration
        this.router.navigate(['/registration']);
      }
    } catch (error: any) {
      if (error.status === 404) {
        // User not registered
        this.router.navigate(['/registration']);
      } else {
        this.error = error.error?.message || 'Failed to load registration details';
      }
    } finally {
      this.loading = false;
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'approved':
        return 'var(--accent-green)';
      case 'rejected':
        return 'var(--red)';
      case 'payment_pending':
        return 'var(--orange)';
      case 'pending':
      default:
        return 'var(--gold)';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'approved':
        return 'Approved ✓';
      case 'rejected':
        return 'Rejected ✗';
      case 'payment_pending':
        return 'Payment Pending';
      case 'pending':
      default:
        return 'Under Review';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'approved':
        return '✓';
      case 'rejected':
        return '✗';
      case 'payment_pending':
        return '💰';
      case 'pending':
      default:
        return '⏳';
    }
  }

  canEditRegistration(): boolean {
    if (!this.registration) return false;
    return this.registration.registration_status === 'pending' || 
           this.registration.registration_status === 'rejected';
  }

  editRegistration() {
    this.router.navigate(['/registration']);
  }

  goToHome() {
    this.router.navigate(['/home']);
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

