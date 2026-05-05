// Development environment configuration
import { environment as prodEnvironment } from './environment.prod';

const devEnvironment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  apiBaseUrl: 'http://localhost:3000',
  wsUrl: 'http://localhost:3000',
  supabase: {
    url: 'https://tfgcmmbrtzntuicfgsau.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmZ2NtbWJydHpudHVpY2Znc2F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NDkzNDgsImV4cCI6MjA3OTEyNTM0OH0.LO-27_OvSgCh8qZrM3V7_fZTnDWBIP8Zu_tNsq60LvU',
  },
  firebase: {
    apiKey: 'AIzaSyBb1W7h11AK4WbxvOR1t8x3PDaIv18BLvk',
    authDomain: 'notes-f8d03.firebaseapp.com',
    projectId: 'notes-f8d03',
    storageBucket: 'notes-f8d03.firebasestorage.app',
    messagingSenderId: '940075348159',
    appId: '1:940075348159:web:c136a8d4a756a2e778d60a',
  },
  allowedAdminEmails: [
    'parthjansari@outlook.com',
    'parthrock181195@gmail.com'
  ]
};

// Automatically use production environment in production builds
export const environment = import.meta.env.PROD ? prodEnvironment : devEnvironment;
