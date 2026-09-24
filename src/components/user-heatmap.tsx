'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MapPin, Flame, Users, GraduationCap, Building2, Trophy,
  Maximize2, Expand, LayoutGrid, Play, Download, Clock, ChevronRight,
} from 'lucide-react';
import {
  QATAR_SCHOOLS, MUNICIPALITIES, MUNICIPALITY_BY_ID, type MunicipalityId,
} from '@/data/qatar-schools';
import { QATAR_OUTLINE, MUNICIPALITY_SHAPES } from '@/data/qatar-geo';
import { getSchoolMetrics, getSelectedSchool } from '@/lib/school-store';
import {
  normX, normY, buildHeatLUT, rampColor, HEAT_GRADIENT_CSS, MAP_ASPECT,
  pointInRings, isDarkTheme, metricValue, METRIC_LABEL, METRIC_UNIT,
  type MetricKey, type MapMode, type SchoolMetric,
} from '@/lib/heatmap-shared';
import { formatFull, formatPercent } from '@/lib/utils';
import { CountUp } from './count-up';
import { HeatmapExplorer } from './heatmap-explorer';

const METRIC_ICON: Record<MetricKey, typeof Users> = {
  users: Users, plays: Play, downloads: Download,
};
const SHAPE_BY_ID = Object.fromEntries(MUNICIPALITY_SHAPES.map((s) => [s.id, s]));

