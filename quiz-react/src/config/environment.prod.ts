export const environment = {
  production: true,
  apiUrl: 'https://api.pasoll.in/api',
  wsUrl: 'https://api.pasoll.in',
  // Legacy Supabase config (for migration period)
  supabase: {
    url: 'https://tfgcmmbrtzntuicfgsau.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmZ2NtbWJydHpudHVpY2Znc2F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NDkzNDgsImV4cCI6MjA3OTEyNTM0OH0.LO-27_OvSgCh8qZrM3V7_fZTnDWBIP8Zu_tNsq60LvU',
  },
  // Firebase configuration
  // TODO: Replace these with your actual Firebase project credentials
  // Get from: Firebase Console → Project Settings → Your apps → Web app
  firebase: {
    apiKey: "AIzaSyBb1W7h11AK4WbxvOR1t8x3PDaIv18BLvk",
    authDomain: "notes-f8d03.firebaseapp.com",
    projectId: "notes-f8d03",
    storageBucket: "notes-f8d03.firebasestorage.app",
    messagingSenderId: "940075348159",
    appId: "1:940075348159:web:c136a8d4a756a2e778d60a",
    measurementId: "G-2E1PEMCPB3"
  },
  googleAnalytics: {
    measurementId: 'G-VDCGN0XGWE',
  },
  // Show quiz features - set to true to enable quiz functionality
  showQuiz: true,
};

