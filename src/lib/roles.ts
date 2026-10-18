// ---------------------------------------------------------------------------
//  صلاحيات المشرفين.
//
//   • owner     المالك: كل شيء. وثيقته admins/{uid} تُنشأ من Firebase Console فقط.
//   • texts     محرّر نصوص: عناوين الأقسام ونصوصها ومظهرها، والتحرير المباشر.
//   • uploader  رافع أنشطة: رفع الأنشطة وتعديلها، بلا حذف ولا إعدادات.
//
//  المحرّرون في editors/{uid}، يضيفهم المالك من لوحة الإدارة بمعرّف حسابهم
//  (UID) الذي يظهر لهم عند أول دخول. الحماية الحقيقية في firestore.rules؛
//  هذا الملف يحدّد ما تعرضه الواجهة فقط.
// ---------------------------------------------------------------------------

import { getDb, isFirebaseConfigured } from '@/lib/firebase';

export type EditorRole = 'texts' | 'uploader';
export type AdminRole = 'owner' | EditorRole;

export const ROLE_LABELS: Record<AdminRole, string> = {
  owner: 'المالك',
  texts: 'محرّر نصوص',
  uploader: 'رافع أنشطة',
};

export const ROLE_HINTS: Record<EditorRole, string> = {
  texts: 'يعدّل عناوين الأقسام ونصوصها وترتيبها وألوانها، ويحرّر النصوص مباشرة من صفحات الموقع.',
  uploader: 'يرفع الأنشطة والألعاب والعروض والمراجعات ويعدّلها، ولا يحذف شيئًا ولا يغيّر الإعدادات.',
};

export interface Editor {
  uid: string;
  name: string;
  role: EditorRole;
  addedAt: number;
}

export interface AdminIdentity {
  role: AdminRole;
  /** الاسم الذي يظهر في سجل التعديلات */
  name: string;
}

/** يحدّد صلاحية الحساب: المالك أولًا، ثم المحرّرون. null = لا صلاحية. */
export async function resolveRole(uid: string): Promise<AdminIdentity | null> {
  const db = getDb();
  if (!db) return null;
  const { doc, getDoc } = await import('firebase/firestore');
  try {
    if ((await getDoc(doc(db, 'admins', uid))).exists()) {
      return { role: 'owner', name: ROLE_LABELS.owner };
    }
  } catch {
    /* ننتقل لفحص المحرّرين */
  }
  try {
    const snap = await getDoc(doc(db, 'editors', uid));
    const d = snap.data() as Partial<Editor> | undefined;
    if (snap.exists() && (d?.role === 'texts' || d?.role === 'uploader')) {
      return { role: d.role, name: d.name || ROLE_LABELS[d.role] };
    }
  } catch {
    /* لا صلاحية */
  }
  return null;
}

/** هوية وضع العرض (بلا Firebase). */
export const DEMO_IDENTITY: AdminIdentity = { role: 'owner', name: 'المشرف' };

export async function listEditors(): Promise<Editor[]> {
  if (!isFirebaseConfigured) return [];
  const db = getDb();
  if (!db) return [];
  const { collection, getDocs } = await import('firebase/firestore');
  const snap = await getDocs(collection(db, 'editors'));
  return snap.docs
    .map((d) => {
      const x = d.data() as Partial<Editor>;
      return {
        uid: d.id,
        name: x.name ?? '',
        role: x.role === 'uploader' ? 'uploader' : 'texts',
        addedAt: x.addedAt ?? 0,
      } as Editor;
    })
    .sort((a, b) => a.addedAt - b.addedAt);
}

export async function saveEditor(e: Editor): Promise<void> {
  const db = getDb();
  if (!db) throw new Error('Firebase غير مُعدّ.');
  const { doc, setDoc } = await import('firebase/firestore');
  await setDoc(doc(db, 'editors', e.uid), {
    name: e.name.trim().slice(0, 60),
    role: e.role,
    addedAt: e.addedAt || Date.now(),
  });
}

export async function removeEditor(uid: string): Promise<void> {
  const db = getDb();
  if (!db) throw new Error('Firebase غير مُعدّ.');
  const { doc, deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(db, 'editors', uid));
}

/** يعلّم المتصفّح بأنه متصفّح مشرف، فيُحمَّل زر التحرير المباشر فيه وحده. */
export const ADMIN_SEEN_KEY = 'qa-admin-seen';
