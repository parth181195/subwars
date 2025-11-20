import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { SupabaseService } from '../../services/supabase.service';
import { AuthService } from '../../services/auth.service';
import { RegistrationService } from '../../services/registration.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy {
  activeQuizzes: any[] = [];
  loading = true;
  isAuthenticated = false;
  isRegistered = false;
  registrationStatus: any = null;
  firstQuizId: string | null = null;
  private authSubscription?: Subscription;

  constructor(
    private supabaseService: SupabaseService,
    private authService: AuthService,
    private registrationService: RegistrationService,
    private router: Router
  ) {}

  async ngOnInit() {
    this.checkAuth();
    
    // Subscribe to authentication state changes
    this.authSubscription = this.authService.currentUser$.subscribe(async (user) => {
      this.isAuthenticated = !!user;
      if (this.isAuthenticated) {
        await this.checkRegistrationStatus();
      } else {
        this.isRegistered = false;
        this.registrationStatus = null;
      }
    });

    await this.loadActiveQuizzes();
  }

  ngOnDestroy() {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }

  async checkAuth() {
    this.isAuthenticated = this.authService.isAuthenticated;
    if (this.isAuthenticated) {
      await this.checkRegistrationStatus();
    }
  }

  async checkRegistrationStatus() {
    const user = this.authService.currentUser;
    if (user?.id) {
      try {
        this.registrationStatus = await this.registrationService.getRegistrationStatus(user.id).toPromise();
        this.isRegistered = this.registrationStatus?.exists || false;
      } catch (error) {
        console.error('Error checking registration status:', error);
      }
    }
  }

  async loadActiveQuizzes() {
    try {
      this.loading = true;
      this.activeQuizzes = await this.supabaseService.getActiveQuizzes();
      if (this.activeQuizzes.length > 0) {
        this.firstQuizId = this.activeQuizzes[0].id;
      }
    } catch (error) {
      console.error('Error loading quizzes:', error);
    } finally {
      this.loading = false;
    }
  }

  joinQuiz(quizId: string) {
    if (!this.isAuthenticated) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: `/quiz/${quizId}` } });
      return;
    }
    this.router.navigate(['/quiz', quizId]);
  }

  goToRegistration() {
    if (!this.isAuthenticated) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/registration' } });
      return;
    }
    this.router.navigate(['/registration']);
  }

  goToRegistrationStatus() {
    this.router.navigate(['/registration-status']);
  }

  signIn() {
    this.router.navigate(['/login']);
  }

  signOut() {
    this.authService.signOut();
  }

  navigateToQuizInfo() {
    this.router.navigate(['/quiz-info']);
  }
}

