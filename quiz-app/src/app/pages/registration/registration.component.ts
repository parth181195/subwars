import { Component, OnInit, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RegistrationService, RegistrationData } from '../../services/registration.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-registration',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './registration.component.html',
  styleUrls: ['./registration.component.css']
})
export class RegistrationComponent implements OnInit {
  registrationData: RegistrationData = {
    email: '',
    googleId: '',
    fullName: '',
    phoneNumber: '',
    inGameName: '',
    dota2FriendId: '',
    steamProfileLink: '',
    rankAndMmr: '',
    discordId: '',
    upiId: ''
  };

  profileImage?: File;
  proofOfPayment?: File;
  profileImagePreview?: string;
  proofOfPaymentPreview?: string;
  discordJoined = false;
  submitting = false;
  error: string | null = null;
  success = false;
  private isBrowser: boolean;

  constructor(
    private registrationService: RegistrationService,
    private authService: AuthService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit() {
    const user = this.authService.currentUser;
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }

    // Set email and googleId from authenticated user
    this.registrationData.email = user.email || '';
    this.registrationData.googleId = user.id;
    
    // Check if user already registered
    this.checkExistingRegistration();
  }

  async checkExistingRegistration() {
    const user = this.authService.currentUser;
    if (user?.id) {
      try {
        const status = await this.registrationService.getRegistrationStatus(user.id).toPromise();
        if (status?.exists) {
          // User already registered, redirect to home or show message
          this.router.navigate(['/home']);
        }
      } catch (error) {
        console.error('Error checking registration:', error);
      }
    }
  }

  onProfileImageSelected(event: any) {
    if (!this.isBrowser || typeof FileReader === 'undefined') {
      return;
    }
    const file = event.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        this.error = 'Profile image must be less than 5MB';
        return;
      }
      if (!file.type.startsWith('image/')) {
        this.error = 'Profile image must be an image file';
        return;
      }
      this.profileImage = file;
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.profileImagePreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  onProofOfPaymentSelected(event: any) {
    if (!this.isBrowser || typeof FileReader === 'undefined') {
      return;
    }
    const file = event.target.files[0];
    if (file) {
      if (file.size > 100 * 1024 * 1024) {
        this.error = 'Proof of payment must be less than 100MB';
        return;
      }
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        this.error = 'Proof of payment must be a PDF or image file';
        return;
      }
      this.proofOfPayment = file;
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e: any) => {
          this.proofOfPaymentPreview = e.target.result;
        };
        reader.readAsDataURL(file);
      }
    }
  }

  async onSubmit() {
    this.error = null;
    
    // Validate Discord join
    if (!this.discordJoined) {
      this.error = 'Please confirm that you have joined the Discord server.';
      return;
    }

    // Validate required files
    if (!this.profileImage) {
      this.error = 'Profile image is required.';
      return;
    }

    if (!this.proofOfPayment) {
      this.error = 'Proof of payment is required.';
      return;
    }

    this.submitting = true;

    try {
      const formData = new FormData();
      
      // Add all form fields
      Object.keys(this.registrationData).forEach(key => {
        const value = (this.registrationData as any)[key];
        if (value !== null && value !== undefined && value !== '') {
          formData.append(key, value);
        }
      });

      // Add Discord verification
      formData.append('discordVerified', this.discordJoined.toString());

      // Add files
      if (this.profileImage) {
        formData.append('profileImage', this.profileImage);
      }
      if (this.proofOfPayment) {
        formData.append('proofOfPayment', this.proofOfPayment);
      }

      await this.registrationService.createRegistration(formData).toPromise();
      this.success = true;
      
      // Redirect after 2 seconds
      if (this.isBrowser && typeof setTimeout !== 'undefined') {
        setTimeout(() => {
          this.router.navigate(['/home']);
        }, 2000);
      } else {
        // On server, redirect immediately
        this.router.navigate(['/home']);
      }
    } catch (error: any) {
      this.error = error.error?.message || 'Registration failed. Please try again.';
    } finally {
      this.submitting = false;
    }
  }
}

