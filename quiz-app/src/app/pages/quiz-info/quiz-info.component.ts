import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { RegistrationService } from '../../services/registration.service';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-quiz-info',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './quiz-info.component.html',
  styleUrls: ['./quiz-info.component.css']
})
export class QuizInfoComponent implements OnInit {
  isAuthenticated = false;
  isRegistered = false;
  activeQuizzes: any[] = [];
  loading = true;
  firstQuizId: string | null = null;

  constructor(
    private authService: AuthService,
    private registrationService: RegistrationService,
    private supabaseService: SupabaseService,
    private router: Router
  ) {}

  async ngOnInit() {
    this.isAuthenticated = this.authService.isAuthenticated;
    
    if (this.isAuthenticated) {
      await this.checkRegistrationStatus();
      await this.loadActiveQuizzes();
    }
  }

  async checkRegistrationStatus() {
    const user = this.authService.currentUser;
    if (user?.id) {
      try {
        const status = await this.registrationService.getRegistrationStatus(user.id).toPromise();
        this.isRegistered = status?.exists || false;
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

  signIn() {
    this.router.navigate(['/login']);
  }

  navigateToHome() {
    this.router.navigate(['/home']);
  }
}

