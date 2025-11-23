import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@primer/react';
import { quizAuthService } from '../../services/auth';
import './Login.scss';

export default function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect if already logged in
  useEffect(() => {
    const unsubscribe = quizAuthService.subscribe((user) => {
      if (user) {
        navigate('/', { replace: true });
      }
    });

    // Check initial state
    if (quizAuthService.isAuthenticated) {
      navigate('/', { replace: true });
    }

    return unsubscribe;
  }, [navigate]);

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);

    try {
      await quizAuthService.signInWithGoogle();
      // Navigation will happen automatically after OAuth redirect
    } catch (err: unknown) {
      const error = err as { message?: string };
      setError(error.message || 'Login failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-title">Welcome to SUB WARS V</h1>
          <p className="login-subtitle">Sign in with Google to participate in the quiz</p>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="login-content">
          <Button
            onClick={handleGoogleSignIn}
            disabled={loading}
            variant="primary"
            className="google-login-button"
            block
            size="large"
          >
            {loading ? (
              <span>Signing in...</span>
            ) : (
              <span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Sign in with Google
              </span>
            )}
          </Button>

          <div className="login-info">
            <p className="info-text">
              By signing in, you can participate in quizzes and REGISTER FOR SUB WARS V.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
