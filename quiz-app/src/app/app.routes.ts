import { Route } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const appRoutes: Route[] = [
  {
    path: '',
    redirectTo: '/home',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent)
  },
  {
    path: 'quiz-info',
    loadComponent: () => import('./pages/quiz-info/quiz-info.component').then(m => m.QuizInfoComponent)
  },
  {
    path: 'registration',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/registration/registration.component').then(m => m.RegistrationComponent)
  },
  {
    path: 'registration-status',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/registration-status/registration-status.component').then(m => m.RegistrationStatusComponent)
  },
  {
    path: 'quiz/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/quiz/quiz.component').then(m => m.QuizComponent)
  }
];
