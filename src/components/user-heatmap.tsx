'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Flame, Users, GraduationCap, Building2, Trophy, Maximize2 } from 'lucide-react';
import {
  QATAR_SCHOOLS,
  MUNICIPALITIES,
  type MunicipalityId,
} from '@/data/qatar-schools';
import { QATAR_OUTLINE, QATAR_BBOX as GEO } from '@/data/qatar-geo';
import { getSchoolStats, getSelectedSchool } from '@/lib/school-store';
import { formatFull, formatPercent } from '@/lib/utils';
import { HeatmapExplorer } from './heatmap-explorer';

const LAT_MID = (GEO.latMin + GEO.latMax) / 2;
const ASPECT =
  (GEO.latMax - GEO.latMin) /
  ((GEO.lngMax - GEO.lngMin) * Math.cos((LAT_MID * Math.PI) / 180));

function xPct(lng: number) {
  return ((lng - GEO.lngMin) / (GEO.lngMax - GEO.lngMin)) * 100;
}
function yPct(lat: number) {
  return ((GEO.latMax - lat) / (GEO.latMax - GEO.latMin)) * 100;
}

// --- تدرّج لوني تسلسلي أحادي العائلة (ذهبي → عنّابي) للمقدار ------------------
const RAMP: { t: number; c: [number, number, number]; a: number }[] = [
  { t: 0.0, c: [246, 224, 156], a: 0 },
  { t: 0.15, c: [244, 214, 138], a: 0.5 },
  { t: 0.4, c: [224, 170, 52], a: 0.72 },
  { t: 0.68, c: [176, 42, 84], a: 0.86 },
  { t: 1.0, c: [106, 15, 46], a: 0.95 },
];

function rampLUT(): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let lo = RAMP[0];
    let hi = RAMP[RAMP.length - 1];
    for (let k = 0; k < RAMP.length - 1; k++) {
      if (t >= RAMP[k].t && t <= RAMP[k + 1].t) {
        lo = RAMP[k];
        hi = RAMP[k + 1];
        break;
      }
    }
    const f = (t - lo.t) / (hi.t - lo.t || 1);
    lut[i * 4] = lo.c[0] + (hi.c[0] - lo.c[0]) * f;
    lut[i * 4 + 1] = lo.c[1] + (hi.c[1] - lo.c[1]) * f;
    lut[i * 4 + 2] = lo.c[2] + (hi.c[2] - lo.c[2]) * f;
    lut[i * 4 + 3] = (lo.a + (hi.a - lo.a) * f) * 255;
  }
  return lut;
}

interface MuniAgg {
  id: MunicipalityId;
  name: string;
  lat: number;
  lng: number;
  users: number;
  schools: number;
}

