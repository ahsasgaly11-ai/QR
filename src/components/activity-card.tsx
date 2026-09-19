'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Play, Download, Eye, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react';
import type { Activity, ActivityStats } from '@/lib/types';
import { getActivityStats, trackDownload } from '@/lib/stats';
import { ActivityTypeBadge } from './activity-type-badge';
import { formatNumber, cn } from '@/lib/utils';
import { getLocalRecord, htmlToBlobUrl, dropCachedPreview } from '@/lib/local-store';
import { ActivityPreview } from './activity-preview';

function fileUrl(a: Activity) {
  return a.external ? a.file : `/games/${a.file}`;
}

export function ActivityCard({
  activity,
  index = 0,
  isOwner = false,
  onChanged,
}: {
  activity: Activity;
  index?: number;
  /** أدوات التعديل والحذف تظهر للمالك المسجَّل دخوله وحده */
  isOwner?: boolean;
  onChanged?: (id: string, patch: Partial<Activity> | null) => void;
}) {
  const [stats, setStats] = useState<ActivityStats>({ views: 0, downloads: 0 });
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(activity.title);
  const [busy, setBusy] = useState(false);
  const [gone, setGone] = useState(false);

  const canManage = isOwner && activity.stored === 'firestore';

  async function saveTitle() {
    const next = title.trim();
    if (!next || next === activity.title) return setEditing(false);
    setBusy(true);
    try {
      const { updateActivity } = await import('@/lib/content');
      const { revalidateContent } = await import('@/lib/revalidate');
      await updateActivity(activity.id, { title: next });
      await revalidateContent({ subjectId: activity.subjectId, activityId: activity.id });
      onChanged?.(activity.id, { title: next });
      setEditing(false);
    } catch {
      setTitle(activity.title);
    } finally {
      setBusy(false);
    }
  }

  async function removeActivity() {
    if (!confirm(`حذف «${activity.title}» نهائيًا؟ لا يمكن التراجع.`)) return;
    setBusy(true);
    try {
      const { deleteActivity } = await import('@/lib/content');
      const { revalidateContent } = await import('@/lib/revalidate');
      await deleteActivity(activity.id);
      await dropCachedPreview(activity.id);
      await revalidateContent({ subjectId: activity.subjectId, activityId: activity.id });
      onChanged?.(activity.id, null);
      setGone(true);
    } catch {
      alert('تعذّر الحذف. تحقّق من اتصالك ثم أعد المحاولة.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    let active = true;
    getActivityStats(activity.id).then((s) => active && setStats(s));
    return () => {
      active = false;
    };
  }, [activity.id]);

  const saveHtml = (html: string) => {
    const url = htmlToBlobUrl(html);
    const a = document.createElement('a');
    a.href = url;
    a.download = activity.file || 'activity.html';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const onDownload = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    // الأنشطة المحفوظة محليًا (وضع العرض) تُنزَّل من مخزن المتصفّح
    if (activity.local) {
      e.preventDefault();
      const rec = await getLocalRecord(activity.id);
      if (rec?.html) saveHtml(rec.html);
    } else if (activity.stored === 'firestore') {
      // الملف مقسّم داخل Firestore — يُجمَّع ثم يُنزَّل
      e.preventDefault();
      const { loadGameHtml } = await import('@/lib/game-store');
      const html = await loadGameHtml(activity.id);
      if (html) saveHtml(html);
    }
    await trackDownload(activity.id);
    setStats((s) => ({ ...s, downloads: s.downloads + 1 }));
  };

  if (gone) return null;

  return (
    <div
      data-vt-scope
      className="card-premium group relative flex flex-col overflow-hidden rounded-3xl border border-[color:var(--gold)]/20 bg-[color:var(--surface)] p-5 shadow-lg shadow-black/5"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* top accent ribbon */}
      <div className="absolute inset-x-0 top-0 h-1.5 flag-strip opacity-80" />

      {/* أدوات المالك — لا تظهر للزوّار إطلاقًا */}
      {canManage && !editing && (
        <div className="absolute left-3 top-4 z-10 flex gap-1.5">
          <button
            onClick={() => setEditing(true)}
            className="grid h-9 w-9 place-items-center rounded-xl bg-white/95 text-[color:var(--maroon)] shadow-md backdrop-blur transition hover:scale-105"
            title="تعديل العنوان"
            aria-label="تعديل العنوان"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => void removeActivity()}
            disabled={busy}
            className="grid h-9 w-9 place-items-center rounded-xl bg-white/95 text-[color:var(--coral)] shadow-md backdrop-blur transition hover:scale-105 disabled:opacity-50"
            title="حذف النشاط"
            aria-label="حذف النشاط"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>
      )}

      {/* معاينة حيّة لشكل اللعبة */}
      <Link
        href={`/play/${activity.id}`}
        data-vt-morph="[data-vt-preview]"
        className="group/prev relative mb-4 block overflow-hidden rounded-2xl"
        aria-label={`تشغيل ${activity.title}`}
      >
        <span data-vt-preview className="block">
          <ActivityPreview activity={activity} />
        </span>
        <span className="pointer-events-none absolute inset-0 grid place-items-center bg-[color:var(--maroon)]/0 transition-colors duration-300 group-hover/prev:bg-[color:var(--maroon)]/35">
          <span className="grid h-12 w-12 scale-75 place-items-center rounded-full bg-white/95 text-[color:var(--maroon)] opacity-0 shadow-lg transition-all duration-300 group-hover/prev:scale-100 group-hover/prev:opacity-100">
            <Play className="h-5 w-5 fill-current" />
          </span>
        </span>
      </Link>

      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <ActivityTypeBadge type={activity.type} />
          {activity.local && (
            <span
              className="pill bg-[color:var(--gold)]/20 text-[color:var(--gold)]"
              title="محفوظ في هذا المتصفّح فقط (وضع العرض)"
            >
              محلي
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
          <Eye className="h-3.5 w-3.5" />
          {formatNumber(stats.views)}
        </div>
      </div>

      {editing ? (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            className="w-full rounded-xl border border-[color:var(--maroon)] bg-[color:var(--surface)] px-3 py-2 text-base font-black text-[color:var(--maroon)] outline-none"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void saveTitle();
              if (e.key === 'Escape') {
                setTitle(activity.title);
                setEditing(false);
              }
            }}
          />
          <button
            onClick={() => void saveTitle()}
            disabled={busy}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[color:var(--maroon)] text-white"
            title="حفظ"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </button>
          <button
            onClick={() => {
              setTitle(activity.title);
              setEditing(false);
            }}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[color:var(--surface-2)] text-[color:var(--maroon)]"
            title="إلغاء"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <h3 className="font-display text-lg font-black leading-snug text-[color:var(--maroon)]">
          {activity.title}
        </h3>
      )}
      {activity.description && (
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
          {activity.description}
        </p>
      )}

      <div className="mt-5 flex items-center gap-2">
        <Link
          href={`/play/${activity.id}`}
          data-vt-morph="[data-vt-preview]"
          className="group/btn flex flex-1 items-center justify-center gap-2 rounded-xl bg-[color:var(--maroon)] px-4 py-2.5 text-sm font-black text-white shadow-md shadow-[color:var(--maroon)]/25 transition-all hover:-translate-y-0.5 hover:bg-[color:var(--maroon-700)]"
        >
          <Play className="h-4 w-4 fill-current transition-transform group-hover/btn:scale-110" />
          جرّب الآن
        </Link>
        <a
          href={fileUrl(activity)}
          download
          onClick={onDownload}
          className={cn(
            'flex items-center justify-center gap-2 rounded-xl border-2 border-[color:var(--gold)] px-4 py-2.5 text-sm font-black text-[color:var(--maroon)] transition-all hover:-translate-y-0.5 hover:bg-[color:var(--gold)]/15'
          )}
          title="تحميل النشاط للعمل دون اتصال"
        >
          <Download className="h-4 w-4" />
          {formatNumber(stats.downloads)}
        </a>
      </div>
    </div>
  );
}
