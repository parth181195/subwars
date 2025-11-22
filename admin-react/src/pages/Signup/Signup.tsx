import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@primer/react';
import { PersonAddIcon } from '@primer/octicons-react';
import { adminAuthService } from '../../services/auth';
import { environment } from '../../config/environment';
import './Signup.scss';

export default function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setError('Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!environment.allowedAdminEmails.includes(email)) {
      setError('This email is not authorized for admin access. Please contact an administrator.');
      return;
    }

    setLoading(true);

    try {
      await adminAuthService.signUp(email, password);
      setSuccess('Account created successfully! Please check your email to confirm your account, then sign in.');
      
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setError(error.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-container">
      <div className="signup-card">
        <div className="signup-header">
          <div className="signup-icon-wrapper">
            <PersonAddIcon size={48} className="signup-icon" />
          </div>
          <h1 className="signup-title">Admin Sign Up</h1>
          <p className="signup-subtitle">Create an admin account</p>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {success && (
          <div className="success-message">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="signup-form">
          <div className="signup-form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              className="signup-input"
            />
          </div>

          <div className="signup-form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password (min 6 characters)"
              required
              minLength={6}
              className="signup-input"
            />
          </div>

          <div className="signup-form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
              className="signup-input"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={loading || !email || !password || !confirmPassword}
            className="signup-button"
            block
          >
            {loading ? 'Creating Account...' : 'Sign Up'}
          </Button>
        </form>

        <div className="login-link">
          <p>
            Already have an account?{' '}
            <a
              href="/login"
              onClick={(e) => {
                e.preventDefault();
                navigate('/login');
              }}
              className="signup-link"
            >
              Sign in here
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

