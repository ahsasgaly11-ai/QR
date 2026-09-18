'use client';

import { useState } from 'react';
import { Pencil, Trash2, X, Check, Loader2, Lock, Eye, Download } from 'lucide-react';
import type { Activity, ActivityType } from '@/lib/types';
import { ACTIVITY_META } from '@/lib/types';
import { updateActivity, deleteActivity } from '@/lib/content';
import { revalidateContent } from '@/lib/revalidate';
import { isFirebaseConfigured } from '@/lib/firebase';
import { ActivityTypeBadge } from '@/components/activity-type-badge';

const TYPES = Object.keys(ACTIVITY_META) as ActivityType[];

export function ActivitiesManager({
  activities: initial,
  uploadedIds,
  labels,
}: {
  activities: Activity[];
  uploadedIds: string[];
  labels: Record<string, string>;
}) {
  const [rows, setRows] = useState<Activity[]>(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Activity>>({});
  const [busy, setBusy] = useState(false);
  const uploaded = new Set(uploadedIds);

  const inp =
    'w-full rounded-lg border border-[color:var(--hairline-strong)] bg-[color:var(--surface)] px-3 py-2 text-sm font-bold outline-none focus:border-[color:var(--maroon)]';

  async function save(id: string) {
    setBusy(true);
    try {
      if (isFirebaseConfigured) {
        await updateActivity(id, draft);
        const subjectId = rows.find((a) => a.id === id)?.subjectId;
        await revalidateContent({ subjectId, activityId: id });
      }
      setRows((r) => r.map((a) => (a.id === id ? { ...a, ...draft } : a)));
      setEditing(null);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('هل تريد حذف هذا النشاط نهائيًا؟')) return;
    setBusy(true);
    try {
      if (isFirebaseConfigured) {
        const subjectId = rows.find((a) => a.id === id)?.subjectId;
        await deleteActivity(id);
        await revalidateContent({ subjectId, activityId: id });
      }
      setRows((r) => r.filter((a) => a.id !== id));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        الأنشطة المضمّنة (seed) للعرض فقط؛ الأنشطة المرفوعة عبر المنصّة يمكن
        تعديلها أو حذفها.
      </p>
      {rows.map((a) => {
        const isUp = uploaded.has(a.id);
        const isEditing = editing === a.id;
        return (
          <div key={a.id} className="card-premium rounded-2xl p-4">
            {isEditing ? (
              <div className="space-y-3">
                <input
                  className={inp}
                  value={draft.title ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                  placeholder="العنوان"
                />
                <textarea
                  className={inp}
                  rows={2}
                  value={draft.description ?? ''}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, description: e.target.value }))
                  }
                  placeholder="الوصف"
                />
                <div className="flex flex-wrap gap-2">
                  {TYPES.map((t) => (
                    <button
                      key={t}
                      onClick={() => setDraft((d) => ({ ...d, type: t }))}
                      className="rounded-lg px-3 py-1.5 text-xs font-bold transition"
                      style={
                        (draft.type ?? a.type) === t
                          ? { background: ACTIVITY_META[t].color, color: '#fff' }
                          : { background: 'var(--surface-2)' }
                      }
                    >
                      {ACTIVITY_META[t].label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => save(a.id)}
                    disabled={busy}
                    className="btn-primary btn-sm px-4 py-2 text-sm"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    حفظ
                  </button>
                  <button onClick={() => setEditing(null)} className="btn-ghost btn-sm px-4 py-2 text-sm">
                    <X className="h-4 w-4" /> إلغاء
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <ActivityTypeBadge type={a.type} />
                    <h4 className="truncate font-display text-base font-bold text-[color:var(--maroon)]">
                      {a.title}
                    </h4>
                    {!isUp && (
                      <span className="pill bg-[color:var(--surface-2)] text-muted-foreground">
                        <Lock className="h-3 w-3" /> مضمّن
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {labels[a.id] ?? ''}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => {
                      setEditing(a.id);
                      setDraft({ title: a.title, description: a.description, type: a.type });
                    }}
                    disabled={!isUp}
                    className="grid h-9 w-9 place-items-center rounded-lg bg-[color:var(--surface-2)] text-[color:var(--maroon)] transition hover:scale-105 disabled:opacity-30"
                    title={isUp ? 'تعديل' : 'المضمّن غير قابل للتعديل'}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => remove(a.id)}
                    disabled={!isUp}
                    className="grid h-9 w-9 place-items-center rounded-lg bg-[color:var(--coral)]/15 text-[color:var(--coral)] transition hover:scale-105 disabled:opacity-30"
                    title={isUp ? 'حذف' : 'المضمّن غير قابل للحذف'}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
