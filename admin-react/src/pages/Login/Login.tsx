import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@primer/react';
import { SignInIcon } from '@primer/octicons-react';
import { adminAuthService } from '../../services/auth';
import './Login.scss';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await adminAuthService.signInWithEmail(email, password);
      navigate('/dashboard');
    } catch (err: unknown) {
      const error = err as { message?: string };
      setError(error.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-icon-wrapper">
            <SignInIcon size={48} className="login-icon" />
          </div>
          <h1 className="login-title">SUB WARS V Admin</h1>
          <p className="login-subtitle">Sign in to access the admin dashboard</p>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              className="login-input"
            />
          </div>

          <div className="login-form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              className="login-input"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={loading || !email || !password}
            className="login-button"
            block
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </Button>
        </form>

        <div className="login-footer">
          <p>
            Don't have an account?{' '}
            <a
              href="/signup"
              onClick={(e) => {
                e.preventDefault();
                navigate('/signup');
              }}
              className="signup-link"
            >
              Sign up here
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