export function UserHeatmap({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(false);
  const [size, setSize] = useState({ w: 300, h: 300 * ASPECT });
  const [mySchoolId, setMySchoolId] = useState<string | null>(null);
  const [explore, setExplore] = useState(false);
  const lutRef = useRef<Uint8ClampedArray | null>(null);

  useEffect(() => {
    getSchoolStats().then((s) => {
      setStats(s);
      setLoaded(true);
    });
    setMySchoolId(getSelectedSchool()?.id ?? null);
  }, []);

  useEffect(() => {
    // نقيس الحاوية الأمّ (لا العنصر المضبوط عرضه)، وإلا صار القياس حلقة
    // مغلقة تُثبّت العرض على قيمته الأولى ولا يتكيّف مع الشاشة.
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const avail = el.clientWidth - 24; // بطاقة الخريطة بحاشية p-3 (12px×2)
      const w = Math.max(200, Math.min(avail, 330));
      setSize({ w, h: w * ASPECT });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // مجموع المستخدمين محسوبٌ من المدارس الموجودة فقط، فيتّسق مع مجاميع المناطق
  // والنِّسب (تجاهُل أي عدّادات Firestore لمعرّفات لم تعد في القائمة).
  const total = useMemo(
    () => QATAR_SCHOOLS.reduce((n, s) => n + (stats[s.id] || 0), 0),
    [stats]
  );

  const byMuni: MuniAgg[] = useMemo(() => {
    const users = new Map<MunicipalityId, number>();
    const schools = new Map<MunicipalityId, number>();
    for (const s of QATAR_SCHOOLS) {
      schools.set(s.municipalityId, (schools.get(s.municipalityId) ?? 0) + 1);
      const c = stats[s.id] ?? 0;
      if (c > 0) users.set(s.municipalityId, (users.get(s.municipalityId) ?? 0) + c);
    }
    return MUNICIPALITIES.map((m) => ({
      id: m.id,
      name: m.name,
      lat: m.lat,
      lng: m.lng,
      users: users.get(m.id) ?? 0,
      schools: schools.get(m.id) ?? 0,
    })).sort((a, b) => b.users - a.users || b.schools - a.schools);
  }, [stats]);

  const maxMuniUsers = Math.max(1, ...byMuni.map((m) => m.users));
  const activeMunis = byMuni.filter((m) => m.users > 0).length;
  const topMuni = byMuni[0]?.users > 0 ? byMuni[0] : null;

  // --- رسم الخريطة ----------------------------------------------------------
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

    const px = (lng: number) => (xPct(lng) / 100) * W;
    const py = (lat: number) => (yPct(lat) / 100) * H;

    const landPath = new Path2D();
    QATAR_OUTLINE.forEach(([lng, lat], i) => {
      const x = px(lng);
      const y = py(lat);
      if (i === 0) landPath.moveTo(x, y);
      else landPath.lineTo(x, y);
    });
    landPath.closePath();

    // 1) ظلّ ناعم أسفل اليابسة (إحساس بالارتفاع).
    ctx.save();
    ctx.shadowColor = 'rgba(106,15,46,0.28)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fill(landPath);
    ctx.restore();

    // 2) تعبئة اليابسة بتدرّج دافئ خفيف.
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(168,140,74,0.16)');
    grad.addColorStop(1, 'rgba(120,96,48,0.10)');
    ctx.fillStyle = grad;
    ctx.fill(landPath);

    // 3) طبقة الحرارة داخل اليابسة (تراكم شعاعي موزون + تنعيم).
    const points = QATAR_SCHOOLS.map((s) => ({
      x: px(s.lng),
      y: py(s.lat),
      w: stats[s.id] ?? 0,
    })).filter((p) => p.w > 0);

    if (points.length > 0) {
      const grid = new Float32Array(W * H);
      const R = Math.max(30, W * 0.2);
      const R2 = R * R;
      let gmax = 0;
      for (const p of points) {
        const x0 = Math.max(0, Math.floor(p.x - R));
        const x1 = Math.min(W - 1, Math.ceil(p.x + R));
        const y0 = Math.max(0, Math.floor(p.y - R));
        const y1 = Math.min(H - 1, Math.ceil(p.y + R));
        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) {
            const dx = x - p.x;
            const dy = y - p.y;
            const d2 = dx * dx + dy * dy;
            if (d2 > R2) continue;
            const fall = 1 - d2 / R2;
            const idx = y * W + x;
            grid[idx] += p.w * fall * fall;
            if (grid[idx] > gmax) gmax = grid[idx];
          }
        }
      }
      if (gmax > 0) {
        const lut = (lutRef.current ??= rampLUT());
        const img = ctx.createImageData(W, H);
        const data = img.data;
        for (let i = 0; i < grid.length; i++) {
          const v = grid[i] / gmax;
          if (v <= 0) continue;
          const t = Math.min(255, Math.round(Math.sqrt(v) * 255));
          const o = i * 4;
          const l = t * 4;
          data[o] = lut[l];
          data[o + 1] = lut[l + 1];
          data[o + 2] = lut[l + 2];
          data[o + 3] = lut[l + 3];
        }
        const heat = document.createElement('canvas');
        heat.width = W;
        heat.height = H;
        heat.getContext('2d')!.putImageData(img, 0, 0);
        ctx.save();
        ctx.clip(landPath);
        ctx.filter = 'blur(5px)'; // تنعيم احترافي للبؤر
        ctx.drawImage(heat, 0, 0);
        ctx.filter = 'none';
        ctx.restore();
      }
    }

    // 4) نقاط المدارس الخفيفة (سياق: أين المدارس فعلًا).
    ctx.save();
    ctx.clip(landPath);
    ctx.fillStyle = 'rgba(106,15,46,0.22)';
    for (const s of QATAR_SCHOOLS) {
      ctx.beginPath();
      ctx.arc(px(s.lng), py(s.lat), 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 5) خطّ الساحل (حدّان: هالة فاتحة + خطّ عنّابي رفيع).
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.stroke(landPath);
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = 'rgba(106,15,46,0.6)';
    ctx.stroke(landPath);
  }, [size, stats]);

  const tiles = [
    { icon: Users, label: 'إجمالي المستخدمين', value: formatFull(total) },
    { icon: GraduationCap, label: 'عدد المدارس', value: formatFull(QATAR_SCHOOLS.length) },
    { icon: Building2, label: 'البلديات المشمولة', value: `${activeMunis}/${MUNICIPALITIES.length}` },
    { icon: Trophy, label: 'أعلى منطقة تركيزًا', value: topMuni ? topMuni.name : '—' },
  ];

  return (
    <figure className={`card-premium rounded-2xl p-4 sm:rounded-3xl sm:p-7 ${className}`}>
      <figcaption className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-[color:var(--maroon)]" />
          <h2 className="font-display text-lg font-bold text-[color:var(--maroon)]">
            الخريطة الحرارية لمستخدمي الألعاب حسب المدرسة
          </h2>
        </span>
        <button
          onClick={() => setExplore(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[color:var(--maroon)] px-3.5 py-2 text-sm font-black text-white shadow-sm transition hover:bg-[color:var(--maroon-700)]"
        >
          <Maximize2 className="h-4 w-4" /> فتح بملء الشاشة
        </button>
      </figcaption>

      {/* بطاقات المؤشّرات */}
      <div className="mb-6 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="rounded-2xl border border-[color:var(--hairline)] bg-[color:var(--surface-2)]/60 p-3 sm:p-4"
          >
            <t.icon className="h-4 w-4 text-[color:var(--gold)]" />
            <div className="mt-1.5 truncate font-display text-lg font-black text-foreground tabular-nums sm:text-xl">
              {t.value}
            </div>
            <p className="text-[11px] font-bold leading-tight text-muted-foreground sm:text-xs">
              {t.label}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr] lg:items-start">
        {/* الخريطة */}
        <div ref={containerRef} className="mx-auto w-full max-w-[340px]">
          <div className="rounded-3xl border border-[color:var(--hairline)] bg-gradient-to-b from-[color:var(--surface)] to-[color:var(--surface-2)]/50 p-3">
            <div
              ref={wrapRef}
              className="relative mx-auto"
              style={{ width: size.w, height: size.h }}
            >
              <canvas
                ref={canvasRef}
                style={{ width: size.w, height: size.h }}
                className="block"
                role="img"
                aria-label="خريطة قطر الحرارية لتركيز مستخدمي الألعاب التعليمية حسب موقع المدرسة"
              />

              {/* فقاعات البلديات */}
              {byMuni
                .filter((m) => m.users > 0)
                .map((m) => {
                  const r = 9 + (m.users / maxMuniUsers) * 15;
                  return (
                    <button
                      key={m.id}
                      className="group absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white/80 text-[10px] font-black text-white shadow-[0_2px_8px_rgba(106,15,46,0.4)] outline-none transition hover:scale-110 focus-visible:ring-2 focus-visible:ring-[color:var(--maroon)]"
                      style={{
                        left: `${xPct(m.lng)}%`,
                        top: `${yPct(m.lat)}%`,
                        width: r,
                        height: r,
                        background:
                          'radial-gradient(circle at 35% 30%, var(--maroon), var(--maroon-700))',
                      }}
                      title={`${m.name}: ${formatFull(m.users)} مستخدم`}
                      aria-label={`${m.name}: ${formatFull(m.users)} مستخدم من ${formatFull(m.schools)} مدرسة`}
                    >
                      <span className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-[color:var(--maroon)] px-2 py-1 text-[11px] font-bold text-white shadow-lg group-hover:block">
                        {m.name} · {formatFull(m.users)} مستخدم
                      </span>
                    </button>
                  );
                })}

              {/* موقع مدرستك */}
              {mySchoolId &&
                (() => {
                  const s = QATAR_SCHOOLS.find((x) => x.id === mySchoolId);
                  if (!s) return null;
                  return (
                    <span
                      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full"
                      style={{ left: `${xPct(s.lng)}%`, top: `${yPct(s.lat)}%` }}
                      title="مدرستك"
                    >
                      <MapPin
                        className="h-5 w-5 text-[color:var(--gold)] drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
                        fill="currentColor"
                      />
                    </span>
                  );
                })()}
            </div>
          </div>

          {/* مفتاح التدرّج */}
          <div className="mx-auto mt-4 max-w-[300px]">
            <div
              className="h-2.5 w-full rounded-full ring-1 ring-inset ring-black/5"
              style={{
                background:
                  'linear-gradient(90deg, rgba(244,214,138,0.5), #e0aa34, #b02a54, #6a0f2e)',
              }}
            />
            <div className="mt-1 flex justify-between text-[11px] font-bold text-muted-foreground">
              <span>أقلّ تركيزًا</span>
              <span>أعلى تركيزًا</span>
            </div>
          </div>
        </div>

        {/* ترتيب المناطق */}
        <div className="min-w-0">
          <h3 className="mb-3 flex items-center gap-2 font-display text-base font-bold text-[color:var(--maroon)]">
            <MapPin className="h-4 w-4 text-[color:var(--gold)]" />
            ترتيب المناطق حسب عدد المستخدمين
          </h3>

          {loaded && total === 0 ? (
            <p className="rounded-2xl border border-dashed border-[color:var(--hairline-strong)] p-6 text-center text-sm text-muted-foreground">
              لا توجد بيانات بعد — ستتوهّج الخريطة تلقائيًا كلّما اختار المستخدمون
              مدارسهم قبل اللعب أو التحميل.
            </p>
          ) : (
            <ul className="space-y-3.5">
              {byMuni.map((m, i) => {
                const rank = i + 1;
                const isTop = m.users > 0 && rank <= 3;
                return (
                  <li key={m.id} title={`${m.name} — ${formatFull(m.users)} مستخدم`}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2 text-sm font-bold text-foreground">
                        <span
                          className={
                            'grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-black tabular-nums ' +
                            (isTop
                              ? 'bg-[color:var(--maroon)] text-white'
                              : 'bg-[color:var(--surface-2)] text-muted-foreground')
                          }
                        >
                          {rank}
                        </span>
                        <span className="truncate">{m.name}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-xs font-bold tabular-nums text-muted-foreground">
                        <span>{formatFull(m.users)} مستخدم</span>
                        <span className="rounded-md bg-[color:var(--surface-2)] px-1.5 py-0.5 text-[color:var(--maroon)]">
                          {formatPercent(m.users, total)}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[color:var(--surface-2)]">
                        <div
                          className="h-full rounded-full transition-[width] duration-[900ms] ease-out"
                          style={{
                            width: loaded ? `${(m.users / maxMuniUsers) * 100}%` : '0%',
                            background:
                              'linear-gradient(90deg, var(--gold), var(--maroon))',
                          }}
                        />
                      </div>
                      <span className="w-16 shrink-0 text-left text-[11px] font-medium text-muted-foreground tabular-nums">
                        {formatFull(m.schools)} مدرسة
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {explore && (
        <HeatmapExplorer
          stats={stats}
          mySchoolId={mySchoolId}
          onClose={() => setExplore(false)}
        />
      )}
    </figure>
  );
}
