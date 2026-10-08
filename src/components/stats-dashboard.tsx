'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Eye,
  Download,
  Sparkles,
  TrendingUp,
  Play,
  PieChart,
  Table2,
  Library,
} from 'lucide-react';
import { subscribeSiteStats, getAllActivityStats } from '@/lib/stats';
import { isFirebaseConfigured } from '@/lib/firebase';
import type { ActivityStats, ActivityType } from '@/lib/types';
import { ACTIVITY_META } from '@/lib/types';
import { CountUp } from './count-up';
import { ActivityTypeBadge } from './activity-type-badge';
import { formatFull, formatPercent } from '@/lib/utils';
import { HeritageIcon } from './heritage-icons';
import { DonutChart, type DonutSlice } from './charts/donut-chart';

interface Row {
  id: string;
  title: string;
  type: ActivityType;
  subject: string;
}
type FullRow = Row & { views: number; downloads: number };

export function StatsDashboard({ activities: serverActivities }: { activities: Row[] }) {
  const [site, setSite] = useState({ visitors: 0, views: 0, downloads: 0 });
  const [map, setMap] = useState<Record<string, ActivityStats>>({});
  const [loaded, setLoaded] = useState(false);
  const [localRows, setLocalRows] = useState<Row[]>([]);
  /** النوع المُحدَّد بالمؤشّر — تتشارك فيه الحلقتان والمفتاح معًا. */
  const [activeType, setActiveType] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    // بطاقات الإجمالي حيّة: يرى الجميع الأرقام نفسها فور تحديثها.
    const unsub = subscribeSiteStats(setSite);
    getAllActivityStats().then((m) => {
      if (!alive) return;
      setMap(m);
      setLoaded(true);
    });
    // أنشطة «وضع العرض» محفوظة في هذا المتصفّح وحده؛ مع Firestore لا نضمّها،
    // وإلا اختلف عدد الأنشطة من مستخدم لآخر.
    if (!isFirebaseConfigured) import('@/lib/local-store').then((mod) =>
      mod.listLocalActivities().then((acts) =>
        setLocalRows(
          acts.map((a) => ({ id: a.id, title: a.title, type: a.type, subject: '' }))
        )
      )
    );
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  const activities = (() => {
    const ids = new Set(serverActivities.map((a) => a.id));
    return [...serverActivities, ...localRows.filter((a) => !ids.has(a.id))];
  })();

  const rows: FullRow[] = activities
    .map((a) => ({
      ...a,
      views: map[a.id]?.views ?? 0,
      downloads: map[a.id]?.downloads ?? 0,
    }))
    .sort((a, b) => b.views - a.views);

  const maxViews = Math.max(1, ...rows.map((r) => r.views));

  // توزيع حسب النوع: عدد الأنشطة + مجموع المشاهدات
  const types = Object.keys(ACTIVITY_META) as ActivityType[];
  const byType = types
    .map((t) => {
      const list = rows.filter((r) => r.type === t);
      return {
        type: t,
        label: ACTIVITY_META[t].label,
        color: ACTIVITY_META[t].color,
        count: list.length,
        views: list.reduce((n, r) => n + r.views, 0),
      };
    })
    .filter((x) => x.count > 0);

  const totalCount = byType.reduce((n, t) => n + t.count, 0);
  const totalTypeViews = byType.reduce((n, t) => n + t.views, 0);

  const countSlices: DonutSlice[] = byType.map((t) => ({
    key: t.type,
    label: t.label,
    value: t.count,
    color: t.color,
  }));
  const viewSlices: DonutSlice[] = byType.map((t) => ({
    key: t.type,
    label: t.label,
    value: t.views,
    color: t.color,
  }));

  const hot = activeType ? byType.find((t) => t.type === activeType) : null;

  // توزيع المشاهدات حسب المادة (مقدار بدرجة لون واحدة، لا هوية)
  const bySubject = (() => {
    const m = new Map<string, { views: number; count: number }>();
    for (const r of rows) {
      const key = r.subject || 'أنشطة محفوظة محليًّا';
      const cur = m.get(key) ?? { views: 0, count: 0 };
      m.set(key, { views: cur.views + r.views, count: cur.count + 1 });
    }
    return [...m.entries()]
      .map(([subject, v]) => ({ subject, ...v }))
      .sort((a, b) => b.views - a.views || b.count - a.count);
  })();
  const maxSubjectViews = Math.max(1, ...bySubject.map((s) => s.views));

  const cards = [
    { icon: Users, label: 'زائرًا', value: site.visitors, tone: '#2b6b62' },
    { icon: Eye, label: 'مشاهدة', value: site.views, tone: '#2d5f7c' },
    { icon: Download, label: 'تنزيلًا', value: site.downloads, tone: '#b0862a' },
    { icon: Sparkles, label: 'نشاطًا', value: activities.length, tone: '#8a1538' },
  ];

  return (
    <div className="space-y-5 sm:space-y-8">
      {/* لوحات الأرقام: الوسام نفسه في الصفحة الرئيسية */}
      <dl className="stat-tiles stat-tiles--page">
        {cards.map(({ icon: Icon, label, value, tone }, i) => (
          <div
            key={label}
            className="stat-tile"
            style={{ '--tone': tone, '--d': `${-i * 0.9}s` } as React.CSSProperties}
          >
            <span className="stat-medal" aria-hidden>
              <Icon className="h-5 w-5" strokeWidth={2.4} />
            </span>
            <dt className="sr-only">{label}</dt>
            <dd className="stat-body">
              <CountUp value={value} className="stat-n" />
              <span className="stat-l" aria-hidden>{label}</span>
            </dd>
          </div>
        ))}
      </dl>

      {activities.length === 0 ? (
        <div className="explorer-empty">
          <HeritageIcon kind="chart" className="mx-auto" />
          <h2 className="mt-3 font-calli text-2xl text-foreground">
            لا توجد بيانات بعد
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            ستظهر إحصاءات المشاهدات والتنزيلات هنا تلقائيًا بمجرّد رفع الأنشطة
            وبدء الزوّار بتجربتها.
          </p>
        </div>
      ) : (
      <>
      {/* ---------------------------------------------------------------
          حلقتان تشتركان في مفتاح واحد: نفس الفئات وقياسان مختلفان،
          فتُقارَن «حصّة النوع من المكتبة» بـ«حصّته من الاهتمام».
         --------------------------------------------------------------- */}
      <figure className="panel p-4 sm:p-7">
        <figcaption className="mb-5 flex items-center gap-2 sm:mb-7">
          <PieChart className="h-5 w-5 text-[color:var(--gold)]" />
          <h2 className="panel-title">
            التوزيع حسب نوع النشاط
          </h2>
        </figcaption>

        <div className="grid gap-6 sm:gap-8 lg:grid-cols-[auto_1fr] lg:items-center">
          <div className="grid grid-cols-2 gap-4 sm:gap-8">
            <div>
              <DonutChart
                data={countSlices}
                size={150}
                thickness={21}
                animate={loaded}
                activeKey={activeType}
                onActiveChange={setActiveType}
                centerValue={
                  hot ? formatFull(hot.count) : formatFull(totalCount)
                }
                centerLabel={hot ? hot.label : 'إجمالي الأنشطة'}
              />
              <p className="mt-3 text-center text-sm font-semibold text-[color:var(--ink-2)]">
                عدد الأنشطة
              </p>
            </div>
            <div>
              <DonutChart
                data={viewSlices}
                size={150}
                thickness={21}
                animate={loaded}
                activeKey={activeType}
                onActiveChange={setActiveType}
                centerValue={
                  hot ? formatFull(hot.views) : formatFull(totalTypeViews)
                }
                centerLabel={hot ? hot.label : 'إجمالي المشاهدات'}
              />
              <p className="mt-3 text-center text-sm font-semibold text-[color:var(--ink-2)]">
                المشاهدات
              </p>
            </div>
          </div>

          {/* المفتاح: الهوية باسم مكتوب لا باللون وحده */}
          <ul className="w-full space-y-1 lg:max-w-xl">
            {byType.map((t) => (
              <li
                key={t.type}
                onMouseEnter={() => setActiveType(t.type)}
                onMouseLeave={() => setActiveType(null)}
                className={
                  'flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl px-3 py-2.5 transition ' +
                  (activeType === t.type ? 'bg-[color:var(--surface-2)]' : '')
                }
              >
                <span className="flex min-w-0 items-center gap-2 text-sm font-bold text-foreground">
                  <span
                    className="h-3 w-3 shrink-0 rounded-sm"
                    style={{ background: t.color }}
                    aria-hidden
                  />
                  <span className="truncate">{t.label}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-xs font-bold text-muted-foreground">
                  <span className="tabular-nums">{formatFull(t.count)} نشاط</span>
                  <span className="text-[color:var(--gold)]">•</span>
                  <span className="tabular-nums">{formatFull(t.views)} مشاهدة</span>
                  <span className="rounded-md bg-[color:var(--surface-2)] px-1.5 py-0.5 tabular-nums text-[color:var(--maroon)]">
                    {formatPercent(t.views, totalTypeViews)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </figure>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-5">
        {/* ranking: most viewed (single-hue magnitude; identity via type badge) */}
        <figure className="panel min-w-0 p-4 sm:p-7 lg:col-span-3">
          <figcaption className="mb-4 flex items-center gap-2 sm:mb-6">
            <TrendingUp className="h-5 w-5 text-[color:var(--gold)]" />
            <h2 className="panel-title">
              الأنشطة الأكثر مشاهدة
            </h2>
          </figcaption>
          <div className="space-y-4 sm:space-y-5">
            {rows.slice(0, 8).map((r, i) => (
              <div key={r.id} className="group" title={`${r.title} — ${formatFull(r.views)} مشاهدة`}>
                <div className="mb-1.5 flex items-center justify-between gap-2 sm:gap-3">
                  {/* min-w-0 على الرابط نفسه لا على الحاوية فقط: عنصر مرن
                      بنصّ غير قابل للالتفاف لا يتقلّص بدونه، فكان العنوان
                      يمدّ البطاقة 300 بكسل خارج شاشة الهاتف. */}
                  <Link
                    href={`/play/${r.id}`}
                    className="flex min-w-0 flex-1 items-center gap-2 py-1.5 hover:text-[color:var(--maroon)]"
                  >
                    <span className="w-5 shrink-0 text-center font-display text-sm font-bold text-[color:var(--gold)] tabular-nums">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">
                      {r.title}
                    </span>
                    <ActivityTypeBadge type={r.type} className="hidden shrink-0 md:inline-flex" />
                  </Link>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
                    {formatFull(r.views)}
                  </span>
                </div>
                {/* track + bar */}
                <div className="bar-track">
                  <div
                    className="h-full rounded-full transition-[width] duration-[900ms] ease-out group-hover:brightness-110"
                    style={{
                      width: loaded ? `${(r.views / maxViews) * 100}%` : '0%',
                      background: 'var(--maroon)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </figure>

        {/* subjects: مقدار بدرجة واحدة — الترتيب هو الرسالة، لا اللون */}
        <figure className="panel min-w-0 p-4 sm:p-7 lg:col-span-2">
          <figcaption className="mb-4 flex items-center gap-2 sm:mb-6">
            <Library className="h-5 w-5 text-[color:var(--gold)]" />
            <h2 className="panel-title">
              المشاهدات حسب المادة
            </h2>
          </figcaption>
          <div className="space-y-4 sm:space-y-5">
            {bySubject.map((s) => (
              <div key={s.subject} title={`${s.subject} — ${formatFull(s.views)} مشاهدة (${s.count} نشاط)`}>
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                  <span className="min-w-0 truncate text-sm font-bold text-foreground">
                    {s.subject}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-xs font-bold text-muted-foreground">
                    <span className="tabular-nums">{formatFull(s.views)} مشاهدة</span>
                    <span className="text-[color:var(--gold)]">•</span>
                    <span className="tabular-nums">{formatFull(s.count)} نشاط</span>
                  </span>
                </div>
                <div className="bar-track">
                  <div
                    className="h-full rounded-full transition-[width] duration-[900ms] ease-out"
                    style={{
                      width: loaded ? `${(s.views / maxSubjectViews) * 100}%` : '0%',
                      background: 'var(--gold-500)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </figure>
      </div>

      {/* full table (the accessible data view) */}
      <div className="panel overflow-hidden">
        <div className="flex items-center gap-2 border-b border-[color:var(--hairline)] p-5">
          <Table2 className="h-5 w-5 text-[color:var(--gold)]" />
          <h2 className="panel-title">
            كل الأنشطة
          </h2>
        </div>
        {/* الجوال: بطاقات مكدّسة تُظهر كل البيانات بلا تمرير أفقي */}
        <ul className="divide-y divide-[color:var(--hairline)] sm:hidden">
          {rows.map((r) => (
            <li key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-bold text-foreground">{r.title}</p>
                <Link
                  href={`/play/${r.id}`}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[color:var(--maroon)] px-3 py-1.5 text-xs font-semibold text-white"
                >
                  <Play className="h-3 w-3 fill-current" /> تشغيل
                </Link>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold text-muted-foreground">
                <ActivityTypeBadge type={r.type} />
                <span className="flex items-center gap-1 tabular-nums">
                  <Eye className="h-3.5 w-3.5" /> {formatFull(r.views)}
                </span>
                <span className="flex items-center gap-1 tabular-nums">
                  <Download className="h-3.5 w-3.5" /> {formatFull(r.downloads)}
                </span>
              </div>
            </li>
          ))}
        </ul>

        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="border-b border-[color:var(--hairline)] bg-[color:var(--plaster)] text-[color:var(--ink)]">
                <th className="p-4 font-bold">النشاط</th>
                <th className="p-4 font-bold">النوع</th>
                <th className="p-4 font-bold">المشاهدات</th>
                <th className="p-4 font-bold">التنزيلات</th>
                <th className="p-4 font-bold"><span className="sr-only">تشغيل</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[color:var(--hairline)] transition hover:bg-[color:var(--surface-2)]/50">
                  <td className="p-4 font-bold text-foreground">{r.title}</td>
                  <td className="p-4"><ActivityTypeBadge type={r.type} /></td>
                  <td className="p-4 font-bold tabular-nums text-muted-foreground">{formatFull(r.views)}</td>
                  <td className="p-4 font-bold tabular-nums text-muted-foreground">{formatFull(r.downloads)}</td>
                  <td className="p-4">
                    <Link href={`/play/${r.id}`} className="inline-flex items-center gap-1 rounded-lg bg-[color:var(--maroon)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[color:var(--maroon-700)]">
                      <Play className="h-3 w-3 fill-current" /> تشغيل
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
