import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Navbar from './components/Navbar/Navbar';
import Footer from './components/Footer/Footer';
import Analytics from './components/Analytics/Analytics';
import AppLoader from './components/AppLoader/AppLoader';
import LoadingSpinner from './components/LoadingSpinner/LoadingSpinner';
import Home from './pages/Home/Home';
import QuizInfo from './pages/QuizInfo/QuizInfo';
import Login from './pages/Login/Login';
import Quiz from './pages/Quiz/Quiz';
import Profile from './pages/Profile/Profile';
import FAQ from './pages/FAQ/FAQ';
import Format from './pages/Format/Format';
import Leaderboard from './pages/Leaderboard/Leaderboard';
import LiveQuestionNotification from './LiveQuestionNotification';
import ToastContainer, { useToast } from './components/Toast/ToastContainer';
import { quizAuthService } from './services/auth';
import { analyticsService } from './services/analytics';
import './services/websocket'; // Initialize global WebSocket service
import { environment } from './config/environment';
import type { AuthUser } from './services/auth';
import './App.scss';

import { useLocation } from 'react-router-dom';

// Protected route component - requires authentication
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const location = useLocation();

  useEffect(() => {
    const unsubscribe = quizAuthService.subscribe((user: AuthUser | null) => {
      setIsAuthenticated(user !== null);
    });
    return unsubscribe;
  }, []);

  if (isAuthenticated === null) {
    return <LoadingSpinner message="Checking authentication..." fullPage />;
  }

  // Preserve the current route in state so we can redirect back after login
  return isAuthenticated ? <>{children}</> : <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} state={{ from: location }} replace />;
};

function App() {
  const { toasts, addToast, removeToast } = useToast();

  // Initialize Google Analytics on app mount
  useEffect(() => {
    const measurementId = environment.googleAnalytics.measurementId;
    
    if (measurementId) {
      analyticsService.initialize(measurementId);
    }
  }, []);

  // Initialize WebSocket service (it will auto-connect when user logs in)
  useEffect(() => {
    // Just importing the service initializes it and sets up auth subscription
    // The service will automatically connect/disconnect based on auth state
  }, []);

  // Listen for user-banned event from auth service
  useEffect(() => {
    const handleUserBanned = (event: CustomEvent) => {
      addToast({
        type: 'error',
        title: 'Account Banned',
        message: event.detail.message || 'Your account has been banned. You cannot access the quiz app.',
        duration: 8000,
      });
    };

    window.addEventListener('user-banned', handleUserBanned as EventListener);
    return () => {
      window.removeEventListener('user-banned', handleUserBanned as EventListener);
    };
  }, [addToast]);

  return (
    <AppLoader>
      <Analytics />
      <Navbar />
      <LiveQuestionNotification />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/format" element={<Format />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/login" element={<Login />} />
        {/* Quiz routes - only available if SHOW_QUIZ is enabled */}
        {environment.showQuiz && (
          <>
            <Route path="/quiz-info" element={<ProtectedRoute><QuizInfo /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/quiz" element={<ProtectedRoute><Quiz /></ProtectedRoute>} />
          </>
        )}
        {/* Redirect quiz routes to home if quiz is disabled */}
        {!environment.showQuiz && (
          <>
            <Route path="/quiz-info" element={<Navigate to="/" replace />} />
            <Route path="/profile" element={<Navigate to="/" replace />} />
            <Route path="/quiz" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
      <Footer />
    </AppLoader>
  );
}

export default App;
