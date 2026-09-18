import { getDb, getBucket, isFirebaseConfigured } from '@/lib/firebase';
import { initializeApp, getApps, getApp } from 'firebase/app';

// ---------------------------------------------------------------------------
// Admin authentication.
//   • Firebase configured  → real email/password auth (Firebase Auth).
//   • Not configured       → "demo" mode; a local passcode gate can be set via
//                            NEXT_PUBLIC_ADMIN_PASSCODE, else open with banner.
// Production: restrict admin writes to allow-listed UIDs / custom claims.
// ---------------------------------------------------------------------------

export const DEMO_PASSCODE = process.env.NEXT_PUBLIC_ADMIN_PASSCODE ?? '';

export interface AdminUser {
  email: string | null;
  uid: string;
}

function firebaseApp() {
  const cfg = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  return getApps().length ? getApp() : initializeApp(cfg);
}

export async function signInAdmin(
  email: string,
  password: string
): Promise<AdminUser> {
  if (!isFirebaseConfigured) throw new Error('Firebase غير مُعدّ.');
  const { getAuth, signInWithEmailAndPassword } = await import('firebase/auth');
  const auth = getAuth(firebaseApp());
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return { email: cred.user.email, uid: cred.user.uid };
}

export async function signOutAdmin(): Promise<void> {
  if (!isFirebaseConfigured) return;
  const { getAuth, signOut } = await import('firebase/auth');
  await signOut(getAuth(firebaseApp()));
}

/**
 * يتحقّق أنّ الحساب المسجَّل هو المالك فعلًا، بقراءة الوثيقة admins/{uid}
 * من Firestore. هذه الوثيقة تُنشأ من Firebase Console فقط، ولا يمكن لأحد
 * إنشاؤها من الموقع (قواعد الأمان تمنع الكتابة عليها تمامًا) — لذا لا
 * يستطيع أي مستخدم ترقية نفسه إلى مشرف.
 *
 * ملاحظة: هذا تحقّق للواجهة فقط؛ الحماية الحقيقية في قواعد Firestore
 * وStorage التي ترفض أي كتابة من غير المالك.
 */
export async function isOwnerUid(uid: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    const { doc, getDoc } = await import('firebase/firestore');
    const snap = await getDoc(doc(db, 'admins', uid));
    return snap.exists();
  } catch {
    return false;
  }
}

export function watchAdmin(cb: (u: AdminUser | null) => void): () => void {
  if (!isFirebaseConfigured) {
    cb(null);
    return () => {};
  }
  let unsub = () => {};
  import('firebase/auth').then(({ getAuth, onAuthStateChanged }) => {
    const auth = getAuth(firebaseApp());
    unsub = onAuthStateChanged(auth, (user) => {
      cb(user ? { email: user.email, uid: user.uid } : null);
    });
  });
  return () => unsub();
}

// re-exports used by managers
export { getDb, getBucket, isFirebaseConfigured };
