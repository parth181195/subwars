import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  HomeIcon, 
  GearIcon, 
  SignOutIcon,
  ThreeBarsIcon,
  FileIcon
} from '@primer/octicons-react';
import { adminAuthService } from '../../services/auth';
import './DashboardLayout.scss';

interface DashboardLayoutProps {
  children: ReactNode;
}

interface NavItem {
  label: string;
  icon: ReactNode;
  route: string;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(adminAuthService.user);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const unsubscribe = adminAuthService.subscribe((currentUser) => {
      setUser(currentUser);
    });
    return unsubscribe;
  }, []);

  const navItems: NavItem[] = [
    { label: 'Dashboard', icon: <HomeIcon size={20} />, route: '/dashboard' },
    { label: 'Quizzes', icon: <FileIcon size={20} />, route: '/quizzes' },
    { label: 'Settings', icon: <GearIcon size={20} />, route: '/settings' },
  ];

  const handleLogout = async () => {
    try {
      await adminAuthService.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className={`dashboard-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          {sidebarOpen && <h2 className="sidebar-logo">SUB WARS V Admin</h2>}
          {!sidebarOpen && (
            <div className="sidebar-logo-icon">
              <HomeIcon size={24} />
            </div>
          )}
        </div>
        
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            let isActive = false;
            if (item.route === '/dashboard') {
              isActive = location.pathname === item.route || location.pathname === '/';
            } else if (item.route === '/quizzes') {
              isActive = location.pathname.startsWith('/quizzes');
            } else {
              isActive = location.pathname === item.route;
            }
            
            return (
              <button
                key={item.route}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => navigate(item.route)}
              >
                <span className="nav-icon">{item.icon}</span>
                {sidebarOpen && <span className="nav-label">{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="dashboard-main">
        {/* Toolbar */}
        <header className="dashboard-toolbar">
          <button className="sidebar-toggle" onClick={toggleSidebar}>
            <ThreeBarsIcon size={20} />
          </button>
          
          <div className="toolbar-spacer"></div>
          
          {user?.email && (
            <span className="toolbar-email">{user.email}</span>
          )}
          
          <button className="logout-button" onClick={handleLogout}>
            <SignOutIcon size={16} />
            <span>Logout</span>
          </button>
        </header>

        {/* Page Content */}
        <main className="dashboard-content">
          {children}
        </main>
      </div>
    </div>
  );
}

