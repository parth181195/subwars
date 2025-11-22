import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Navbar from './components/Navbar/Navbar';
import Footer from './components/Footer/Footer';
import Analytics from './components/Analytics/Analytics';
import Home from './pages/Home/Home';
import QuizInfo from './pages/QuizInfo/QuizInfo';
import Login from './pages/Login/Login';
import Quiz from './pages/Quiz/Quiz';
import Profile from './pages/Profile/Profile';
import { quizAuthService } from './services/auth';
import { analyticsService } from './services/analytics';
import { environment } from './config/environment';
import type { AuthUser } from './services/auth';
import './App.scss';

// Protected route component - requires authentication
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const unsubscribe = quizAuthService.subscribe((user: AuthUser | null) => {
      setIsAuthenticated(user !== null);
    });
    return unsubscribe;
  }, []);

  if (isAuthenticated === null) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 64px)' }}>Loading...</div>;
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

function App() {
  // Initialize Google Analytics on app mount
  useEffect(() => {
    const measurementId = environment.googleAnalytics.measurementId;
    console.log('[App] Initializing Google Analytics with ID:', measurementId);
    
    if (measurementId) {
      analyticsService.initialize(measurementId);
    } else {
      console.warn('[App] Google Analytics Measurement ID not found');
    }
  }, []);

  return (
    <>
      <Analytics />
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/quiz-info" element={<QuizInfo />} />
        <Route path="/login" element={<Login />} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/quiz" element={<ProtectedRoute><Quiz /></ProtectedRoute>} />
      </Routes>
      <Footer />
    </>
  );
}

export default App;
