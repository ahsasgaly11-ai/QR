// ---------------------------------------------------------------------------
// التحقّق من هوية المالك على الخادم.
//
// يتحقّق من صحة رمز الدخول (ID token) عبر Google Identity Toolkit ثم يقارن
// المعرّف الناتج بـ ADMIN_UID (متغيّر خادم بلا NEXT_PUBLIC_).
// إن لم يُضبط ADMIN_UID يُرفض الطلب (fail-closed) — لا يُفتح الباب بالخطأ.
// ---------------------------------------------------------------------------

export async function verifyOwnerToken(idToken: string): Promise<boolean> {
  const adminUid = process.env.ADMIN_UID;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!adminUid || !apiKey || !idToken) return false;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!res.ok) return false;
    const data = (await res.json()) as { users?: { localId?: string }[] };
    return data.users?.[0]?.localId === adminUid;
  } catch {
    return false;
  }
}

/**
 * يتحقّق أن صاحب الرمز المالكُ أو مشرف مضاف (editors/{uid}) — لإعادة توليد
 * الصفحات بعد تعديل يملك صاحبه صلاحيته أصلًا. وثيقة المشرف تُقرأ برمزه نفسه،
 * فقواعد Firestore هي التي تقرّر (يقرأ كل مشرف وثيقته فقط).
 */
export async function verifyStaffToken(idToken: string): Promise<boolean> {
  if (await verifyOwnerToken(idToken)) return true;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!apiKey || !projectId || !idToken) return false;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!res.ok) return false;
    const data = (await res.json()) as { users?: { localId?: string }[] };
    const uid = data.users?.[0]?.localId;
    if (!uid || !/^[A-Za-z0-9]+$/.test(uid)) return false;
    const doc = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/editors/${uid}`,
      { headers: { Authorization: `Bearer ${idToken}` } }
    );
    if (!doc.ok) return false;
    const role = ((await doc.json()) as { fields?: { role?: { stringValue?: string } } }).fields?.role
      ?.stringValue;
    return role === 'texts' || role === 'uploader';
  } catch {
    return false;
  }
}

/** يستخرج رمز الدخول من ترويسة Authorization: Bearer … */
export function bearerToken(req: Request): string {
  const h = req.headers.get('authorization') ?? '';
  return h.toLowerCase().startsWith('bearer ') ? h.slice(7).trim() : '';
}