export function UserHeatmap({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lutRef = useRef<Uint8ClampedArray | null>(null);
  const [metrics, setMetrics] = useState<Record<string, SchoolMetric>>({});
  const [loaded, setLoaded] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [size, setSize] = useState({ w: 300, h: 300 * MAP_ASPECT });
  const [mySchoolId, setMySchoolId] = useState<string | null>(null);
  const [explore, setExplore] = useState(false);
  const [metric, setMetric] = useState<MetricKey>('users');
  const [mode, setMode] = useState<MapMode>('heat');
  const [tab, setTab] = useState<'regions' | 'schools'>('regions');
  const [selMuni, setSelMuni] = useState<MunicipalityId | null>(null);

  useEffect(() => {
    getSchoolMetrics().then((m) => {
      setMetrics(m);
      setUpdatedAt(Date.now());
      setLoaded(true);
    });
    setMySchoolId(getSelectedSchool()?.id ?? null);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const avail = el.clientWidth - 24;
      const w = Math.max(200, Math.min(avail, 330));
      setSize({ w, h: w * MAP_ASPECT });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const valueOf = (id: string) => metricValue(metrics[id], metric);

  const total = useMemo(
    () => QATAR_SCHOOLS.reduce((n, s) => n + valueOf(s.id), 0),
    [metrics, metric] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // تجميع حسب البلدية.
  const byMuni = useMemo(() => {
    const users = new Map<MunicipalityId, number>();
    const schools = new Map<MunicipalityId, number>();
    for (const s of QATAR_SCHOOLS) {
      schools.set(s.municipalityId, (schools.get(s.municipalityId) ?? 0) + 1);
      const c = valueOf(s.id);
      if (c > 0) users.set(s.municipalityId, (users.get(s.municipalityId) ?? 0) + c);
    }
    return MUNICIPALITIES.map((m) => ({
      id: m.id, name: m.name,
      users: users.get(m.id) ?? 0, schools: schools.get(m.id) ?? 0,
    })).sort((a, b) => b.users - a.users || b.schools - a.schools);
  }, [metrics, metric]); // eslint-disable-line react-hooks/exhaustive-deps

  const maxMuni = Math.max(1, ...byMuni.map((m) => m.users));
  const activeMunis = byMuni.filter((m) => m.users > 0).length;
  const topMuni = byMuni[0]?.users > 0 ? byMuni[0] : null;

  // أعلى المدارس (مصفّاة بالمنطقة عند اختيارها).
  const topSchools = useMemo(() => {
    return QATAR_SCHOOLS
      .filter((s) => !selMuni || s.municipalityId === selMuni)
      .map((s) => ({ s, v: valueOf(s.id) }))
      .filter((x) => x.v > 0)
      .sort((a, b) => b.v - a.v)
      .slice(0, 10);
  }, [metrics, metric, selMuni]); // eslint-disable-line react-hooks/exhaustive-deps
  const maxSchoolTop = Math.max(1, ...topSchools.map((x) => x.v));

  // --- رسم البطاقة ----------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w: W, h: H } = size;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const dark = isDarkTheme();

    const SX = (lng: number) => normX(lng) * W;
    const SY = (lat: number) => normY(lat) * H;
    const pathOf = (rings: [number, number][][]) => {
      const p = new Path2D();
      for (const ring of rings) {
        ring.forEach(([lng, lat], i) => { const x = SX(lng), y = SY(lat); i === 0 ? p.moveTo(x, y) : p.lineTo(x, y); });
        p.closePath();
      }
      return p;
    };

    const muniVal = new Map<MunicipalityId, number>();
    for (const s of QATAR_SCHOOLS) { const v = valueOf(s.id); if (v > 0) muniVal.set(s.municipalityId, (muniVal.get(s.municipalityId) ?? 0) + v); }
    const mx = Math.max(1, ...muniVal.values());

    const land = pathOf([QATAR_OUTLINE]);
    ctx.save();
    ctx.shadowColor = dark ? 'rgba(0,0,0,0.5)' : 'rgba(106,15,46,0.22)';
    ctx.shadowBlur = 18; ctx.shadowOffsetY = 5;
    ctx.fillStyle = dark ? 'rgba(40,26,28,0.95)' : 'rgba(255,255,255,0.92)';
    ctx.fill(land);
    ctx.restore();

    if (mode === 'regions') {
      for (const shp of MUNICIPALITY_SHAPES) {
        const val = muniVal.get(shp.id as MunicipalityId) ?? 0;
        const p = pathOf(shp.rings);
        const dim = selMuni && selMuni !== shp.id ? 0.4 : 1;
        ctx.fillStyle = val > 0 ? rampColor(0.15 + (val / mx) * 0.85, 0.9 * dim) : (dark ? 'rgba(255,255,255,0.04)' : 'rgba(120,96,48,0.06)');
        ctx.fill(p);
        ctx.lineJoin = 'round';
        ctx.lineWidth = selMuni === shp.id ? 2 : 0.9;
        ctx.strokeStyle = selMuni === shp.id ? (dark ? '#e3c26b' : '#6a0f2e') : (dark ? 'rgba(245,236,228,0.22)' : 'rgba(106,15,46,0.3)');
        ctx.stroke(p);
      }
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, dark ? 'rgba(120,96,48,0.14)' : 'rgba(168,140,74,0.14)');
      g.addColorStop(1, dark ? 'rgba(80,64,32,0.1)' : 'rgba(120,96,48,0.09)');
      ctx.fillStyle = g; ctx.fill(land);
      const pts = QATAR_SCHOOLS.map((s) => ({ x: SX(s.lng), y: SY(s.lat), w: valueOf(s.id) })).filter((p) => p.w > 0);
      if (pts.length) {
        const grid = new Float32Array(W * H);
        const R = Math.max(30, W * 0.2); const R2 = R * R; let gmax = 0;
        for (const p of pts) {
          const x0 = Math.max(0, Math.floor(p.x - R)), x1 = Math.min(W - 1, Math.ceil(p.x + R));
          const y0 = Math.max(0, Math.floor(p.y - R)), y1 = Math.min(H - 1, Math.ceil(p.y + R));
          for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
            const dx = x - p.x, dy = y - p.y, d2 = dx * dx + dy * dy;
            if (d2 > R2) continue; const f = 1 - d2 / R2; const idx = y * W + x;
            grid[idx] += p.w * f * f; if (grid[idx] > gmax) gmax = grid[idx];
          }
        }
        if (gmax > 0) {
          const lut = (lutRef.current ??= buildHeatLUT());
          const img = ctx.createImageData(W, H); const data = img.data;
          for (let i = 0; i < grid.length; i++) {
            const v = grid[i] / gmax; if (v <= 0) continue;
            const t = Math.min(255, Math.round(Math.sqrt(v) * 255)); const o = i * 4, l = t * 4;
            data[o] = lut[l]; data[o + 1] = lut[l + 1]; data[o + 2] = lut[l + 2]; data[o + 3] = lut[l + 3];
          }
          const heat = document.createElement('canvas'); heat.width = W; heat.height = H;
          heat.getContext('2d')!.putImageData(img, 0, 0);
          ctx.save(); ctx.clip(land); ctx.filter = 'blur(5px)'; ctx.drawImage(heat, 0, 0); ctx.filter = 'none'; ctx.restore();
        }
      }
      // بلا قصّ على اليابسة: المخطّط الساحلي مبسّط فتقع بعض المدارس الساحلية خارجه.
      ctx.fillStyle = dark ? 'rgba(227,194,107,0.4)' : 'rgba(106,15,46,0.28)';
      for (const s of QATAR_SCHOOLS) { ctx.beginPath(); ctx.arc(SX(s.lng), SY(s.lat), 1.3, 0, Math.PI * 2); ctx.fill(); }
      ctx.lineJoin = 'round';
      ctx.lineWidth = 1.4; ctx.strokeStyle = dark ? 'rgba(227,194,107,0.5)' : 'rgba(106,15,46,0.55)';
      ctx.stroke(land);
    }

    // أسماء المناطق (البلديات) مباشرةً على الخريطة — لتظهر قبل فتح ملء الشاشة.
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.direction = 'rtl';
    ctx.font = '800 10px Tajawal, "Noto Kufi Arabic", sans-serif';
    for (const m of MUNICIPALITIES) {
      const shp = SHAPE_BY_ID[m.id];
      const cx = shp ? shp.centroid[0] : m.lng;
      const cy = shp ? shp.centroid[1] : m.lat;
      const active = !selMuni || selMuni === m.id;
      const x = SX(cx);
      // نرفع البطاقة قليلًا فوق المركز حتى لا تحجبها فقاعة القيمة.
      const y = SY(cy) - 11;
      const padX = 5, bh = 15;
      const tw = ctx.measureText(m.name).width;
      const bw = tw + padX * 2;
      const bx = x - bw / 2, by = y - bh / 2;
      ctx.globalAlpha = active ? 1 : 0.35;
      ctx.fillStyle = dark ? 'rgba(18,11,13,0.85)' : 'rgba(106,15,46,0.92)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 6); else ctx.rect(bx, by, bw, bh);
      ctx.fill();
      ctx.fillStyle = dark ? '#f5ece4' : '#ffffff';
      ctx.fillText(m.name, x, y + 0.5);
      ctx.globalAlpha = 1;
    }
  }, [size, metrics, metric, mode, selMuni]); // eslint-disable-line react-hooks/exhaustive-deps

  // نقر الخريطة → تحديد المنطقة.
  const onMapClick = (e: React.MouseEvent) => {
    const el = wrapRef.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    // norm → lng/lat
    const lng = nx * (51.68 - 50.68) + 50.68;
    const lat = 26.22 - ny * (26.22 - 24.47);
    const hit = MUNICIPALITY_SHAPES.find((shp) => pointInRings(lng, lat, shp.rings));
    const id = hit ? (hit.id as MunicipalityId) : null;
    setSelMuni(id);
    if (id) setTab('schools');
  };

  const tiles = [
    { icon: METRIC_ICON[metric], label: `إجمالي ${METRIC_LABEL[metric]}`, value: total, isNum: true },
    { icon: GraduationCap, label: 'عدد المدارس', value: QATAR_SCHOOLS.length, isNum: true },
    { icon: Building2, label: 'البلديات المشمولة', value: `${activeMunis}/${MUNICIPALITIES.length}`, isNum: false },
    { icon: Trophy, label: 'أعلى منطقة تركيزًا', value: topMuni ? topMuni.name : '—', isNum: false },
  ];
  const seg = (active: boolean) =>
    'rounded-lg px-2.5 py-1.5 text-xs font-black transition ' +
    (active ? 'bg-[color:var(--maroon)] text-white shadow-sm' : 'text-[color:var(--maroon)] hover:bg-[color:var(--surface-2)]');

  return (
    <figure className={`card-premium rounded-2xl p-4 sm:rounded-3xl sm:p-7 ${className}`}>
      <figcaption className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-[color:var(--maroon)]" />
          <h2 className="font-display text-lg font-bold text-[color:var(--maroon)]">
            الخريطة الحرارية لمستخدمي الألعاب حسب المدرسة
          </h2>
        </span>
        <button onClick={() => setExplore(true)} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[color:var(--maroon)] px-3.5 py-2 text-sm font-black text-white shadow-sm transition hover:bg-[color:var(--maroon-700)]">
          <Maximize2 className="h-4 w-4" /> فتح بملء الشاشة
        </button>
      </figcaption>

      {/* أدوات: المقياس + الوضع + آخر تحديث */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-0.5 rounded-xl bg-[color:var(--surface-2)]/70 p-0.5 ring-1 ring-[color:var(--hairline)]">
          {(['users', 'plays', 'downloads'] as MetricKey[]).map((k) => (
            <button key={k} onClick={() => setMetric(k)} className={seg(metric === k)}>{METRIC_LABEL[k]}</button>
          ))}
        </div>
        <div className="flex items-center gap-0.5 rounded-xl bg-[color:var(--surface-2)]/70 p-0.5 ring-1 ring-[color:var(--hairline)]">
          <button onClick={() => setMode('heat')} className={seg(mode === 'heat')}><span className="flex items-center gap-1"><Flame className="h-3.5 w-3.5" /> حرارة</span></button>
          <button onClick={() => setMode('regions')} className={seg(mode === 'regions')}><span className="flex items-center gap-1"><LayoutGrid className="h-3.5 w-3.5" /> مناطق</span></button>
        </div>
        {updatedAt && (
          <span className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> آخر تحديث: {new Date(updatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* بطاقات المؤشّرات */}
      <div className="mb-6 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl border border-[color:var(--hairline)] bg-[color:var(--surface-2)]/60 p-3 sm:p-4">
            <t.icon className="h-4 w-4 text-[color:var(--gold)]" />
            <div className="mt-1.5 truncate font-display text-lg font-black text-foreground tabular-nums sm:text-xl">
              {t.isNum ? <CountUp value={t.value as number} /> : t.value}
            </div>
            <p className="text-[11px] font-bold leading-tight text-muted-foreground sm:text-xs">{t.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr] lg:items-start">
        {/* الخريطة */}
        <div ref={containerRef} className="mx-auto w-full max-w-[340px]">
          <div className="relative rounded-3xl border border-[color:var(--hairline)] bg-gradient-to-b from-[color:var(--surface)] to-[color:var(--surface-2)]/50 p-3">
            {/* أسهم التكبير على طرف الخريطة — طريقة إضافية لفتحها بكامل الصفحة */}
            <button
              type="button"
              onClick={() => setExplore(true)}
              className="icon-3d icon-3d-lift group absolute right-2.5 top-2.5 z-20 h-9 w-9 rounded-xl"
              style={{ ['--i3d' as string]: 'var(--maroon)' }}
              aria-label="فتح الخريطة بكامل الصفحة"
              title="فتح الخريطة بكامل الصفحة"
            >
              <Expand className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
            </button>
            <div ref={wrapRef} onClick={onMapClick} className="relative mx-auto cursor-pointer" style={{ width: size.w, height: size.h }}>
              <canvas ref={canvasRef} style={{ width: size.w, height: size.h }} className="block"
                role="img" aria-label="خريطة قطر الحرارية لتركيز مستخدمي الألعاب حسب المدرسة" />
              {/* فقاعات البلديات */}
              {byMuni.filter((m) => m.users > 0).map((m) => {
                const mm = MUNICIPALITY_BY_ID[m.id];
                const shp = SHAPE_BY_ID[m.id];
                const cx = shp ? shp.centroid[0] : mm.lng;
                const cy = shp ? shp.centroid[1] : mm.lat;
                const r = 9 + (m.users / maxMuni) * 15;
                return (
                  <button key={m.id}
                    onClick={(e) => { e.stopPropagation(); setSelMuni(m.id); setTab('schools'); }}
                    className="group absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white/80 text-[10px] font-black text-white shadow-[0_2px_8px_rgba(106,15,46,0.4)] outline-none transition hover:scale-110"
                    style={{ left: `${normX(cx) * 100}%`, top: `${normY(cy) * 100}%`, width: r, height: r, background: 'radial-gradient(circle at 35% 30%, var(--maroon), var(--maroon-700))' }}
                    title={`${m.name}: ${formatFull(m.users)} ${METRIC_UNIT[metric]}`}
                    aria-label={`${m.name}: ${formatFull(m.users)}`}>
                    <span className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-[color:var(--maroon)] px-2 py-1 text-[11px] font-bold text-white shadow-lg group-hover:block">
                      {m.name} · {formatFull(m.users)}
                    </span>
                  </button>
                );
              })}
              {mySchoolId && (() => {
                const s = QATAR_SCHOOLS.find((x) => x.id === mySchoolId); if (!s) return null;
                return (<span className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full" style={{ left: `${normX(s.lng) * 100}%`, top: `${normY(s.lat) * 100}%` }} title="مدرستك">
                  <MapPin className="h-5 w-5 text-[color:var(--gold)] drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]" fill="currentColor" /></span>);
              })()}
            </div>
          </div>
          <div className="mx-auto mt-4 max-w-[300px]">
            <div className="h-2.5 w-full rounded-full ring-1 ring-inset ring-black/5" style={{ background: HEAT_GRADIENT_CSS }} />
            <div className="mt-1 flex justify-between text-[11px] font-bold text-muted-foreground"><span>أقلّ تركيزًا</span><span>أعلى تركيزًا</span></div>
          </div>
        </div>

        {/* اللوحة الجانبية: تبويب المناطق / أعلى المدارس */}
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-1 rounded-xl bg-[color:var(--surface-2)]/70 p-0.5 ring-1 ring-[color:var(--hairline)]">
            <button onClick={() => { setTab('regions'); setSelMuni(null); }} className={'flex-1 ' + seg(tab === 'regions')}>ترتيب المناطق</button>
            <button onClick={() => setTab('schools')} className={'flex-1 ' + seg(tab === 'schools')}>
              {selMuni ? `مدارس ${MUNICIPALITY_BY_ID[selMuni].name}` : 'أعلى ١٠ مدارس'}
            </button>
          </div>

          {loaded && total === 0 ? (
            <p className="rounded-2xl border border-dashed border-[color:var(--hairline-strong)] p-6 text-center text-sm text-muted-foreground">
              لا توجد بيانات بعد — ستتوهّج الخريطة تلقائيًا كلّما اختار المستخدمون مدارسهم قبل اللعب أو التحميل.
            </p>
          ) : tab === 'regions' ? (
            <ul className="space-y-3.5">
              {byMuni.map((m, i) => {
                const rank = i + 1; const isTop = m.users > 0 && rank <= 3;
                return (
                  <li key={m.id}>
                    <button onClick={() => { setSelMuni(m.id); setTab('schools'); }} className="group w-full text-right">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2 text-sm font-bold text-foreground">
                          <span className={'grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-black tabular-nums ' + (isTop ? 'bg-[color:var(--maroon)] text-white' : 'bg-[color:var(--surface-2)] text-muted-foreground')}>{rank}</span>
                          <span className="truncate group-hover:text-[color:var(--maroon)]">{m.name}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2 text-xs font-bold tabular-nums text-muted-foreground">
                          <span>{formatFull(m.users)} {METRIC_UNIT[metric]}</span>
                          <span className="rounded-md bg-[color:var(--surface-2)] px-1.5 py-0.5 text-[color:var(--maroon)]">{formatPercent(m.users, total)}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[color:var(--surface-2)]">
                          <div className="h-full rounded-full transition-[width] duration-[900ms] ease-out" style={{ width: loaded ? `${(m.users / maxMuni) * 100}%` : '0%', background: 'linear-gradient(90deg, var(--gold), var(--maroon))' }} />
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 rotate-180 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div>
              {selMuni && (
                <button onClick={() => { setSelMuni(null); }} className="mb-2 text-xs font-bold text-[color:var(--maroon)] hover:underline">→ كل المدارس</button>
              )}
              {topSchools.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[color:var(--hairline-strong)] p-6 text-center text-sm text-muted-foreground">لا مستخدمين في هذه المنطقة بعد.</p>
              ) : (
                <ul className="space-y-3">
                  {topSchools.map(({ s, v }, i) => (
                    <li key={s.id}>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2 text-sm font-bold text-foreground">
                          <span className="w-5 shrink-0 text-center font-display text-sm font-black text-[color:var(--gold)] tabular-nums">{i + 1}</span>
                          <span className="truncate">{s.name}</span>
                        </span>
                        <span className="shrink-0 text-xs font-bold tabular-nums text-muted-foreground">{formatFull(v)} {METRIC_UNIT[metric]}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--surface-2)]">
                        <div className="h-full rounded-full" style={{ width: `${(v / maxSchoolTop) * 100}%`, background: 'linear-gradient(90deg, var(--gold), var(--maroon))' }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {explore && (
        <HeatmapExplorer metrics={metrics} mySchoolId={mySchoolId} onClose={() => setExplore(false)} />
      )}
    </figure>
  );
}
