import { initializeApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { environment } from '../config/environment';

// Firebase configuration from environment
const firebaseConfig = environment.firebase;

// Initialize Firebase
let app: ReturnType<typeof initializeApp> | null = null;
let db: Firestore | null = null;

/**
 * Initialize Firebase App
 */
export function initializeFirebase() {
  if (app) {
    return app;
  }

  try {
    app = initializeApp(firebaseConfig);
    console.log('[Firebase] Initialized successfully');
    return app;
  } catch (error) {
    console.error('[Firebase] Initialization error:', error);
    throw error;
  }
}

/**
 * Get Firestore database instance
 * Uses 'subwars-5' database by default
 */
export function getFirestoreDB(): Firestore {
  if (db) {
    return db;
  }

  if (!app) {
    initializeFirebase();
  }

  // Use 'subwars-5' database instead of default
  db = getFirestore(app!, 'subwars-5');
  console.log('[Firestore] Database instance created (subwars-5)');
  return db;
}

/**
 * Initialize Firebase and Firestore
 * Call this once at app startup
 */
export function initFirebaseServices() {
  try {
    initializeFirebase();
    getFirestoreDB();
    console.log('[Firebase] Services initialized successfully');
  } catch (error) {
    console.error('[Firebase] Failed to initialize services:', error);
  }
}

// Export Firestore types
export type { Firestore } from 'firebase/firestore';
export { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, addDoc, Timestamp, onSnapshot } from 'firebase/firestore';
