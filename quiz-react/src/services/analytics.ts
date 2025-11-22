declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

class AnalyticsService {
  private measurementId: string | null = null;
  private isInitialized = false;

  /**
   * Initialize Google Analytics
   * @param measurementId - Google Analytics Measurement ID (G-XXXXXXXXXX)
   */
  initialize(measurementId: string) {
    if (this.isInitialized || !measurementId) {
      console.warn('[Analytics] Already initialized or missing measurement ID', { isInitialized: this.isInitialized, measurementId });
      return;
    }

    // Check if gtag is already loaded from HTML (in index.html)
    if (window.gtag && window.dataLayer) {
      this.measurementId = measurementId;
      this.isInitialized = true;
      console.log('[Analytics] Google Analytics already loaded from HTML, initialized service', measurementId);
      
      // Track initial page view
      this.trackPageView();
      return;
    }

    this.measurementId = measurementId;

    // Initialize dataLayer first (must be before loading script)
    window.dataLayer = window.dataLayer || [];
    
    // Define gtag function immediately (Google's standard pattern)
    function gtag(...args: any[]) {
      if (window.dataLayer) {
        window.dataLayer.push(args);
      }
    }
    window.gtag = gtag;

    // Initialize gtag with config (this queues the config while script loads)
    window.gtag('js', new Date());
    window.gtag('config', measurementId, {
      page_path: window.location.pathname,
      send_page_view: true,
    });

    // Add Google Tag Manager script (gtag.js) - async
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    
    // Optional: Log when script loads for debugging
    script.onload = () => {
      console.log('[Analytics] Google Analytics script loaded', measurementId);
      // Track initial page view after script loads
      this.trackPageView();
    };
    
    script.onerror = () => {
      console.error('[Analytics] Failed to load Google Analytics script', measurementId);
    };
    
    document.head.appendChild(script);

    this.isInitialized = true;
    console.log('[Analytics] Initialized Google Analytics', measurementId);
  }

  /**
   * Track a page view
   * @param path - The page path (optional, defaults to current path)
   * @param title - The page title (optional)
   */
  trackPageView(path?: string, title?: string) {
    if (!this.isInitialized || !window.gtag || !this.measurementId) {
      return;
    }

    window.gtag('config', this.measurementId, {
      page_path: path || window.location.pathname,
      page_title: title || document.title,
    });
  }

  /**
   * Track an event
   * @param eventName - The event name
   * @param eventParams - Optional event parameters
   */
  trackEvent(eventName: string, eventParams?: Record<string, any>) {
    if (!this.isInitialized || !window.gtag) {
      return;
    }

    window.gtag('event', eventName, eventParams);
  }

  /**
   * Track button clicks
   */
  trackButtonClick(buttonName: string, location?: string) {
    this.trackEvent('button_click', {
      button_name: buttonName,
      location: location || window.location.pathname,
    });
  }

  /**
   * Track link clicks
   */
  trackLinkClick(linkUrl: string, linkText?: string) {
    this.trackEvent('link_click', {
      link_url: linkUrl,
      link_text: linkText,
      location: window.location.pathname,
    });
  }

  /**
   * Track user actions (login, registration, etc.)
   */
  trackUserAction(action: string, details?: Record<string, any>) {
    this.trackEvent('user_action', {
      action,
      ...details,
      location: window.location.pathname,
    });
  }
}

export const analyticsService = new AnalyticsService();

