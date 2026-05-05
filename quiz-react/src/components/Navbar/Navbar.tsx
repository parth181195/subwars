import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { SignOutIcon, SignInIcon, PersonIcon, ThreeBarsIcon } from '@primer/octicons-react';
import pasoLLLogo from '../../assets/PasoLL_Logo.png';
import { quizAuthService } from '../../services/auth';
import { webSocketService } from '../../services/websocket';
import { environment } from '../../config/environment';
import Sidebar from '../Sidebar/Sidebar';
import type { AuthUser } from '../../services/auth';
import './Navbar.scss';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(quizAuthService.user);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(webSocketService.connected);

  useEffect(() => {
    const unsubscribe = quizAuthService.subscribe((currentUser) => {
      setUser(currentUser);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    // Subscribe to WebSocket connection status
    const unsubscribeConnected = webSocketService.on('connected', () => {
      setIsConnected(true);
    });
    const unsubscribeDisconnected = webSocketService.on('disconnected', () => {
      setIsConnected(false);
    });

    return () => {
      unsubscribeConnected();
      unsubscribeDisconnected();
    };
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
    { path: '/leaderboard', label: 'Leaderboard' },
    // Hidden for now
    // { path: '/', label: 'Home' },
  ];

  // Add Quiz link if user is logged in and quiz is enabled
  if (user && environment.showQuiz) {
    navLinks.push({ path: '/quiz-info', label: 'GUESS THE HERO' });
  }

  return (
    <>
      <nav className="navbar">
        <div className="navbar-container">
          {/* Mobile Menu Button */}
          <button
            className="navbar-menu-button"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Open menu"
          >
            <ThreeBarsIcon size={20} />
          </button>

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
            {/* WebSocket Connection Indicator */}
            {user && (
              <div className={`websocket-indicator ${isConnected ? 'connected' : ''}`} title={isConnected ? 'Connected' : 'Disconnected'}>
                <div className={`connection-dot ${isConnected ? 'connected' : 'disconnected'}`}></div>
                <span className="connection-status">{isConnected ? 'Live' : 'Offline'}</span>
              </div>
            )}

            {user ? (
              <>
                {environment.showQuiz && (
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
                )}
                <button onClick={handleSignOut} className="logout-button">
                  <SignOutIcon size={16} />
                  <span>Logout</span>
                </button>
              </>
            ) : (
              <Link to="/login" className="login-button">
                <SignInIcon size={16} />
                <span>Login</span>
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        user={user}
      />
    </>
  );
}

