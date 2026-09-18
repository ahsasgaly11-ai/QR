'use client';

import { useEffect, useState } from 'react';
import { Lock, LogIn, Loader2, ShieldCheck, Info, ShieldX } from 'lucide-react';
import {
  isFirebaseConfigured,
  signInAdmin,
  signOutAdmin,
  watchAdmin,
  isOwnerUid,
  type AdminUser,
  DEMO_PASSCODE,
} from '@/lib/auth';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // demo passcode gate
  const [unlocked, setUnlocked] = useState(!DEMO_PASSCODE);
  const [code, setCode] = useState('');

  // هل الحساب المسجَّل هو المالك؟ null = قيد التحقّق
  const [owner, setOwner] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const unsub = watchAdmin((u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        setOwner(null);
        isOwnerUid(u.uid).then(setOwner);
      } else {
        setOwner(null);
      }
    });
    return unsub;
  }, []);

  const input =
    'w-full rounded-xl border border-[color:var(--hairline-strong)] bg-[color:var(--surface)] px-4 py-3 text-sm font-bold outline-none transition focus:border-[color:var(--maroon)] focus:ring-2 focus:ring-[color:var(--maroon)]/20';

  // ---- Firebase real auth ----
  if (isFirebaseConfigured) {
    if (loading) {
      return (
        <div className="grid place-items-center py-24">
          <Loader2 className="h-10 w-10 animate-spin text-[color:var(--maroon)]" />
        </div>
      );
    }
    if (!user) {
      return (
        <LoginCard
          title="دخول المشرفين"
          subtitle="سجّل الدخول بحسابك للوصول إلى لوحة الإدارة."
          onSubmit={async (e) => {
            e.preventDefault();
            setError('');
            setBusy(true);
            try {
              await signInAdmin(email, password);
            } catch {
              setError('تعذّر تسجيل الدخول. تحقّق من البريد وكلمة المرور.');
            } finally {
              setBusy(false);
            }
          }}
          busy={busy}
          error={error}
        >
          <input
            className={input}
            type="email"
            placeholder="البريد الإلكتروني"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            dir="ltr"
          />
          <input
            className={input}
            type="password"
            placeholder="كلمة المرور"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            dir="ltr"
          />
        </LoginCard>
      );
    }
    // مسجّل الدخول — لكن نتحقّق أنه المالك قبل إظهار أي أدوات تحكّم
    if (owner === null) {
      return (
        <div className="grid place-items-center gap-3 py-24">
          <Loader2 className="h-10 w-10 animate-spin text-[color:var(--maroon)]" />
          <p className="text-sm font-bold text-muted-foreground">
            جارٍ التحقّق من الصلاحية…
          </p>
        </div>
      );
    }

    if (owner === false) {
      return (
        <div className="mx-auto max-w-md">
          <div className="card-premium rounded-3xl p-8 text-center">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[color:var(--coral)] text-white shadow-[var(--shadow-md)]">
              <ShieldX className="h-8 w-8" />
            </span>
            <h2 className="mt-4 font-display text-2xl font-bold text-[color:var(--maroon)]">
              غير مصرّح لك بالدخول
            </h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              هذا الحساب{user.email ? ` (${user.email})` : ''} ليس مالك المنصّة،
              ولا يملك صلاحية الرفع أو التعديل. إدارة المحتوى محصورة بحساب
              المالك وحده.
            </p>
            <button
              onClick={() => signOutAdmin()}
              className="btn-ghost btn-sm mt-6 px-6 text-sm"
            >
              تسجيل الخروج
            </button>
          </div>
        </div>
      );
    }

    return (
      <div>
        <AdminBadge email={user.email} />
        {children}
      </div>
    );
  }

  // ---- Demo mode ----
  if (!unlocked) {
    return (
      <LoginCard
        title="لوحة الإدارة (وضع العرض)"
        subtitle="أدخل رمز الدخول للمتابعة."
        onSubmit={(e) => {
          e.preventDefault();
          if (code === DEMO_PASSCODE) setUnlocked(true);
          else setError('رمز غير صحيح.');
        }}
        busy={false}
        error={error}
      >
        <input
          className={input}
          type="password"
          placeholder="رمز الدخول"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </LoginCard>
    );
  }
  return (
    <div>
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-[color:var(--sky)]/30 bg-[color:var(--sky)]/10 p-4 text-sm">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--sky)]" />
        <p>
          <b>وضع العرض:</b> لم يُفعّل Firebase، لذا لا تُحفظ التغييرات فعليًا —
          تُعرض التعليمات وكائنات البيانات الجاهزة فقط. بعد إعداد Firebase تُصبح
          الإدارة كاملة الصلاحيات مع تسجيل دخول حقيقي للمشرفين.
        </p>
      </div>
      {children}
    </div>
  );
}

function AdminBadge({ email }: { email: string | null }) {
  return (
    <div className="mb-6 flex items-center gap-2 rounded-2xl border border-[color:var(--teal)]/30 bg-[color:var(--teal)]/10 px-4 py-3 text-sm font-bold text-[color:var(--teal)]">
      <ShieldCheck className="h-5 w-5" />
      مسجّل الدخول كمشرف{email ? ` — ${email}` : ''}
    </div>
  );
}

function LoginCard({
  title,
  subtitle,
  onSubmit,
  busy,
  error,
  children,
}: {
  title: string;
  subtitle: string;
  onSubmit: (e: React.FormEvent) => void;
  busy: boolean;
  error: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-md">
      <form
        onSubmit={onSubmit}
        className="card-premium rounded-3xl p-8 text-center"
      >
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[color:var(--maroon)] text-white shadow-[var(--shadow-md)]">
          <Lock className="h-8 w-8" />
        </span>
        <h2 className="mt-4 font-display text-2xl font-bold text-[color:var(--maroon)]">
          {title}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
        <div className="mt-6 space-y-3 text-right">{children}</div>
        {error && (
          <p className="mt-4 rounded-xl bg-[color:var(--coral)]/15 px-4 py-2.5 text-sm font-bold text-[color:var(--coral)]">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className="btn-primary mt-6 w-full justify-center py-3">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
          دخول
        </button>
      </form>
    </div>
  );
}
