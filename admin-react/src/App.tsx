import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { adminAuthService } from './services/auth';
import LoginPage from './pages/Login/Login';
import SignupPage from './pages/Signup/Signup';
import DashboardLayout from './components/DashboardLayout/DashboardLayout';
import Dashboard from './pages/Dashboard/Dashboard';
import Settings from './pages/Settings/Settings';
import Quizzes from './pages/Quizzes/Quizzes';
import QuizDetail from './pages/QuizDetail/QuizDetail';
import Answers from './pages/Answers/Answers';

type User = {
  id: string;
  email?: string;
  [key: string]: any;
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    const unsubscribe = adminAuthService.subscribe((currentUser) => {
      if (isMounted) {
        setUser(currentUser);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={
          user ? <Navigate to="/dashboard" replace /> : <LoginPage />
        } />
        <Route path="/signup" element={
          user ? <Navigate to="/dashboard" replace /> : <SignupPage />
        } />
        <Route path="/dashboard" element={
          user ? (
            <DashboardLayout>
              <Dashboard />
            </DashboardLayout>
          ) : (
            <Navigate to="/login" replace />
          )
        } />
        <Route path="/settings" element={
          user ? (
            <DashboardLayout>
              <Settings />
            </DashboardLayout>
          ) : (
            <Navigate to="/login" replace />
          )
        } />
        <Route path="/quizzes" element={
          user ? (
            <DashboardLayout>
              <Quizzes />
            </DashboardLayout>
          ) : (
            <Navigate to="/login" replace />
          )
        } />
        <Route path="/quizzes/:id" element={
          user ? (
            <DashboardLayout>
              <QuizDetail />
            </DashboardLayout>
          ) : (
            <Navigate to="/login" replace />
          )
        } />
        <Route path="/quizzes/:id/questions/:questionId/answers" element={
          user ? (
            <DashboardLayout>
              <Answers />
            </DashboardLayout>
          ) : (
            <Navigate to="/login" replace />
          )
        } />
        <Route path="*" element={
          user ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Navigate to="/login" replace />
          )
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
