import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button, FormControl, TextInput, Flash } from '@primer/react';
import { SignInIcon } from '@primer/octicons-react';
import { adminAuthService } from '../../services/auth';
import './Login.scss';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Get the route the user was trying to access (if redirected from protected route)
  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await adminAuthService.signInWithEmail(email, password);
      // Redirect to the page they were trying to access, or dashboard by default
      navigate(from, { replace: true });
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
          <Flash variant="danger" className="error-message">
            {error}
          </Flash>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <FormControl required>
            <FormControl.Label htmlFor="email">Email</FormControl.Label>
            <TextInput
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              block
            />
          </FormControl>

          <FormControl required className="login-form-group">
            <FormControl.Label htmlFor="password">Password</FormControl.Label>
            <TextInput
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              block
            />
          </FormControl>

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
