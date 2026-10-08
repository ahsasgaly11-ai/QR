'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Play, Download, Eye, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react';
import { ACTIVITY_META } from '@/lib/types';
import type { Activity, ActivityStats, ActivityType } from '@/lib/types';
import { subscribeActivityStats, trackDownload } from '@/lib/stats';
import { HeritageIcon, ACTIVITY_ICON } from './heritage-icons';
import { formatNumber } from '@/lib/utils';
import { getLocalRecord, htmlToBlobUrl, dropCachedPreview } from '@/lib/local-store';
import { ActivityPreview } from './activity-preview';
import { trackSchoolDownload, getSelectedSchool } from '@/lib/school-store';
import { useActivityDownloadEnabled, downloadsAllowedNow } from '@/lib/site-settings';

// فعل زرّ التشغيل بحسب نوع النشاط
const PLAY_LABEL: Record<ActivityType, string> = {
  experiment: 'ابدأ التجربة',
  simulation: 'شغّل المحاكاة',
  quiz: 'ابدأ الأسئلة',
  game: 'العب الآن',
};

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
  const router = useRouter();
  const [stats, setStats] = useState<ActivityStats>({ views: 0, downloads: 0 });
  // يوقف المشرف التنزيل من لوحة التحكّم ← تُستخدم الألعاب داخل الموقع فقط
  const canDownload = useActivityDownloadEnabled(activity);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(activity.title);
  const [description, setDescription] = useState(activity.description ?? '');
  const [busy, setBusy] = useState(false);
  const [gone, setGone] = useState(false);

  const canManage = isOwner && activity.stored === 'firestore';

  async function saveDetails() {
    const nextTitle = title.trim();
    const nextDescription = description.trim();
    if (!nextTitle) return;
    if (
      nextTitle === activity.title &&
      nextDescription === (activity.description ?? '')
    ) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      const { updateActivity } = await import('@/lib/content');
      const { revalidateContent } = await import('@/lib/revalidate');
      const patch = {
        title: nextTitle,
        description: nextDescription,
      };
      await updateActivity(activity.id, patch);
      await revalidateContent({ subjectId: activity.subjectId, activityId: activity.id });
      onChanged?.(activity.id, patch);
      setEditing(false);
    } catch {
      setTitle(activity.title);
      setDescription(activity.description ?? '');
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

  // مشاهدات/تنزيلات حيّة: الرقم نفسه لدى الجميع ويتحدّث دون إعادة تحميل.
  useEffect(() => subscribeActivityStats(activity.id, setStats), [activity.id]);

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
    // احتياط: قد يُوقف المشرف التنزيل والصفحة مفتوحة
    if (!downloadsAllowedNow(activity)) {
      e.preventDefault();
      return;
    }
    // لا تحميل قبل اختيار المدرسة: نوجّه المستخدم لصفحة النشاط حيث بوّابة الاختيار
    if (!getSelectedSchool()) {
      e.preventDefault();
      router.push(`/play/${activity.id}`);
      return;
    }
    // الأنشطة المحفوظة محليًا (وضع العرض) تُنزَّل من مخزن المتصفّح
    if (activity.local) {
      e.preventDefault();
      const rec = await getLocalRecord(activity.id);
      if (!rec?.html) return; // لم يُنزَّل شيء — لا نحتسبه
      saveHtml(rec.html);
    } else if (activity.stored === 'firestore') {
      // الملف مقسّم داخل Firestore — يُجمَّع ثم يُنزَّل
      e.preventDefault();
      const { loadGameHtml } = await import('@/lib/game-store');
      const html = await loadGameHtml(activity.id).catch(() => null);
      if (!html) {
        alert('تعذّر تنزيل الملف. تحقّق من اتصالك ثم أعد المحاولة.');
        return;
      }
      saveHtml(html);
    }
    trackSchoolDownload(activity); // ينسب التحميل لمدرسة المستخدم المختارة
    await trackDownload(activity.id);
  };

  if (gone) return null;

  const meta = ACTIVITY_META[activity.type];

  // ميل خفيف مع المؤشّر ولمعة ضوء تتبعه (لا على اللمس، ولا لمن طلب تقليل الحركة)
  const onTilt = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty('--ry', `${((x - 0.5) * 8).toFixed(2)}deg`);
    el.style.setProperty('--rx', `${((0.5 - y) * 6).toFixed(2)}deg`);
    el.style.setProperty('--gx', `${(x * 100).toFixed(1)}%`);
    el.style.setProperty('--gy', `${(y * 100).toFixed(1)}%`);
  };
  const onTiltEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  };

  return (
    <div
      data-vt-scope
      className="act-card group"
      style={{ '--tc': meta.color } as React.CSSProperties}
      onPointerMove={onTilt}
      onPointerLeave={onTiltEnd}
    >
      {/* أدوات المالك — لا تظهر للزوّار إطلاقًا */}
      {canManage && !editing && (
        <div className="absolute left-3 top-3 z-20 flex gap-1.5">
          <button
            onClick={() => setEditing(true)}
            className="act-owner-btn text-[color:var(--maroon)]"
            title="تعديل اللعبة"
            aria-label="تعديل اللعبة"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => void removeActivity()}
            disabled={busy}
            className="act-owner-btn text-[color:var(--coral)] disabled:opacity-50"
            title="حذف اللعبة"
            aria-label="حذف اللعبة"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>
      )}

      {/* معاينة حيّة لشكل اللعبة، وأيقونة نوعها ثلاثية الأبعاد في الزاوية */}
      <Link
        href={`/play/${activity.id}`}
        data-vt-morph="[data-vt-preview]"
        className="act-thumb group/prev"
        aria-label={`تشغيل ${activity.title}`}
      >
        <span data-vt-preview className="block">
          <ActivityPreview activity={activity} className="act-preview h-44" />
        </span>
        <span className="act-type-icon" aria-hidden>
          <HeritageIcon kind={ACTIVITY_ICON[activity.type]} />
        </span>
        <span className="act-type-chip">{meta.label}</span>
        <span className="act-play-hint" aria-hidden>
          <Play className="h-5 w-5 fill-current" />
        </span>
      </Link>

      <div className="act-body">
        {activity.local && (
          <span
            className="mb-2 inline-block rounded-md bg-[color:var(--gold)]/15 px-2 py-0.5 text-xs font-semibold text-[color:var(--gold)]"
            title="محفوظ في هذا المتصفّح فقط (وضع العرض)"
          >
            محلي
          </span>
        )}

        {editing ? (
          <div className="space-y-2">
            <input
              autoFocus
              className="w-full rounded-lg border border-[color:var(--maroon)] bg-[color:var(--surface)] px-3 py-2 text-base font-semibold text-[color:var(--maroon)] outline-none"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="عنوان اللعبة"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setTitle(activity.title);
                  setDescription(activity.description ?? '');
                  setEditing(false);
                }
              }}
            />
            <textarea
              className="w-full resize-none rounded-lg border border-[color:var(--hairline-strong)] bg-[color:var(--surface)] px-3 py-2 text-sm leading-6 outline-none focus:border-[color:var(--maroon)]"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="وصف اللعبة"
            />
            <div className="flex gap-2">
              <button
                onClick={() => void saveDetails()}
                disabled={busy || !title.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[color:var(--maroon)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                title="حفظ التعديلات"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                حفظ
              </button>
              <button
                onClick={() => {
                  setTitle(activity.title);
                  setDescription(activity.description ?? '');
                  setEditing(false);
                }}
                className="flex items-center justify-center gap-1 rounded-lg bg-[color:var(--surface-2)] px-3 py-2 text-sm font-semibold text-[color:var(--maroon)]"
                title="إلغاء"
              >
                <X className="h-4 w-4" /> إلغاء
              </button>
            </div>
          </div>
        ) : (
          <>
            <h3 className="act-title">{activity.title}</h3>
            {activity.description && <p className="act-desc">{activity.description}</p>}
          </>
        )}

        <div className="act-meta">
          <span>
            <Eye className="h-3.5 w-3.5" aria-hidden /> {formatNumber(stats.views)} مشاهدة
          </span>
          {canDownload && (
            <span>
              <Download className="h-3.5 w-3.5" aria-hidden /> {formatNumber(stats.downloads)} تنزيلًا
            </span>
          )}
        </div>

        <div className="act-actions">
          <Link
            href={`/play/${activity.id}`}
            data-vt-morph="[data-vt-preview]"
            className="act-play"
          >
            <Play className="h-4 w-4 fill-current" aria-hidden />
            {PLAY_LABEL[activity.type]}
          </Link>
          {canDownload && (
            <a
              href={fileUrl(activity)}
              download
              onClick={onDownload}
              className="act-download"
              title="تحميل النشاط للعمل دون اتصال"
              aria-label={`تحميل ${activity.title} للعمل دون اتصال`}
            >
              <Download className="h-5 w-5" />
            </a>
          )}
        </div>
      </div>
      <span className="act-glare" aria-hidden />
    </div>
  );
}
