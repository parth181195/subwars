import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { analyticsService } from '../../services/analytics';

/**
 * Component to track page views when the route changes
 */
export default function Analytics() {
  const location = useLocation();

  useEffect(() => {
    // Small delay to ensure analytics is fully initialized
    const timer = setTimeout(() => {
      const path = location.pathname + location.search;
      analyticsService.trackPageView(path);
      console.log('[Analytics] Page view tracked:', path);
    }, 100);

    return () => clearTimeout(timer);
  }, [location]);

  return null;
}

