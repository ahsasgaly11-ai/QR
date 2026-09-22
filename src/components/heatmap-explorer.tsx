'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Minus, Locate, GraduationCap } from 'lucide-react';
import {
  QATAR_SCHOOLS,
  MUNICIPALITIES,
  SCHOOL_BY_ID,
} from '@/data/qatar-schools';
import { QATAR_OUTLINE, QATAR_BBOX as GEO } from '@/data/qatar-geo';
import { formatFull } from '@/lib/utils';

// إسقاط: خط الطول/العرض → إحداثيات مُطبَّعة [0..1].
function normX(lng: number) {
  return (lng - GEO.lngMin) / (GEO.lngMax - GEO.lngMin);
}
function normY(lat: number) {
  return (GEO.latMax - lat) / (GEO.latMax - GEO.latMin);
}
const LAT_MID = (GEO.latMin + GEO.latMax) / 2;
const ASPECT =
  (GEO.latMax - GEO.latMin) /
  ((GEO.lngMax - GEO.lngMin) * Math.cos((LAT_MID * Math.PI) / 180));

// تدرّج الحرارة (ذهبي → عنّابي).
const RAMP: { t: number; c: [number, number, number]; a: number }[] = [
  { t: 0.0, c: [246, 224, 156], a: 0 },
  { t: 0.15, c: [244, 214, 138], a: 0.5 },
  { t: 0.4, c: [224, 170, 52], a: 0.74 },
  { t: 0.68, c: [176, 42, 84], a: 0.88 },
  { t: 1.0, c: [106, 15, 46], a: 0.96 },
];
function buildLUT(): Uint8ClampedArray {
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

interface Transform {
  scale: number;
  panX: number;
  panY: number;
  baseW: number;
  baseH: number;
}

type Rect = { x: number; y: number; w: number; h: number };
function overlaps(a: Rect, b: Rect) {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}

export function HeatmapExplorer({
  stats,
  mySchoolId,
  onClose,
}: {
  stats: Record<string, number>;
  mySchoolId: string | null;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const tRef = useRef<Transform>({ scale: 1, panX: 0, panY: 0, baseW: 1, baseH: 1 });
  const lutRef = useRef<Uint8ClampedArray | null>(null);
  const rafRef = useRef<number | null>(null);
  const dirtyRef = useRef(false);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ dist: number; cx: number; cy: number } | null>(null);
  const [scalePct, setScalePct] = useState(100);
  const [hint, setHint] = useState(true);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // البلديات النشِطة (لتلوين تسميات المناطق).
  const muniUsers = new Map<string, number>();
  for (const s of QATAR_SCHOOLS) {
    const c = stats[s.id] ?? 0;
    if (c > 0)
      muniUsers.set(s.municipalityId, (muniUsers.get(s.municipalityId) ?? 0) + c);
  }

  // --- رسم إطار كامل --------------------------------------------------------
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = wrap.clientWidth;
    const H = wrap.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const t = tRef.current;
    // إحداثيات الشاشة من المُطبَّعة.
    const sx = (nx: number) => nx * t.baseW * t.scale + t.panX;
    const sy = (ny: number) => ny * t.baseH * t.scale + t.panY;
    const SX = (lng: number) => sx(normX(lng));
    const SY = (lat: number) => sy(normY(lat));

    // مسار اليابسة (بإحداثيات الشاشة).
    const land = new Path2D();
    QATAR_OUTLINE.forEach(([lng, lat], i) => {
      const x = SX(lng);
      const y = SY(lat);
      if (i === 0) land.moveTo(x, y);
      else land.lineTo(x, y);
    });
    land.closePath();

    // ظلّ + تعبئة.
    ctx.save();
    ctx.shadowColor = 'rgba(106,15,46,0.30)';
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.fill(land);
    ctx.restore();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(168,140,74,0.16)');
    g.addColorStop(1, 'rgba(120,96,48,0.10)');
    ctx.fillStyle = g;
    ctx.fill(land);

    // --- طبقة الحرارة عالية الدقة (تُعاد بحسب التكبير) ---------------------
    const points = QATAR_SCHOOLS.map((s) => ({
      x: SX(s.lng),
      y: SY(s.lat),
      w: stats[s.id] ?? 0,
    })).filter((p) => p.w > 0 && p.x > -200 && p.x < W + 200 && p.y > -200 && p.y < H + 200);

    if (points.length > 0) {
      const RES = 0.6; // دقّة الشبكة (تُنعَّم لاحقًا بضبابية)
      const gw = Math.max(2, Math.round(W * RES));
      const gh = Math.max(2, Math.round(H * RES));
      const grid = new Float32Array(gw * gh);
      // نصف القطر يكبر مع التكبير → بؤر أدقّ عند التقريب.
      const R = Math.min(180, Math.max(22, t.baseW * 0.16 * t.scale)) * RES;
      const R2 = R * R;
      let gmax = 0;
      for (const p of points) {
        const cx = p.x * RES;
        const cy = p.y * RES;
        const x0 = Math.max(0, Math.floor(cx - R));
        const x1 = Math.min(gw - 1, Math.ceil(cx + R));
        const y0 = Math.max(0, Math.floor(cy - R));
        const y1 = Math.min(gh - 1, Math.ceil(cy + R));
        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) {
            const dx = x - cx;
            const dy = y - cy;
            const d2 = dx * dx + dy * dy;
            if (d2 > R2) continue;
            const fall = 1 - d2 / R2;
            const idx = y * gw + x;
            grid[idx] += p.w * fall * fall;
            if (grid[idx] > gmax) gmax = grid[idx];
          }
        }
      }
      if (gmax > 0) {
        const lut = (lutRef.current ??= buildLUT());
        const img = ctx.createImageData(gw, gh);
        const data = img.data;
        for (let i = 0; i < grid.length; i++) {
          const v = grid[i] / gmax;
          if (v <= 0) continue;
          const tt = Math.min(255, Math.round(Math.sqrt(v) * 255));
          const o = i * 4;
          const l = tt * 4;
          data[o] = lut[l];
          data[o + 1] = lut[l + 1];
          data[o + 2] = lut[l + 2];
          data[o + 3] = lut[l + 3];
        }
        const heat = document.createElement('canvas');
        heat.width = gw;
        heat.height = gh;
        heat.getContext('2d')!.putImageData(img, 0, 0);
        ctx.save();
        ctx.clip(land);
        ctx.imageSmoothingEnabled = true;
        ctx.filter = 'blur(4px)';
        ctx.drawImage(heat, 0, 0, W, H);
        ctx.filter = 'none';
        ctx.restore();
      }
    }

    // نقاط المدارس.
    ctx.save();
    ctx.clip(land);
    for (const s of QATAR_SCHOOLS) {
      const used = (stats[s.id] ?? 0) > 0;
      ctx.beginPath();
      ctx.arc(SX(s.lng), SY(s.lat), used ? 2.6 : 1.6, 0, Math.PI * 2);
      ctx.fillStyle = used ? 'rgba(106,15,46,0.9)' : 'rgba(106,15,46,0.3)';
      ctx.fill();
    }
    ctx.restore();

    // خطّ الساحل.
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.stroke(land);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = 'rgba(106,15,46,0.6)';
    ctx.stroke(land);

    // --- التسميات (تصادم بسيط لتفادي التداخل) -----------------------------
    const occupied: Rect[] = [];
    ctx.textBaseline = 'middle';
    (ctx as CanvasRenderingContext2D & { direction?: string }).direction = 'rtl';

    // 1) تسميات المناطق (البلديات) — دائمًا.
    ctx.textAlign = 'center';
    for (const m of MUNICIPALITIES) {
      const x = SX(m.lng);
      const y = SY(m.lat);
      if (x < 0 || x > W || y < 0 || y > H) continue;
      const users = muniUsers.get(m.id) ?? 0;
      const label = users > 0 ? `${m.name} · ${formatFull(users)}` : m.name;
      ctx.font = '800 15px Tajawal, sans-serif';
      const tw = ctx.measureText(label).width;
      const box: Rect = { x: x - tw / 2 - 8, y: y - 26, w: tw + 16, h: 20 };
      // خلفية حبّة.
      ctx.fillStyle = users > 0 ? 'rgba(138,21,56,0.95)' : 'rgba(90,72,40,0.82)';
      roundRect(ctx, box.x, box.y, box.w, box.h, 9);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(label, x, box.y + box.h / 2);
      occupied.push(box);
    }

    // 2) موقع «مدرستك».
    if (mySchoolId) {
      const s = SCHOOL_BY_ID[mySchoolId];
      if (s) {
        const x = SX(s.lng);
        const y = SY(s.lat);
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#e0aa34';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#fff';
        ctx.stroke();
        ctx.font = '800 13px Tajawal, sans-serif';
        const label = `مدرستك: ${s.name}`;
        const tw = ctx.measureText(label).width;
        const box: Rect = { x: x - tw / 2 - 7, y: y + 8, w: tw + 14, h: 18 };
        ctx.fillStyle = 'rgba(224,170,52,0.97)';
        roundRect(ctx, box.x, box.y, box.w, box.h, 8);
        ctx.fill();
        ctx.fillStyle = '#3a2a06';
        ctx.fillText(label, x, box.y + box.h / 2);
        occupied.push(box);
      }
    }

    // 3) أسماء المدارس — تظهر عند التكبير (scale ≥ 2)، مع تفادي التداخل.
    if (t.scale >= 2) {
      ctx.font = '700 12px Tajawal, sans-serif';
      // الأكثر استخدامًا أولًا لتُعرض تسمياتها عند الازدحام.
      const ordered = [...QATAR_SCHOOLS].sort(
        (a, b) => (stats[b.id] ?? 0) - (stats[a.id] ?? 0)
      );
      for (const s of ordered) {
        const x = SX(s.lng);
        const y = SY(s.lat);
        if (x < 4 || x > W - 4 || y < 4 || y > H - 4) continue;
        const tw = Math.min(180, ctx.measureText(s.name).width);
        const box: Rect = { x: x - tw / 2 - 5, y: y + 6, w: tw + 10, h: 16 };
        if (occupied.some((o) => overlaps(o, box))) continue;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        roundRect(ctx, box.x, box.y, box.w, box.h, 7);
        ctx.fill();
        ctx.fillStyle = '#5a1029';
        ctx.fillText(s.name, x, box.y + box.h / 2, 176);
        occupied.push(box);
      }
    }
  }, [stats, mySchoolId]);

  const requestDraw = useCallback(() => {
    dirtyRef.current = true;
    if (rafRef.current != null) return;
    const loop = () => {
      rafRef.current = null;
      if (dirtyRef.current) {
        dirtyRef.current = false;
        draw();
      }
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [draw]);

  // ضبط الإطار الأولي (احتواء الخريطة في المنتصف).
  const fit = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const W = wrap.clientWidth;
    const H = wrap.clientHeight;
    const pad = 40;
    let baseW = Math.min(W - pad, (H - pad) / ASPECT);
    baseW = Math.max(120, baseW);
    const baseH = baseW * ASPECT;
    tRef.current = {
      scale: 1,
      baseW,
      baseH,
      panX: (W - baseW) / 2,
      panY: (H - baseH) / 2,
    };
    setScalePct(100);
    requestDraw();
  }, [requestDraw]);

  useEffect(() => {
    if (!mounted) return;
    // ينتظر تخطيط القماش فعلًا قبل أوّل ضبط (وإلا كانت أبعاده صفرية).
    const raf = requestAnimationFrame(() => fit());
    const onResize = () => fit();
    window.addEventListener('resize', onResize);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    // قفل تمرير الصفحة خلف الطبقة.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [mounted, fit, onClose]);

  // تكبير حول نقطة (px,py بإحداثيات الشاشة).
  const zoomAt = useCallback(
    (factor: number, px: number, py: number) => {
      const t = tRef.current;
      const next = Math.min(9, Math.max(1, t.scale * factor));
      const k = next / t.scale;
      // حافظ على النقطة تحت المؤشّر ثابتة.
      t.panX = px - (px - t.panX) * k;
      t.panY = py - (py - t.panY) * k;
      t.scale = next;
      if (next === 1) fit();
      else {
        setScalePct(Math.round(next * 100));
        requestDraw();
      }
    },
    [fit, requestDraw]
  );

  // --- أحداث المؤشّر (سحب + تقريب باللمس) ----------------------------------
  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setHint(false);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchRef.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2,
      };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, cur);
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();

    if (pointers.current.size >= 2 && pinchRef.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2 - rect.left;
      const cy = (a.y + b.y) / 2 - rect.top;
      const factor = dist / (pinchRef.current.dist || dist);
      zoomAt(factor, cx, cy);
      pinchRef.current.dist = dist;
    } else if (pointers.current.size === 1) {
      const t = tRef.current;
      t.panX += cur.x - prev.x;
      t.panY += cur.y - prev.y;
      requestDraw();
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchRef.current = null;
  };
  const onWheel = (e: React.WheelEvent) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    zoomAt(factor, e.clientX - rect.left, e.clientY - rect.top);
  };

  const btn =
    'grid h-11 w-11 place-items-center rounded-xl bg-[color:var(--surface)] text-[color:var(--maroon)] shadow-md ring-1 ring-[color:var(--hairline)] transition hover:bg-[color:var(--surface-2)]';

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex flex-col bg-[color:var(--surface)]">
      {/* شريط علوي */}
      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--hairline)] bg-[color:var(--surface)]/90 px-4 py-2.5 backdrop-blur">
        <h2 className="flex min-w-0 items-center gap-2 font-display text-base font-bold text-[color:var(--maroon)] sm:text-lg">
          <GraduationCap className="h-5 w-5 shrink-0 text-[color:var(--gold)]" />
          <span className="truncate">الخريطة الحرارية — عرض كامل</span>
        </h2>
        <button
          onClick={onClose}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[color:var(--maroon)] px-3 py-2 text-sm font-black text-white transition hover:bg-[color:var(--maroon-700)]"
        >
          <X className="h-4 w-4" /> إغلاق
        </button>
      </div>

      {/* لوحة الخريطة */}
      <div
        ref={wrapRef}
        className="relative min-h-0 flex-1 touch-none overflow-hidden bg-gradient-to-b from-[color:var(--surface)] to-[color:var(--surface-2)]/60"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        style={{ cursor: 'grab' }}
      >
        <canvas ref={canvasRef} className="block h-full w-full" />

        {/* تلميح الاستخدام */}
        {hint && (
          <div className="pointer-events-none absolute bottom-20 left-1/2 max-w-[90vw] -translate-x-1/2 rounded-full bg-[color:var(--maroon)]/90 px-4 py-1.5 text-center text-[11px] font-bold text-white shadow-lg sm:text-xs">
            اسحب للتحريك · قرّب بإصبعين أو بعجلة الفأرة · كبّر لإظهار أسماء المدارس
          </div>
        )}

        {/* أزرار التكبير */}
        <div className="absolute bottom-5 left-4 flex flex-col gap-2">
          <button
            className={btn}
            aria-label="تكبير"
            onClick={() => {
              const w = wrapRef.current;
              if (w) zoomAt(1.4, w.clientWidth / 2, w.clientHeight / 2);
            }}
          >
            <Plus className="h-5 w-5" />
          </button>
          <button
            className={btn}
            aria-label="تصغير"
            onClick={() => {
              const w = wrapRef.current;
              if (w) zoomAt(1 / 1.4, w.clientWidth / 2, w.clientHeight / 2);
            }}
          >
            <Minus className="h-5 w-5" />
          </button>
          <button className={btn} aria-label="إعادة الضبط" onClick={fit}>
            <Locate className="h-5 w-5" />
          </button>
        </div>

        {/* مؤشّر نسبة التكبير */}
        <div className="absolute bottom-5 right-4 rounded-full bg-[color:var(--surface)]/90 px-3 py-1.5 text-xs font-black tabular-nums text-[color:var(--maroon)] shadow ring-1 ring-[color:var(--hairline)]">
          {scalePct}%
        </div>

        {/* مفتاح التدرّج */}
        <div className="absolute left-4 top-4 w-40 rounded-xl bg-[color:var(--surface)]/90 p-2.5 shadow ring-1 ring-[color:var(--hairline)]">
          <div
            className="h-2 w-full rounded-full"
            style={{
              background:
                'linear-gradient(90deg, rgba(244,214,138,0.5), #e0aa34, #b02a54, #6a0f2e)',
            }}
          />
          <div className="mt-1 flex justify-between text-[10px] font-bold text-muted-foreground">
            <span>أقلّ</span>
            <span>أعلى تركيزًا</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
