import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { SignOutIcon, PersonIcon } from '@primer/octicons-react';
import pasoLLLogo from '../../assets/PasoLL_Logo.png';
import { quizAuthService } from '../../services/auth';
import type { AuthUser } from '../../services/auth';
import './Navbar.scss';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(quizAuthService.user);

  useEffect(() => {
    const unsubscribe = quizAuthService.subscribe((currentUser) => {
      setUser(currentUser);
    });
    return unsubscribe;
  }, []);

  const handleSignOut = async () => {
    try {
      await quizAuthService.signOut();
      navigate('/');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const navLinks: Array<{ path: string; label: string }> = [
    { path: '/format', label: 'Format & Rules' },
    { path: '/faq', label: 'FAQ' },
    // Hidden for now
    // { path: '/', label: 'Home' },
    // { path: '/quiz-info', label: 'Quiz Info' },
  ];

  // Hidden for now
  // Add Quiz link if user is logged in
  // if (user) {
  //   navLinks.push({ path: '/quiz', label: 'Quiz' });
  // }

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Logo */}
        <Link to="/" className="navbar-logo">
          <img 
            src={pasoLLLogo} 
            alt="PasoLL Logo" 
            className="navbar-logo-image"
          />
          <span className="logo-text">SUB WARS V</span>
        </Link>

        {/* Navigation Links */}
        <div className="navbar-links">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`navbar-link ${location.pathname === link.path ? 'active' : ''}`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* User Actions */}
        <div className="navbar-actions">
          {user ? (
            <>
              <Link to="/profile" className="profile-button">
                {user.profile_image_url ? (
                  <img
                    src={user.profile_image_url}
                    alt={user.full_name || user.email || 'Profile'}
                    className="profile-avatar"
                  />
                ) : (
                  <PersonIcon size={20} />
                )}
                <span className="profile-name">{user.full_name || user.email}</span>
              </Link>
              <button onClick={handleSignOut} className="logout-button">
                <SignOutIcon size={16} />
                <span>Logout</span>
              </button>
            </>
          ) : (
            // Hidden for now
            // <Link to="/login" className="login-button">
            //   <SignInIcon size={16} />
            //   <span>Login</span>
            // </Link>
            null
          )}
        </div>
      </div>
    </nav>
  );
}

