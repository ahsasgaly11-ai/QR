// ---------------------------------------------------------------------------
// Firebase bootstrap — fully optional / graceful.
//
// The platform works out-of-the-box in "demo mode" (bundled seed content +
// localStorage stats). When the NEXT_PUBLIC_FIREBASE_* env vars are present,
// Firestore + Storage light up automatically for uploaded activities and
// shared live counters (visitors / views / downloads).
// ---------------------------------------------------------------------------

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
);

let app: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;
let storageInstance: FirebaseStorage | null = null;

function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured) return null;
  if (app) return app;
  try {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    return app;
  } catch {
    return null;
  }
}

export function getDb(): Firestore | null {
  if (dbInstance) return dbInstance;
  const a = getFirebaseApp();
  if (!a) return null;
  try {
    dbInstance = getFirestore(a);
    return dbInstance;
  } catch {
    return null;
  }
}

export function getBucket(): FirebaseStorage | null {
  if (storageInstance) return storageInstance;
  const a = getFirebaseApp();
  if (!a) return null;
  try {
    storageInstance = getStorage(a);
    return storageInstance;
  } catch {
    return null;
  }
}
