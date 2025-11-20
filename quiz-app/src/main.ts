import { platformBrowser } from '@angular/platform-browser';
import { AppModule } from './app/app-module';

// Global error handler to suppress Navigator Lock Manager errors
if (typeof window !== 'undefined') {
  // Catch unhandled promise rejections (where NavigatorLockAcquireTimeoutError often appears)
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason as any;
    if (error?.name === 'NavigatorLockAcquireTimeoutError' || 
        error?.message?.includes('NavigatorLockAcquireTimeoutError') ||
        error?.message?.includes('lock:sb-') ||
        error?.stack?.includes('NavigatorLockAcquireTimeoutError')) {
      // Suppress Navigator Lock errors - they're non-critical
      event.preventDefault();
      event.stopPropagation();
    }
  });

  // Catch errors in the console as well
  const originalError = console.error;
  console.error = (...args: any[]) => {
    const errorStr = args.join(' ');
    if (errorStr.includes('NavigatorLockAcquireTimeoutError') || 
        errorStr.includes('lock:sb-')) {
      // Suppress Navigator Lock errors from console
      return;
    }
    originalError.apply(console, args);
  };
}

platformBrowser()
  .bootstrapModule(AppModule, {
    ngZoneEventCoalescing: true,
  })
  .catch((err) => {
    // Suppress Navigator Lock errors during bootstrap
    if (err?.name === 'NavigatorLockAcquireTimeoutError' || 
        err?.message?.includes('NavigatorLockAcquireTimeoutError')) {
      return; // Silently ignore
    }
    console.error(err);
  });
