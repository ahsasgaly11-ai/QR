'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Flame, Users, GraduationCap } from 'lucide-react';
import {
  QATAR_SCHOOLS,
  MUNICIPALITIES,
  MUNICIPALITY_BY_ID,
  type MunicipalityId,
} from '@/data/qatar-schools';
import { getSchoolStats } from '@/lib/school-store';
import { getSelectedSchool } from '@/lib/school-store';
import { formatFull } from '@/lib/utils';

// --- إسقاط جغرافي ثابت يحيط بشبه جزيرة قطر ----------------------------------
const GEO = { lngMin: 50.7, lngMax: 51.7, latMin: 24.5, latMax: 26.2 };
const LAT_MID = (GEO.latMin + GEO.latMax) / 2;
// نسبة الارتفاع/العرض بعد تصحيح تقارب خطوط الطول عند خط عرض قطر.
const ASPECT =
  (GEO.latMax - GEO.latMin) /
  ((GEO.lngMax - GEO.lngMin) * Math.cos((LAT_MID * Math.PI) / 180));

function xPct(lng: number) {
  return ((lng - GEO.lngMin) / (GEO.lngMax - GEO.lngMin)) * 100;
}
function yPct(lat: number) {
  return ((GEO.latMax - lat) / (GEO.latMax - GEO.latMin)) * 100;
}

// مخطّط تقريبي لحدود قطر (خط الطول، خط العرض) — خلفية جغرافية للخريطة.
const QATAR_OUTLINE: [number, number][] = [
  [50.75, 24.56], [50.8, 24.71], [50.82, 24.95], [51.02, 25.18],
  [51.0, 25.4], [50.9, 25.6], [51.02, 25.83], [51.09, 26.02],
  [51.18, 26.15], [51.32, 26.08], [51.42, 25.92], [51.6, 25.9],
  [51.56, 25.7], [51.48, 25.55], [51.6, 25.4], [51.58, 25.3],
  [51.53, 25.2], [51.61, 25.05], [51.53, 24.88], [51.38, 24.68],
  [51.2, 24.62], [50.95, 24.55], [50.75, 24.56],
];

// --- تدرّج لوني تسلسلي أحادي العائلة (ذهبي → عنّابي) للمقدار ------------------
// منخفض → مرتفع، مع ألفا يتصاعد من الشفافية. (خريطة كثافة = مقدار = تدرّج واحد.)
const RAMP: { t: number; c: [number, number, number]; a: number }[] = [
  { t: 0.0, c: [244, 214, 138], a: 0 },
  { t: 0.18, c: [244, 214, 138], a: 0.55 },
  { t: 0.42, c: [217, 167, 46], a: 0.72 },
  { t: 0.7, c: [168, 36, 78], a: 0.85 },
  { t: 1.0, c: [106, 15, 46], a: 0.92 },
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
    const span = hi.t - lo.t || 1;
    const f = (t - lo.t) / span;
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
  users: number;
  schools: number;
}

