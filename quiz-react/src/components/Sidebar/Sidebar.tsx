import { Link, useLocation, useNavigate } from 'react-router-dom';
import { XIcon, SignOutIcon, PersonIcon } from '@primer/octicons-react';
import { quizAuthService, type AuthUser } from '../../services/auth';
import { environment } from '../../config/environment';
import './Sidebar.scss';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  user: AuthUser | null;
}

export default function Sidebar({ isOpen, onClose, user }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await quizAuthService.signOut();
      onClose();
      navigate('/');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const navLinks: Array<{ path: string; label: string }> = [
    { path: '/leaderboard', label: 'Leaderboard' },
  ];

  // Add Quiz link if user is logged in and quiz is enabled
  if (user && environment.showQuiz) {
    navLinks.push({ path: '/quiz-info', label: 'GUESS THE HERO Contest' });
  }

  if (!isOpen) return null;

  return (
    <>
      <div className="sidebar-overlay" onClick={onClose}></div>
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2 className="sidebar-title">Menu</h2>
          <button className="sidebar-close" onClick={onClose} aria-label="Close menu">
            <XIcon size={24} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`sidebar-link ${location.pathname === link.path ? 'active' : ''}`}
              onClick={onClose}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {user && environment.showQuiz && (
          <Link
            to="/profile"
            className={`sidebar-link sidebar-profile ${location.pathname === '/profile' ? 'active' : ''}`}
            onClick={onClose}
          >
            <PersonIcon size={20} />
            <span>{user.full_name || user.email || 'Profile'}</span>
          </Link>
        )}

        <div className="sidebar-footer">
          {user ? (
            <button onClick={handleSignOut} className="sidebar-logout">
              <SignOutIcon size={20} />
              <span>Logout</span>
            </button>
          ) : (
            <Link to="/login" className="sidebar-login" onClick={onClose}>
              <span>Login</span>
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}

