import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { adminAuthService } from './services/auth';
import LoginPage from './pages/Login/Login';
import SignupPage from './pages/Signup/Signup';
import DashboardLayout from './components/DashboardLayout/DashboardLayout';
import Dashboard from './pages/Dashboard/Dashboard';
import Settings from './pages/Settings/Settings';
import Quizzes from './pages/Quizzes/Quizzes';
import QuizDetail from './pages/QuizDetail/QuizDetail';
import Answers from './pages/Answers/Answers';
import Overlay from './pages/Overlay/Overlay';
import CombinedLeaderboard from './pages/CombinedLeaderboard/CombinedLeaderboard';
import Users from './pages/Users/Users';
import ToastContainer, { useToast } from './components/Toast/ToastContainer';

type User = {
  id: string;
  email?: string;
  [key: string]: any;
};

function ProtectedRoute({ children, user }: { children: React.ReactNode; user: User | null }) {
  const location = useLocation();
  
  if (!user) {
    // Preserve the current route in state so we can redirect back after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  return <>{children}</>;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toasts, removeToast } = useToast();

  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | undefined;
    
    // Wait for auth initialization before setting up listener
    // This ensures we know the auth state before rendering routes
    adminAuthService.waitForInit().then(() => {
      if (isMounted) {
        // Now subscribe - the listener will be called immediately with current state
        unsubscribe = adminAuthService.subscribe((currentUser) => {
          if (isMounted) {
            setUser(currentUser);
            setLoading(false);
          }
        });
      }
    });
    
    return () => {
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
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
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={
          user ? <Navigate to="/dashboard" replace /> : <LoginPage />
        } />
        <Route path="/signup" element={
          user ? <Navigate to="/dashboard" replace /> : <SignupPage />
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute user={user}>
            <DashboardLayout>
              <Dashboard />
            </DashboardLayout>
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute user={user}>
            <DashboardLayout>
              <Settings />
            </DashboardLayout>
          </ProtectedRoute>
        } />
        <Route path="/quizzes" element={
          <ProtectedRoute user={user}>
            <DashboardLayout>
              <Quizzes />
            </DashboardLayout>
          </ProtectedRoute>
        } />
        <Route path="/quizzes/:id" element={
          <ProtectedRoute user={user}>
            <DashboardLayout>
              <QuizDetail />
            </DashboardLayout>
          </ProtectedRoute>
        } />
        <Route path="/quizzes/:id/questions/:questionId/answers" element={
          <ProtectedRoute user={user}>
            <DashboardLayout>
              <Answers />
            </DashboardLayout>
          </ProtectedRoute>
        } />
        <Route path="/overlay" element={
          <ProtectedRoute user={user}>
            <Overlay />
          </ProtectedRoute>
        } />
        <Route path="/leaderboard" element={
          <ProtectedRoute user={user}>
            <DashboardLayout>
              <CombinedLeaderboard />
            </DashboardLayout>
          </ProtectedRoute>
        } />
        <Route path="/users" element={
          <ProtectedRoute user={user}>
            <DashboardLayout>
              <Users />
            </DashboardLayout>
          </ProtectedRoute>
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
    </>
  );
}

export default App;
