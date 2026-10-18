'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { isFirebaseConfigured } from '@/lib/firebase';
import {
  ROLE_HINTS,
  ROLE_LABELS,
  listEditors,
  removeEditor,
  saveEditor,
  type Editor,
  type EditorRole,
} from '@/lib/roles';
import { cn } from '@/lib/utils';
import { iconBtn, inp } from './studio-draft';

/**
 * المالك يضيف مشرفين بصلاحيات محدودة: محرّر نصوص أو رافع أنشطة.
 * يحصل المشرف على معرّف حسابه (UID) من شاشة «غير مصرّح» عند أول دخول.
 */
export function RolesManager() {
  const [editors, setEditors] = useState<Editor[] | null>(null);
  const [uid, setUid] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<EditorRole>('texts');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () =>
    listEditors()
      .then(setEditors)
      .catch(() => {
        setError('تعذّر تحميل قائمة المشرفين. تأكّد من نشر قواعد Firestore المحدّثة.');
        setEditors([]);
      });

  useEffect(() => {
    void load();
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      await load();
    } catch (e) {
      const code = (e as { code?: string })?.code;
      setError(
        code === 'permission-denied'
          ? 'رُفض الحفظ: انشر قواعد Firestore المحدّثة (firestore.rules) أولًا.'
          : (e as Error)?.message || 'تعذّر الحفظ.'
      );
    } finally {
      setBusy(false);
    }
  };

  if (!isFirebaseConfigured) {
    return (
      <p className="rounded-xl bg-[color:var(--gold)]/15 px-4 py-3 text-sm font-bold text-[color:var(--gold)]">
        إدارة المشرفين تتطلّب تفعيل Firebase (تسجيل دخول حقيقي).
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(ROLE_HINTS) as EditorRole[]).map((r) => (
          <div key={r} className="rounded-2xl border border-[color:var(--hairline)] bg-[color:var(--surface-2)]/50 p-4">
            <p className="flex items-center gap-2 font-display font-semibold">
              <ShieldCheck className="h-4 w-4 text-[color:var(--maroon)]" /> {ROLE_LABELS[r]}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{ROLE_HINTS[r]}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-[color:var(--hairline)] p-4">
        <p className="mb-3 flex items-center gap-2 font-display font-semibold">
          <UserPlus className="h-5 w-5" /> إضافة مشرف
        </p>
        <ol className="mb-4 list-decimal space-y-1 pr-5 text-sm text-muted-foreground">
          <li>أنشئ للمشرف حسابًا (بريد وكلمة مرور) من Firebase Console ← Authentication، أو أرسل له رابط اللوحة ليسجّل.</li>
          <li>يدخل المشرف إلى لوحة الإدارة فتظهر له شاشة «غير مصرّح» وفيها معرّف حسابه — ينسخه ويرسله لك.</li>
          <li>الصق المعرّف هنا واختر صلاحيته، فيدخل فورًا بها.</li>
        </ol>
        <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_12rem_auto]">
          <input
            className={inp + ' font-mono'}
            dir="ltr"
            placeholder="UID معرّف الحساب"
            value={uid}
            onChange={(e) => setUid(e.target.value.trim())}
          />
          <input
            className={inp}
            placeholder="الاسم (يظهر في سجل التعديلات)"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
          />
          <select className={inp} value={role} onChange={(e) => setRole(e.target.value as EditorRole)}>
            {(Object.keys(ROLE_HINTS) as EditorRole[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <button
            className="btn-primary btn-sm px-4 py-2 text-sm"
            disabled={busy || !/^[A-Za-z0-9]{20,128}$/.test(uid) || !name.trim()}
            onClick={() =>
              run(async () => {
                await saveEditor({ uid, name, role, addedAt: Date.now() });
                setUid('');
                setName('');
              })
            }
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} إضافة
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-[color:var(--coral)]/15 px-4 py-2.5 text-sm font-bold text-[color:var(--coral)]">
          {error}
        </p>
      )}

      {!editors ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> جارٍ التحميل…
        </div>
      ) : editors.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[color:var(--hairline-strong)] px-4 py-6 text-center text-sm text-muted-foreground">
          لا يوجد مشرفون إضافيون — أنت المالك الوحيد.
        </p>
      ) : (
        <ul className="space-y-2">
          {editors.map((e) => (
            <li
              key={e.uid}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-[color:var(--hairline)] bg-[color:var(--surface)] p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{e.name || '—'}</p>
                <p className="truncate font-mono text-xs text-muted-foreground" dir="ltr">
                  {e.uid}
                </p>
              </div>
              <select
                className={cn(inp, 'w-auto py-1.5')}
                value={e.role}
                disabled={busy}
                onChange={(ev) => run(() => saveEditor({ ...e, role: ev.target.value as EditorRole }))}
                aria-label={`صلاحية ${e.name}`}
              >
                {(Object.keys(ROLE_HINTS) as EditorRole[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
              <button
                className={iconBtn + ' bg-[color:var(--coral)]/15 text-[color:var(--coral)]'}
                disabled={busy}
                onClick={() => {
                  if (confirm(`إزالة صلاحية ${e.name || 'هذا المشرف'}؟`)) void run(() => removeEditor(e.uid));
                }}
                title="إزالة الصلاحية"
                aria-label={`إزالة ${e.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
