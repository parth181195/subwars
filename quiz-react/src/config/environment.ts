export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  supabase: {
    url: 'https://tfgcmmbrtzntuicfgsau.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmZ2NtbWJydHpudHVpY2Znc2F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NDkzNDgsImV4cCI6MjA3OTEyNTM0OH0.LO-27_OvSgCh8qZrM3V7_fZTnDWBIP8Zu_tNsq60LvU',
  },
  googleAnalytics: {
    measurementId: import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-VDCGN0XGWE',
  },
};

