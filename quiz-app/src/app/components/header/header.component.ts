import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { RegistrationService } from '../../services/registration.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit {
  isAuthenticated = false;
  isRegistered = false;
  userEmail: string | null = null;

  constructor(
    private authService: AuthService,
    private registrationService: RegistrationService,
    private router: Router
  ) {}

  ngOnInit() {
    this.checkAuth();
    
    this.authService.currentUser$.subscribe(user => {
      this.isAuthenticated = !!user;
      this.userEmail = user?.email || null;
      if (this.isAuthenticated) {
        this.checkRegistrationStatus();
      }
    });
  }

  async checkAuth() {
    this.isAuthenticated = this.authService.isAuthenticated;
    if (this.isAuthenticated) {
      const user = this.authService.currentUser;
      this.userEmail = user?.email || null;
      await this.checkRegistrationStatus();
    }
  }

  async checkRegistrationStatus() {
    const user = this.authService.currentUser;
    if (user?.id) {
      try {
        const status = await this.registrationService.getRegistrationStatus(user.id).toPromise();
        this.isRegistered = status?.exists || false;
      } catch (error) {
        console.error('Error checking registration:', error);
      }
    }
  }

  signIn() {
    this.router.navigate(['/login']);
  }

  signOut() {
    this.authService.signOut();
  }

  goToRegistration() {
    this.router.navigate(['/registration']);
  }

  goToRegistrationStatus() {
    this.router.navigate(['/registration-status']);
  }

  navigateTo(route: string) {
    this.router.navigate([route]);
  }
}

