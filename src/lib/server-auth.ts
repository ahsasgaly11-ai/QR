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

/** يستخرج رمز الدخول من ترويسة Authorization: Bearer … */
export function bearerToken(req: Request): string {
  const h = req.headers.get('authorization') ?? '';
  return h.toLowerCase().startsWith('bearer ') ? h.slice(7).trim() : '';
}