export function UserHeatmap({
  className = '',
}: {
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(false);
  const [size, setSize] = useState({ w: 300, h: 300 * ASPECT });
  const [mySchoolId, setMySchoolId] = useState<string | null>(null);
  const lutRef = useRef<Uint8ClampedArray | null>(null);

  useEffect(() => {
    getSchoolStats().then((s) => {
      setStats(s);
      setLoaded(true);
    });
    setMySchoolId(getSelectedSchool()?.id ?? null);
  }, []);

  // قياس عرض الحاوية → الحفاظ على نسبة شكل قطر.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = Math.min(el.clientWidth, 340);
      setSize({ w, h: w * ASPECT });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const total = useMemo(
    () => Object.values(stats).reduce((n, v) => n + (v || 0), 0),
    [stats]
  );

  // تجميع حسب البلدية للجدول والفقاعات.
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
      users: users.get(m.id) ?? 0,
      schools: schools.get(m.id) ?? 0,
    })).sort((a, b) => b.users - a.users || b.schools - a.schools);
  }, [stats]);

  const maxMuniUsers = Math.max(1, ...byMuni.map((m) => m.users));

  // --- رسم الخريطة الحرارية على القماش -------------------------------------
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

    // مسار حدود قطر.
    const landPath = new Path2D();
    QATAR_OUTLINE.forEach(([lng, lat], i) => {
      const x = px(lng);
      const y = py(lat);
      if (i === 0) landPath.moveTo(x, y);
      else landPath.lineTo(x, y);
    });
    landPath.closePath();

    // أرضية اليابسة.
    ctx.fillStyle = 'rgba(148,120,60,0.10)';
    ctx.fill(landPath);

    // بناء طبقة الحرارة على شبكة (تراكم شعاعي موزون بعدد المستخدمين).
    const points = QATAR_SCHOOLS.map((s) => ({
      x: px(s.lng),
      y: py(s.lat),
      w: stats[s.id] ?? 0,
    })).filter((p) => p.w > 0);

    if (points.length > 0) {
      const grid = new Float32Array(W * H);
      const R = Math.max(26, W * 0.17);
      const R2 = R * R;
      let gmax = 0;
      for (const p of points) {
        const cx = Math.round(p.x);
        const cy = Math.round(p.y);
        const x0 = Math.max(0, cx - R);
        const x1 = Math.min(W - 1, cx + R);
        const y0 = Math.max(0, cy - R);
        const y1 = Math.min(H - 1, cy + R);
        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) {
            const dx = x - p.x;
            const dy = y - p.y;
            const d2 = dx * dx + dy * dy;
            if (d2 > R2) continue;
            const fall = 1 - d2 / R2; // سقوط سلس
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
          const v = grid[i] / gmax; // تطبيع 0..1
          if (v <= 0) continue;
          // إبراز التباين قليلًا في الطرف المنخفض.
          const t = Math.min(255, Math.round(Math.sqrt(v) * 255));
          const o = i * 4;
          const l = t * 4;
          data[o] = lut[l];
          data[o + 1] = lut[l + 1];
          data[o + 2] = lut[l + 2];
          data[o + 3] = lut[l + 3];
        }
        // اقصر الحرارة داخل اليابسة.
        const heat = document.createElement('canvas');
        heat.width = W;
        heat.height = H;
        heat.getContext('2d')!.putImageData(img, 0, 0);
        ctx.save();
        ctx.clip(landPath);
        ctx.drawImage(heat, 0, 0);
        ctx.restore();
      }
    }

    // نقاط المدارس الخفيفة (سياق: أين المدارس فعلًا).
    ctx.fillStyle = 'rgba(106,15,46,0.28)';
    for (const s of QATAR_SCHOOLS) {
      ctx.beginPath();
      ctx.arc(px(s.lng), py(s.lat), 1.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // حدود قطر.
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = 'rgba(106,15,46,0.55)';
    ctx.stroke(landPath);
  }, [size, stats]);

  return (
    <figure
      className={`card-premium rounded-2xl p-4 sm:rounded-3xl sm:p-7 ${className}`}
    >
      <figcaption className="mb-4 flex items-center gap-2 sm:mb-6">
        <Flame className="h-5 w-5 text-[color:var(--maroon)]" />
        <h2 className="font-display text-lg font-bold text-[color:var(--maroon)]">
          الخريطة الحرارية لمستخدمي الألعاب حسب المدرسة
        </h2>
      </figcaption>

      <div className="grid gap-6 lg:grid-cols-[auto_1fr] lg:items-start">
        {/* الخريطة */}
        <div className="mx-auto w-full max-w-[340px]">
          <div ref={wrapRef} className="relative mx-auto" style={{ width: size.w, height: size.h }}>
            <canvas
              ref={canvasRef}
              style={{ width: size.w, height: size.h }}
              className="block"
              role="img"
              aria-label="خريطة قطر الحرارية لتركيز مستخدمي الألعاب التعليمية حسب موقع المدرسة"
            />

            {/* فقاعات البلديات: تفاعل + عنوان عند التمرير */}
            {MUNICIPALITIES.map((m) => {
              const agg = byMuni.find((x) => x.id === m.id);
              const users = agg?.users ?? 0;
              if (users === 0) return null;
              const r = 7 + (users / maxMuniUsers) * 13;
              return (
                <button
                  key={m.id}
                  className="group absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 shadow-md outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--maroon)]"
                  style={{
                    left: `${xPct(m.lng)}%`,
                    top: `${yPct(m.lat)}%`,
                    width: r,
                    height: r,
                    background: 'radial-gradient(circle, var(--maroon), var(--maroon-700))',
                  }}
                  title={`${m.name}: ${formatFull(users)} مستخدم`}
                  aria-label={`${m.name}: ${formatFull(users)} مستخدم من ${formatFull(
                    agg?.schools ?? 0
                  )} مدرسة`}
                >
                  <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-[color:var(--maroon)] px-2 py-1 text-[11px] font-bold text-white shadow-lg group-hover:block">
                    {m.name} · {formatFull(users)}
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
                    className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${xPct(s.lng)}%`, top: `${yPct(s.lat)}%` }}
                    title="مدرستك"
                  >
                    <MapPin className="h-5 w-5 text-[color:var(--gold)] drop-shadow" fill="currentColor" />
                  </span>
                );
              })()}
          </div>

          {/* مفتاح التدرّج */}
          <div className="mx-auto mt-4 max-w-[300px]">
            <div
              className="h-2.5 w-full rounded-full"
              style={{
                background:
                  'linear-gradient(90deg, rgba(244,214,138,0.55), #d9a72e, #a8244e, #6a0f2e)',
              }}
            />
            <div className="mt-1 flex justify-between text-[11px] font-bold text-muted-foreground">
              <span>أقلّ تركيزًا</span>
              <span>أعلى تركيزًا</span>
            </div>
          </div>
        </div>

        {/* الجدول: العرض الميسّر للبيانات (لا يعتمد على اللون وحده) */}
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-[color:var(--maroon)]" />
              {formatFull(total)} مستخدم
            </span>
            <span className="flex items-center gap-1.5">
              <GraduationCap className="h-4 w-4 text-[color:var(--maroon)]" />
              {formatFull(QATAR_SCHOOLS.length)} مدرسة في {MUNICIPALITIES.length} بلديات
            </span>
          </div>

          {loaded && total === 0 ? (
            <p className="rounded-2xl border border-dashed border-[color:var(--hairline-strong)] p-6 text-center text-sm text-muted-foreground">
              لا توجد بيانات بعد — ستتوهّج الخريطة تلقائيًا كلّما اختار المستخدمون
              مدارسهم قبل اللعب أو التحميل.
            </p>
          ) : (
            <ul className="space-y-3">
              {byMuni.map((m) => (
                <li key={m.id} title={`${m.name} — ${formatFull(m.users)} مستخدم`}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-[color:var(--gold)]" />
                      <span className="truncate">{m.name}</span>
                    </span>
                    <span className="shrink-0 text-xs font-bold tabular-nums text-muted-foreground">
                      {formatFull(m.users)} مستخدم · {formatFull(m.schools)} مدرسة
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-[color:var(--surface-2)]">
                    <div
                      className="h-full rounded-full transition-[width] duration-[900ms] ease-out"
                      style={{
                        width: loaded ? `${(m.users / maxMuniUsers) * 100}%` : '0%',
                        background: 'linear-gradient(90deg, var(--gold), var(--maroon))',
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </figure>
  );
}
