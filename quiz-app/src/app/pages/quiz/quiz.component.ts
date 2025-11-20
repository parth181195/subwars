import { Component, OnInit, OnDestroy, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { AuthService } from '../../services/auth.service';
import { RegistrationService } from '../../services/registration.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-quiz',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './quiz.component.html',
  styleUrls: ['./quiz.component.css']
})
export class QuizComponent implements OnInit, OnDestroy {
  quizId: string = '';
  quiz: any = null;
  currentQuestion: any = null;
  answer: string = '';
  timeLeft: number = 0;
  timerInterval: any;
  loading = true;
  submitted = false;
  leaderboard: any[] = [];
  score = 0;
  questionIndex = 0;
  totalQuestions = 0;
  isRegistered = false;
  userId: string | null = null;

  private leaderboardChannel: any;
  private isBrowser: boolean;

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private supabaseService: SupabaseService,
    private authService: AuthService,
    private registrationService: RegistrationService,
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  async ngOnInit() {
    this.quizId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.quizId) {
      this.router.navigate(['/home']);
      return;
    }

    // Check if user is authenticated
    const user = this.authService.currentUser;
    if (!user) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: `/quiz/${this.quizId}` } });
      return;
    }

    this.userId = user.id;
    await this.checkRegistrationStatus();

    await this.loadQuiz();
    await this.loadCurrentQuestion();
    this.startTimer();
    this.subscribeToLeaderboard();
  }

  async checkRegistrationStatus() {
    if (!this.userId) return;
    
    try {
      const status = await this.registrationService.getRegistrationStatus(this.userId).toPromise();
      this.isRegistered = status?.exists || false;
    } catch (error) {
      console.error('Error checking registration status:', error);
    }
  }

  ngOnDestroy() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    if (this.leaderboardChannel) {
      this.supabaseService.unsubscribe(this.leaderboardChannel);
    }
  }

  async loadQuiz() {
    try {
      this.loading = true;
      this.quiz = await this.supabaseService.getQuiz(this.quizId);
      const questions = await this.supabaseService.getQuizQuestions(this.quizId);
      this.totalQuestions = questions.length;
    } catch (error) {
      console.error('Error loading quiz:', error);
      this.router.navigate(['/home']);
    } finally {
      this.loading = false;
    }
  }

  async loadCurrentQuestion() {
    try {
      this.currentQuestion = await this.supabaseService.getCurrentQuestion(this.quizId);
      if (this.currentQuestion) {
        // Get questions to find index
        const questions = await this.supabaseService.getQuizQuestions(this.quizId);
        this.questionIndex = questions.findIndex((q: any) => q.id === this.currentQuestion.id) + 1;
      }
    } catch (error) {
      console.error('Error loading question:', error);
    }
  }

  startTimer() {
    if (!this.isBrowser) {
      return;
    }
    this.timeLeft = 30; // Default 30 seconds
    this.timerInterval = setInterval(() => {
      if (this.timeLeft > 0) {
        this.timeLeft--;
      } else {
        this.submitAnswer(true); // Auto-submit on timeout
      }
    }, 1000);
  }

  async submitAnswer(isTimeout = false) {
    if (!this.currentQuestion || this.submitted || (!this.answer.trim() && !isTimeout)) {
      return;
    }

    // Only registered users can submit answers
    if (!this.isRegistered) {
      if (this.isBrowser && typeof window !== 'undefined') {
        alert('Registration required to submit answers. Please register first to participate in the contest.');
      }
      this.router.navigate(['/registration']);
      return;
    }

    this.submitted = true;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }

    try {
      const response: any = await this.http.post(
        `${environment.apiUrl}/quiz/${this.quizId}/answer`,
        {
          questionId: this.currentQuestion.id,
          answer: this.answer.trim() || '',
          responseTime: 30000 - (this.timeLeft * 1000)
        }
      ).toPromise();

      if (response.isCorrect) {
        this.score += response.score || 0;
      }

      // Reload leaderboard
      await this.loadLeaderboard();

      // Wait 3 seconds before next question or end
      if (this.isBrowser && typeof setTimeout !== 'undefined') {
        setTimeout(async () => {
          await this.loadCurrentQuestion();
          if (this.currentQuestion) {
            this.answer = '';
            this.submitted = false;
            this.startTimer();
          } else {
            // Quiz ended
            this.currentQuestion = null;
          }
        }, 3000);
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
      this.submitted = false;
    }
  }

  async loadLeaderboard() {
    try {
      this.leaderboard = await this.supabaseService.getLeaderboard(this.quizId);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    }
  }

  subscribeToLeaderboard() {
    this.leaderboardChannel = this.supabaseService.subscribeToLeaderboard(
      this.quizId,
      async (payload: any) => {
        await this.loadLeaderboard();
      }
    );
  }

  playAudio() {
    if (!this.isBrowser || typeof Audio === 'undefined') {
      return;
    }
    if (this.currentQuestion?.voice_line_url) {
      const audio = new Audio(this.currentQuestion.voice_line_url);
      audio.play();
    }
  }

  getTimerClass(): string {
    if (this.timeLeft <= 5) {
      return 'timer-danger';
    } else if (this.timeLeft <= 10) {
      return 'timer-warning';
    }
    return '';
  }
}

