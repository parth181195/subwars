import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { quizAuthService, type AuthUser } from '../../services/auth';
import { environment } from '../../config/environment';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import './AppLoader.scss';

interface AppLoaderProps {
  children: React.ReactNode;
}

export default function AppLoader({ children }: AppLoaderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | undefined;

    // Wait for auth initialization before setting up listener
    // This ensures we know the auth state before rendering routes
    quizAuthService.waitForInit().then(() => {
      if (isMounted) {
        // Now subscribe - the listener will be called immediately with current state
        unsubscribe = quizAuthService.subscribe((authUser) => {
          if (isMounted) {
            setUser(authUser);
            setIsInitialized(true);
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

  // Handle redirects based on auth state and route - ONLY after initialization is complete
  useEffect(() => {
    // Wait for initialization to complete before any redirects
    if (!isInitialized) return;

    const pathname = location.pathname;
    const isProtectedRoute =
      pathname === '/quiz' ||
      pathname === '/quiz-info' ||
      pathname === '/profile';

    // If quiz feature is disabled, redirect quiz routes to home
    if (!environment.showQuiz && isProtectedRoute) {
      navigate('/', { replace: true });
      return;
    }

    // If user is not authenticated and trying to access protected route
    // This should be handled by ProtectedRoute component, but as a fallback:
    if (!user && isProtectedRoute && environment.showQuiz) {
      // ProtectedRoute will handle the redirect, so we don't need to do anything here
      return;
    }

    // If user is authenticated and on login page, redirect to home or intended destination
    if (user && pathname === '/login') {
      const searchParams = new URLSearchParams(location.search);
      const redirectTo = searchParams.get('redirect');

      if (redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//')) {
        try {
          const decoded = decodeURIComponent(redirectTo);
          // Prevent redirect loops - don't redirect to login if already on login
          if (decoded !== '/login') {
            navigate(decoded, { replace: true });
          } else {
            navigate('/', { replace: true });
          }
        } catch (error) {
          // Invalid redirect URL, go to home
          navigate('/', { replace: true });
        }
      } else {
        // Check if there's a saved route in location state (from ProtectedRoute)
        const locationState = location.state as { from?: { pathname: string; search?: string } } | null;
        const from = locationState?.from?.pathname;
        if (from) {
          const fromSearch = locationState?.from?.search || '';
          navigate(from + fromSearch, { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      }
      return;
    }
  }, [isInitialized, user, location, navigate]);

  // Show full-page loading screen during initialization
  // Only render app content after initialization is complete
  // Redirects will happen immediately after initialization, so loading screen prevents flash
  if (!isInitialized) {
    return (
      <div className="app-loader">
        <div className="app-loader-content">
          <LoadingSpinner
            message="Initializing..."
            size="large"
          />
        </div>
      </div>
    );
  }

  // App is initialized, render children
  return <>{children}</>;
}

