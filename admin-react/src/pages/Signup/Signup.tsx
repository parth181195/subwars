import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, FormControl, TextInput, Flash } from '@primer/react';
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
          <Flash variant="danger" sx={{ mb: 3 }}>
            {error}
          </Flash>
        )}

        {success && (
          <Flash variant="success" sx={{ mb: 3 }}>
            {success}
          </Flash>
        )}

        <form onSubmit={handleSubmit} className="signup-form">
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

          <FormControl required sx={{ mt: 3 }}>
            <FormControl.Label htmlFor="password">Password</FormControl.Label>
            <TextInput
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password (min 6 characters)"
              required
              minLength={6}
              block
            />
          </FormControl>

          <FormControl required sx={{ mt: 3 }}>
            <FormControl.Label htmlFor="confirmPassword">Confirm Password</FormControl.Label>
            <TextInput
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
              block
            />
          </FormControl>

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

