'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Plus, Minus, Locate, GraduationCap, Search, Play, Pause,
  Flame, LayoutGrid, Download, FileText, MapPin,
} from 'lucide-react';
import {
  QATAR_SCHOOLS,
  MUNICIPALITIES,
  SCHOOL_BY_ID,
  MUNICIPALITY_BY_ID,
  searchSchools,
  type MunicipalityId,
} from '@/data/qatar-schools';
import {
  QATAR_OUTLINE,
  QATAR_BBOX as GEO,
  MUNICIPALITY_SHAPES,
} from '@/data/qatar-geo';
import {
  normX, normY, buildHeatLUT, rampColor, HEAT_GRADIENT_CSS,
  pointInRings, isDarkTheme, lastNDays, usersUpToDay, metricValue,
  METRIC_LABEL, METRIC_UNIT, type MetricKey, type MapMode, type SchoolMetric,
} from '@/lib/heatmap-shared';
import { formatFull } from '@/lib/utils';

interface Transform { scale: number; panX: number; panY: number; baseW: number; baseH: number; }
type Rect = { x: number; y: number; w: number; h: number };
function overlaps(a: Rect, b: Rect) {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}
/** أقصى تكبير (8000%) — مرتفع بما يكفي لتنفصل تسميات المدارس المتجاورة (بعضها على بُعد عشرات الأمتار). */
const MAX_SCALE = 80;
/** من هذا التكبير تُكدَّس أسماء المدارس المتلاصقة بدل إخفائها. */
const STACK_SCALE = 20;
const SHAPE_BY_ID = Object.fromEntries(MUNICIPALITY_SHAPES.map((s) => [s.id, s]));

export function HeatmapExplorer({
  metrics,
  mySchoolId,
  onClose,
}: {
  metrics: Record<string, SchoolMetric>;
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
  const pinchRef = useRef<{ dist: number } | null>(null);
  const downRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const interactingRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealRef = useRef(0);
  const tlTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // حالة الواجهة (مرآة) + مراجع يقرؤها الرسم (لتفادي إعادة الضبط عند كل تغيير).
  const [metric, setMetricS] = useState<MetricKey>('users');
  const [mode, setModeS] = useState<MapMode>('heat');
  const [selMuni, setSelMuniS] = useState<MunicipalityId | null>(null);
  const [tlDay, setTlDayS] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [highlightId, setHighlightS] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ name: string; value: number; unit: string; x: number; y: number } | null>(null);
  const [scalePct, setScalePct] = useState(100);
  const [hint, setHint] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const metricRef = useRef(metric);
  const modeRef = useRef(mode);
  const muniRef = useRef(selMuni);
  const tlRef = useRef(tlDay);
  const highlightRef = useRef(highlightId);
  const metricsRef = useRef(metrics);
  const myRef = useRef(mySchoolId);
  useEffect(() => { metricsRef.current = metrics; }, [metrics]);
  useEffect(() => { myRef.current = mySchoolId; }, [mySchoolId]);
  useEffect(() => setMounted(true), []);

  const days = useMemo(() => lastNDays(30), []);

  // قيمة المدرسة حسب المقياس/الخطّ الزمني الحاليَّين.
  const valueOf = useCallback(
    (schoolId: string): number => {
      const m = metricsRef.current[schoolId];
      if (tlRef.current !== null) return usersUpToDay(m, days, tlRef.current);
      return metricValue(m, metricRef.current);
    },
    [days]
  );

  // --- الرسم ----------------------------------------------------------------
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

    const dark = isDarkTheme();
    const reveal = revealRef.current;
    const t = tRef.current;
    const SX = (lng: number) => normX(lng) * t.baseW * t.scale + t.panX;
    const SY = (lat: number) => normY(lat) * t.baseH * t.scale + t.panY;
    const mode = modeRef.current;
    const selMuni = muniRef.current;

    const pathOf = (rings: [number, number][][]) => {
      const p = new Path2D();
      for (const ring of rings) {
        ring.forEach(([lng, lat], i) => {
          const x = SX(lng), y = SY(lat);
          if (i === 0) p.moveTo(x, y); else p.lineTo(x, y);
        });
        p.closePath();
      }
      return p;
    };

    // قِيَم البلديات (تجميع مدارسها).
    const muniVal = new Map<MunicipalityId, number>();
    for (const s of QATAR_SCHOOLS) {
      const v = valueOf(s.id);
      if (v > 0) muniVal.set(s.municipalityId, (muniVal.get(s.municipalityId) ?? 0) + v);
    }
    const maxMuni = Math.max(1, ...muniVal.values());

    // خلفية اليابسة (المخطّط العام) — تُعطي إطارًا في وضع الحرارة.
    const land = pathOf([QATAR_OUTLINE]);
    ctx.save();
    ctx.shadowColor = dark ? 'rgba(0,0,0,0.5)' : 'rgba(106,15,46,0.28)';
    ctx.shadowBlur = 24; ctx.shadowOffsetY = 7;
    ctx.fillStyle = dark ? 'rgba(40,26,28,0.96)' : 'rgba(255,255,255,0.96)';
    ctx.fill(land);
    ctx.restore();

    if (mode === 'regions') {
      // --- تلوين المناطق (choropleth) ---
      for (const shp of MUNICIPALITY_SHAPES) {
        const val = muniVal.get(shp.id as MunicipalityId) ?? 0;
        const tNorm = val / maxMuni;
        const p = pathOf(shp.rings);
        const dim = selMuni && selMuni !== shp.id ? 0.35 : 1;
        ctx.fillStyle = val > 0
          ? rampColor(0.15 + tNorm * 0.85, (dark ? 0.9 : 0.92) * reveal * dim)
          : (dark ? 'rgba(255,255,255,0.04)' : 'rgba(120,96,48,0.06)');
        ctx.fill(p);
        ctx.lineJoin = 'round';
        ctx.lineWidth = selMuni === shp.id ? 2.6 : 1.1;
        ctx.strokeStyle = selMuni === shp.id
          ? (dark ? '#e3c26b' : '#6a0f2e')
          : (dark ? 'rgba(245,236,228,0.25)' : 'rgba(106,15,46,0.35)');
        ctx.stroke(p);
      }
    } else {
      // --- الحرارة ---
      const gfill = ctx.createLinearGradient(0, 0, 0, H);
      gfill.addColorStop(0, dark ? 'rgba(120,96,48,0.14)' : 'rgba(168,140,74,0.14)');
      gfill.addColorStop(1, dark ? 'rgba(80,64,32,0.10)' : 'rgba(120,96,48,0.09)');
      ctx.fillStyle = gfill;
      ctx.fill(land);

      const pts = QATAR_SCHOOLS.map((s) => ({ x: SX(s.lng), y: SY(s.lat), w: valueOf(s.id) }))
        .filter((p) => p.w > 0 && p.x > -220 && p.x < W + 220 && p.y > -220 && p.y < H + 220);
      if (pts.length > 0) {
        const RES = interactingRef.current ? 0.4 : 0.6;
        const gw = Math.max(2, Math.round(W * RES));
        const gh = Math.max(2, Math.round(H * RES));
        const grid = new Float32Array(gw * gh);
        const R = Math.min(170, Math.max(22, t.baseW * 0.16 * t.scale)) * RES;
        const R2 = R * R;
        let gmax = 0;
        for (const p of pts) {
          const cx = p.x * RES, cy = p.y * RES;
          const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(gw - 1, Math.ceil(cx + R));
          const y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(gh - 1, Math.ceil(cy + R));
          for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
            const dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy;
            if (d2 > R2) continue;
            const fall = 1 - d2 / R2;
            const idx = y * gw + x;
            grid[idx] += p.w * fall * fall;
            if (grid[idx] > gmax) gmax = grid[idx];
          }
        }
        if (gmax > 0) {
          const lut = (lutRef.current ??= buildHeatLUT());
          const img = ctx.createImageData(gw, gh);
          const data = img.data;
          for (let i = 0; i < grid.length; i++) {
            const v = grid[i] / gmax;
            if (v <= 0) continue;
            const tt = Math.min(255, Math.round(Math.sqrt(v) * 255));
            const o = i * 4, l = tt * 4;
            data[o] = lut[l]; data[o + 1] = lut[l + 1]; data[o + 2] = lut[l + 2];
            data[o + 3] = lut[l + 3] * reveal;
          }
          const heat = document.createElement('canvas');
          heat.width = gw; heat.height = gh;
          heat.getContext('2d')!.putImageData(img, 0, 0);
          ctx.save(); ctx.clip(land);
          ctx.imageSmoothingEnabled = true;
          if (!interactingRef.current) ctx.filter = 'blur(4px)';
          ctx.drawImage(heat, 0, 0, W, H);
          ctx.filter = 'none'; ctx.restore();
        }
      }
    }

    // ساحل قطر (حدّ مزدوج) في وضع الحرارة.
    if (mode === 'heat') {
      ctx.lineJoin = 'round';
      ctx.lineWidth = 3; ctx.strokeStyle = dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.7)';
      ctx.stroke(land);
      ctx.lineWidth = 1.3; ctx.strokeStyle = dark ? 'rgba(227,194,107,0.5)' : 'rgba(106,15,46,0.6)';
      ctx.stroke(land);
    }

    // نقاط المدارس (حجمها حسب القيمة) + الإبراز.
    // بلا قصّ على حدود اليابسة: المخطّط الساحلي مبسّط، فبعض المدارس الساحلية
    // (الثمامة، الدفنة…) تقع خارجه وكانت تختفي من الخريطة.
    const maxSchool = Math.max(1, ...QATAR_SCHOOLS.map((s) => valueOf(s.id)));
    for (const s of QATAR_SCHOOLS) {
      const v = valueOf(s.id);
      const x = SX(s.lng), y = SY(s.lat);
      const r = v > 0 ? 2 + Math.sqrt(v / maxSchool) * 3.5 : 1.4;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = v > 0
        ? (dark ? 'rgba(227,194,107,0.85)' : 'rgba(106,15,46,0.85)')
        : (dark ? 'rgba(245,236,228,0.22)' : 'rgba(106,15,46,0.25)');
      ctx.fill();
    }

    // --- التسميات (تصادم بسيط) ---
    const occupied: Rect[] = [];
    ctx.textBaseline = 'middle';
    (ctx as CanvasRenderingContext2D & { direction?: string }).direction = 'rtl';
    ctx.textAlign = 'center';
    for (const m of MUNICIPALITIES) {
      const shp = SHAPE_BY_ID[m.id];
      const cx = shp ? shp.centroid[0] : m.lng;
      const cy = shp ? shp.centroid[1] : m.lat;
      const x = SX(cx), y = SY(cy);
      if (x < 0 || x > W || y < 0 || y > H) continue;
      const val = muniVal.get(m.id) ?? 0;
      const label = val > 0 ? `${m.name} · ${formatFull(val)}` : m.name;
      ctx.font = '800 15px Tajawal, sans-serif';
      const tw = ctx.measureText(label).width;
      const box: Rect = { x: x - tw / 2 - 8, y: y - 10, w: tw + 16, h: 20 };
      ctx.fillStyle = val > 0 ? 'rgba(138,21,56,0.95)' : 'rgba(90,72,40,0.82)';
      roundRect(ctx, box.x, box.y, box.w, box.h, 9); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(label, x, box.y + box.h / 2);
      occupied.push(box);
    }

    // موقع «مدرستك» + مدرسة مبحوث عنها.
    const markSchool = (id: string, color: string, label: string) => {
      const s = SCHOOL_BY_ID[id];
      if (!s) return;
      const x = SX(s.lng), y = SY(s.lat);
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.font = '800 13px Tajawal, sans-serif';
      const full = `${label}: ${s.name}`;
      const tw = ctx.measureText(full).width;
      // فوق النقطة: أسفلها غالبًا مدارس المجمّع نفسه فلا تُغطّى نقاطها.
      const box: Rect = { x: x - tw / 2 - 7, y: y - 27, w: tw + 14, h: 18 };
      ctx.fillStyle = color; roundRect(ctx, box.x, box.y, box.w, box.h, 8); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText(full, x, box.y + box.h / 2);
      occupied.push(box);
    };
    if (highlightRef.current) markSchool(highlightRef.current, '#8a173e', 'المدرسة');
    if (myRef.current && myRef.current !== highlightRef.current) {
      const s = SCHOOL_BY_ID[myRef.current];
      if (s) markSchool(myRef.current, 'rgba(224,170,52,0.97)', 'مدرستك');
    }

    // أسماء المدارس عند التكبير (≥ 200%).
    if (t.scale >= 2) {
      ctx.font = '700 12px Tajawal, sans-serif';
      // الأقرب إلى وسط الشاشة أولًا: المدرسة التي تُكبِّر عندها يظهر اسمها دائمًا.
      const cx = W / 2, cy = H / 2;
      const ordered = QATAR_SCHOOLS
        .map((s) => ({ s, d: Math.hypot(SX(s.lng) - cx, SY(s.lat) - cy) }))
        .sort((a, b) => a.d - b.d || valueOf(b.s.id) - valueOf(a.s.id))
        .map((o) => o.s);
      for (const s of ordered) {
        // المدرسة المبرَزة/مدرستك لها تسميتها الخاصة أعلاه.
        if (s.id === highlightRef.current || s.id === myRef.current) continue;
        const x = SX(s.lng), y = SY(s.lat);
        if (x < 4 || x > W - 4 || y < 4 || y > H - 4) continue;
        const tw = Math.min(180, ctx.measureText(s.name).width);
        const bw = tw + 10, bh = 16;
        // مواضع بديلة (أسفل/أعلى/يسار/يمين النقطة، ثم مكدّسة أبعد مع خطّ دالّ)
        // حتى لا يُحذف اسم لمجرّد تجاوره مع مدارس قريبة؛ فمن تكبير ≈ 4000% تظهر
        // أسماء كل المدارس حتى في المجمّعات المتلاصقة.
        const cands = [
          { x: x - bw / 2, y: y + 6 },
          { x: x - bw / 2, y: y - 6 - bh },
          { x: x - bw - 7, y: y - bh / 2 },
          { x: x + 7, y: y - bh / 2 },
        ];
        // التكديس عند التكبير العالي فقط، وإلا ابتعدت الأسماء عن مدارسها وازدحمت الخريطة.
        if (t.scale >= STACK_SCALE) for (let k = 1; k <= 4; k++) {
          cands.push({ x: x - bw / 2, y: y + 6 + k * (bh + 3) }, { x: x - bw / 2, y: y - 6 - bh - k * (bh + 3) });
        }
        const idx = cands.findIndex((p) => !occupied.some((o) => overlaps(o, { x: p.x, y: p.y, w: bw, h: bh })));
        if (idx === -1) continue;
        const box: Rect = { x: cands[idx].x, y: cands[idx].y, w: bw, h: bh };
        if (idx >= 4) {
          ctx.beginPath(); ctx.moveTo(x, y);
          ctx.lineTo(x, box.y > y ? box.y : box.y + bh);
          ctx.lineWidth = 1; ctx.strokeStyle = dark ? 'rgba(227,194,107,0.6)' : 'rgba(90,16,41,0.5)';
          ctx.stroke();
        }
        ctx.fillStyle = dark ? 'rgba(28,19,21,0.9)' : 'rgba(255,255,255,0.9)';
        roundRect(ctx, box.x, box.y, box.w, box.h, 7); ctx.fill();
        ctx.fillStyle = dark ? '#e3c26b' : '#5a1029';
        ctx.fillText(s.name, box.x + bw / 2, box.y + bh / 2, 176);
        occupied.push(box);
      }
    }
  }, [valueOf]);

  const requestDraw = useCallback(() => {
    dirtyRef.current = true;
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (dirtyRef.current) { dirtyRef.current = false; draw(); }
    });
  }, [draw]);

  const markInteracting = useCallback(() => {
    interactingRef.current = true;
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      interactingRef.current = false;
      requestDraw();
    }, 180);
  }, [requestDraw]);

  const fit = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const W = wrap.clientWidth, H = wrap.clientHeight;
    const pad = 48;
    let baseW = Math.min(W - pad, (H - pad) / (((GEO.latMax - GEO.latMin) / ((GEO.lngMax - GEO.lngMin) * Math.cos((((GEO.latMin + GEO.latMax) / 2) * Math.PI) / 180)))));
    baseW = Math.max(120, baseW);
    const baseH = baseW * ((GEO.latMax - GEO.latMin) / ((GEO.lngMax - GEO.lngMin) * Math.cos((((GEO.latMin + GEO.latMax) / 2) * Math.PI) / 180)));
    tRef.current = { scale: 1, baseW, baseH, panX: (W - baseW) / 2, panY: (H - baseH) / 2 };
    setScalePct(100);
    requestDraw();
  }, [requestDraw]);

  // فتح: ضبط + حركة ظهور + مستمعات.
  useEffect(() => {
    if (!mounted) return;
    const raf = requestAnimationFrame(() => {
      fit();
      // حركة ظهور تدريجية.
      revealRef.current = 0;
      const start = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - start) / 650);
        revealRef.current = p * p * (3 - 2 * p);
        requestDraw();
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    const onResize = () => fit();
    window.addEventListener('resize', onResize);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (tlTimerRef.current) clearInterval(tlTimerRef.current);
    };
  }, [mounted, fit, onClose, requestDraw]);

  const zoomAt = useCallback((factor: number, px: number, py: number) => {
    const t = tRef.current;
    const next = Math.min(MAX_SCALE, Math.max(1, t.scale * factor));
    const k = next / t.scale;
    t.panX = px - (px - t.panX) * k;
    t.panY = py - (py - t.panY) * k;
    t.scale = next;
    markInteracting();
    if (next === 1) fit(); else { setScalePct(Math.round(next * 100)); requestDraw(); }
  }, [fit, requestDraw, markInteracting]);

  // إسقاط عكسي (شاشة → خط الطول/العرض).
  const toGeo = (sx: number, sy: number) => {
    const t = tRef.current;
    const nx = (sx - t.panX) / (t.baseW * t.scale);
    const ny = (sy - t.panY) / (t.baseH * t.scale);
    return {
      lng: GEO.lngMin + nx * (GEO.lngMax - GEO.lngMin),
      lat: GEO.latMax - ny * (GEO.latMax - GEO.latMin),
    };
  };
  const schoolAt = (sx: number, sy: number) => {
    const t = tRef.current;
    let best: string | null = null, bestD = 15 * 15;
    for (const s of QATAR_SCHOOLS) {
      const x = normX(s.lng) * t.baseW * t.scale + t.panX;
      const y = normY(s.lat) * t.baseH * t.scale + t.panY;
      const d = (x - sx) * (x - sx) + (y - sy) * (y - sy);
      if (d < bestD) { bestD = d; best = s.id; }
    }
    return best;
  };

  // --- أحداث المؤشّر --------------------------------------------------------
  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    downRef.current = { x: e.clientX, y: e.clientY, moved: false };
    setHint(false); setTooltip(null);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchRef.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const wrap = wrapRef.current; if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    if (pointers.current.size === 0) {
      // تحويم (فأرة): تلميح المدرسة الأقرب.
      const id = schoolAt(e.clientX - rect.left, e.clientY - rect.top);
      if (id) {
        const s = SCHOOL_BY_ID[id];
        setTooltip({ name: s.name, value: valueOf(id), unit: METRIC_UNIT[tlRef.current !== null ? 'users' : metricRef.current], x: e.clientX - rect.left, y: e.clientY - rect.top });
      } else setTooltip(null);
      return;
    }
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, cur);
    if (downRef.current && Math.hypot(cur.x - downRef.current.x, cur.y - downRef.current.y) > 6) downRef.current.moved = true;
    if (pointers.current.size >= 2 && pinchRef.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2 - rect.left, cy = (a.y + b.y) / 2 - rect.top;
      zoomAt(dist / (pinchRef.current.dist || dist), cx, cy);
      pinchRef.current.dist = dist;
    } else if (pointers.current.size === 1) {
      const t = tRef.current;
      t.panX += cur.x - prev.x; t.panY += cur.y - prev.y;
      markInteracting(); requestDraw();
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const wrap = wrapRef.current;
    const tapped = downRef.current && !downRef.current.moved && pointers.current.size === 1;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchRef.current = null;
    if (tapped && wrap) {
      const rect = wrap.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      const id = schoolAt(sx, sy);
      if (id) {
        const s = SCHOOL_BY_ID[id];
        setTooltip({ name: s.name, value: valueOf(id), unit: METRIC_UNIT[tlRef.current !== null ? 'users' : metricRef.current], x: sx, y: sy });
      } else {
        const g = toGeo(sx, sy);
        const hit = MUNICIPALITY_SHAPES.find((shp) => pointInRings(g.lng, g.lat, shp.rings));
        setSelMuni(hit ? (hit.id as MunicipalityId) : null);
      }
    }
    downRef.current = null;
  };
  const onWheel = (e: React.WheelEvent) => {
    const wrap = wrapRef.current; if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - rect.left, e.clientY - rect.top);
  };

  // --- محدّثات الحالة (مرآة + مرجع + إعادة رسم) ------------------------------
  const setMetric = (m: MetricKey) => { metricRef.current = m; setMetricS(m); if (tlRef.current !== null) stopTimeline(); requestDraw(); };
  const setMode = (m: MapMode) => { modeRef.current = m; setModeS(m); requestDraw(); };
  const setSelMuni = (m: MunicipalityId | null) => { muniRef.current = m; setSelMuniS(m); requestDraw(); };
  const setHighlight = (id: string | null) => { highlightRef.current = id; setHighlightS(id); requestDraw(); };

  // --- الخطّ الزمني ---------------------------------------------------------
  const setTlDay = (d: number | null) => { tlRef.current = d; setTlDayS(d); requestDraw(); };
  const stopTimeline = () => {
    if (tlTimerRef.current) { clearInterval(tlTimerRef.current); tlTimerRef.current = null; }
    setPlaying(false);
    setTlDay(null);
  };
  const playTimeline = () => {
    if (playing) { // إيقاف مؤقّت
      if (tlTimerRef.current) { clearInterval(tlTimerRef.current); tlTimerRef.current = null; }
      setPlaying(false);
      return;
    }
    setPlaying(true);
    let d = tlRef.current === null ? 0 : tlRef.current;
    setTlDay(d);
    tlTimerRef.current = setInterval(() => {
      d += 1;
      if (d >= days.length) {
        if (tlTimerRef.current) { clearInterval(tlTimerRef.current); tlTimerRef.current = null; }
        setPlaying(false);
        return;
      }
      setTlDay(d);
    }, 550);
  };

  // --- التصدير --------------------------------------------------------------
  const buildExport = useCallback((): HTMLCanvasElement | null => {
    const src = canvasRef.current; const wrap = wrapRef.current;
    if (!src || !wrap) return null;
    const S = 2;
    const W = wrap.clientWidth, H = wrap.clientHeight;
    const headH = 74, footH = 44;
    const ec = document.createElement('canvas');
    ec.width = W * S; ec.height = (H + headH + footH) * S;
    const c = ec.getContext('2d'); if (!c) return null;
    c.scale(S, S);
    c.fillStyle = '#fffdfa'; c.fillRect(0, 0, W, H + headH + footH);
    // ترويسة
    c.fillStyle = '#8a173e'; c.fillRect(0, 0, W, 4);
    (c as CanvasRenderingContext2D & { direction?: string }).direction = 'rtl';
    c.textAlign = 'right'; c.textBaseline = 'middle';
    c.fillStyle = '#6a0f2e'; c.font = '800 22px Tajawal, sans-serif';
    c.fillText('الخريطة الحرارية لمستخدمي الألعاب التعليمية — دولة قطر', W - 20, 30);
    c.fillStyle = '#8a6a2e'; c.font = '600 14px Tajawal, sans-serif';
    const total = QATAR_SCHOOLS.reduce((n, s) => n + valueOf(s.id), 0);
    const metricName = tlRef.current !== null ? 'المستخدمون (خطّ زمني)' : METRIC_LABEL[metricRef.current];
    c.fillText(`${metricName} · الإجمالي ${formatFull(total)} · ${new Date().toLocaleDateString('en-GB')}`, W - 20, 56);
    // الخريطة
    c.drawImage(src, 0, headH, W, H);
    // مفتاح
    const ly = H + headH + 22;
    const grad = c.createLinearGradient(20, 0, 220, 0);
    grad.addColorStop(0, 'rgba(244,214,138,0.6)'); grad.addColorStop(0.5, '#d9a72e');
    grad.addColorStop(0.8, '#b02a54'); grad.addColorStop(1, '#6a0f2e');
    c.fillStyle = grad; c.fillRect(20, ly - 6, 200, 10);
    c.fillStyle = '#8a6a2e'; c.font = '600 12px Tajawal, sans-serif';
    c.textAlign = 'right'; c.fillText('منصة مناهج قطر التفاعلية', W - 20, ly);
    return ec;
  }, [valueOf]);

  const exportPNG = () => {
    const ec = buildExport(); if (!ec) return;
    ec.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'qatar-heatmap.png';
      a.click(); URL.revokeObjectURL(a.href);
    }, 'image/png');
  };
  const exportPDF = async () => {
    const ec = buildExport(); if (!ec) return;
    try {
      const { jsPDF } = await import('jspdf');
      const img = ec.toDataURL('image/png');
      const wmm = 297, hmm = (ec.height / ec.width) * wmm;
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [wmm, hmm] });
      pdf.addImage(img, 'PNG', 0, 0, wmm, hmm);
      pdf.save('qatar-heatmap.pdf');
    } catch { /* ignore */ }
  };

  // --- البحث ----------------------------------------------------------------
  const searchResults = useMemo(() => (searchQ ? searchSchools(searchQ, QATAR_SCHOOLS.length) : []), [searchQ]);
  const locateSchool = (id: string) => {
    const s = SCHOOL_BY_ID[id]; if (!s) return;
    setHighlight(id);
    setSearchQ(s.name); setSearchOpen(false);
    const wrap = wrapRef.current; if (!wrap) return;
    const W = wrap.clientWidth, H = wrap.clientHeight;
    const t = tRef.current;
    // تكبير يكفي لفصل أقرب مدرسة مجاورة (≈ 45px) حتى لا يغطّي إبرازُها أسماءَ
    // جاراتها في المجمّع نفسه (مثل مدارس سميسمة الثلاث).
    let nearest = Infinity;
    for (const o of QATAR_SCHOOLS) {
      if (o.id === id) continue;
      const d = Math.hypot((o.lng - s.lng) * t.baseW / (GEO.lngMax - GEO.lngMin), (o.lat - s.lat) * t.baseH / (GEO.latMax - GEO.latMin));
      if (d > 0 && d < nearest) nearest = d;
    }
    const target = Math.min(MAX_SCALE, Math.max(3.4, 45 / nearest));
    t.scale = target;
    t.panX = W / 2 - normX(s.lng) * t.baseW * target;
    t.panY = H / 2 - normY(s.lat) * t.baseH * target;
    setScalePct(Math.round(target * 100));
    requestDraw();
  };

  if (!mounted) return null;

  const seg = (active: boolean) =>
    'rounded-lg px-3 py-1.5 text-xs font-black transition ' +
    (active ? 'bg-[color:var(--maroon)] text-white shadow-sm' : 'text-[color:var(--maroon)] hover:bg-[color:var(--surface-2)]');
  const iconBtn =
    'grid h-11 w-11 place-items-center rounded-xl bg-[color:var(--surface)] text-[color:var(--maroon)] shadow-md ring-1 ring-[color:var(--hairline)] transition hover:bg-[color:var(--surface-2)]';

  const selName = selMuni ? MUNICIPALITY_BY_ID[selMuni].name : null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex flex-col bg-[color:var(--surface)]">
      {/* شريط علوي */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--hairline)] bg-[color:var(--surface)]/95 px-3 py-2 backdrop-blur">
        <h2 className="flex min-w-0 items-center gap-2 font-display text-sm font-bold text-[color:var(--maroon)] sm:text-base">
          <GraduationCap className="h-5 w-5 shrink-0 text-[color:var(--gold)]" />
          <span className="truncate">الخريطة الحرارية — عرض كامل</span>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {/* المقياس */}
          <div className="flex items-center gap-0.5 rounded-xl bg-[color:var(--surface-2)]/70 p-0.5 ring-1 ring-[color:var(--hairline)]">
            {(['users', 'plays', 'downloads'] as MetricKey[]).map((k) => (
              <button key={k} onClick={() => setMetric(k)} className={seg(metric === k && tlDay === null)}>
                {METRIC_LABEL[k]}
              </button>
            ))}
          </div>
          {/* الوضع */}
          <div className="flex items-center gap-0.5 rounded-xl bg-[color:var(--surface-2)]/70 p-0.5 ring-1 ring-[color:var(--hairline)]">
            <button onClick={() => setMode('heat')} className={seg(mode === 'heat')}>
              <span className="flex items-center gap-1"><Flame className="h-3.5 w-3.5" /> حرارة</span>
            </button>
            <button onClick={() => setMode('regions')} className={seg(mode === 'regions')}>
              <span className="flex items-center gap-1"><LayoutGrid className="h-3.5 w-3.5" /> مناطق</span>
            </button>
          </div>
          {/* تصدير */}
          <button onClick={exportPNG} className="flex items-center gap-1 rounded-xl border border-[color:var(--hairline)] bg-[color:var(--surface)] px-2.5 py-1.5 text-xs font-bold text-[color:var(--maroon)] hover:bg-[color:var(--surface-2)]" title="تصدير صورة">
            <Download className="h-3.5 w-3.5" /> PNG
          </button>
          <button onClick={exportPDF} className="flex items-center gap-1 rounded-xl border border-[color:var(--hairline)] bg-[color:var(--surface)] px-2.5 py-1.5 text-xs font-bold text-[color:var(--maroon)] hover:bg-[color:var(--surface-2)]" title="تصدير PDF">
            <FileText className="h-3.5 w-3.5" /> PDF
          </button>
          <button onClick={onClose} className="flex items-center gap-1.5 rounded-xl bg-[color:var(--maroon)] px-3 py-2 text-sm font-black text-white transition hover:bg-[color:var(--maroon-700)]">
            <X className="h-4 w-4" /> إغلاق
          </button>
        </div>
      </div>

      {/* شريط بحث المدرسة */}
      <div className="relative z-10 border-b border-[color:var(--hairline)] bg-[color:var(--surface)]/95 px-3 py-2">
        <div className="relative mx-auto max-w-md">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchQ}
            onChange={(e) => { setSearchQ(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            placeholder="حدّد مدرسة على الخريطة…"
            className="w-full rounded-xl border border-[color:var(--hairline-strong)] bg-[color:var(--surface)] py-2 pr-9 pl-3 text-sm font-bold text-foreground outline-none focus:border-[color:var(--maroon)]"
          />
          {searchOpen && searchResults.length > 0 && (
            <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-[color:var(--hairline)] bg-[color:var(--surface)] shadow-xl">
              {searchResults.map((s) => (
                <li key={s.id}>
                  <button onClick={() => locateSchool(s.id)} className="flex w-full items-center gap-2 px-3 py-2 text-right text-sm hover:bg-[color:var(--surface-2)]">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-[color:var(--gold)]" />
                    <span className="truncate font-bold text-foreground">{s.name}</span>
                    <span className="mr-auto shrink-0 text-xs text-muted-foreground">{MUNICIPALITY_BY_ID[s.municipalityId].name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* لوحة الخريطة */}
      <div
        ref={wrapRef}
        className="relative min-h-0 flex-1 touch-none overflow-hidden bg-gradient-to-b from-[color:var(--surface)] to-[color:var(--surface-2)]/60"
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel}
        style={{ cursor: 'grab' }}
      >
        <canvas ref={canvasRef} className="block h-full w-full" />

        {/* تلميح المدرسة */}
        {tooltip && (
          <div
            className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-[130%] whitespace-nowrap rounded-lg bg-[color:var(--maroon)] px-2.5 py-1.5 text-xs font-bold text-white shadow-lg"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            {tooltip.name}
            <span className="mr-1.5 text-[color:var(--gold-200)]">· {formatFull(tooltip.value)} {tooltip.unit}</span>
          </div>
        )}

        {hint && (
          <div className="pointer-events-none absolute bottom-24 left-1/2 max-w-[92vw] -translate-x-1/2 rounded-full bg-[color:var(--maroon)]/90 px-4 py-1.5 text-center text-[11px] font-bold text-white shadow-lg sm:text-xs">
            اسحب للتحريك · قرّب بإصبعين/العجلة · انقر منطقة للتنقّل · المس مدرسة لتفاصيلها
          </div>
        )}

        {/* شارة المنطقة المحدّدة */}
        {selName && (
          <div className="absolute left-4 top-16 flex items-center gap-2 rounded-xl bg-[color:var(--maroon)] px-3 py-1.5 text-xs font-black text-white shadow-lg">
            <MapPin className="h-3.5 w-3.5 text-[color:var(--gold-200)]" /> {selName}
            <button onClick={() => setSelMuni(null)} className="mr-1 rounded-full bg-white/20 p-0.5"><X className="h-3 w-3" /></button>
          </div>
        )}

        {/* أزرار التكبير */}
        <div className="absolute bottom-24 left-4 flex flex-col gap-2 sm:bottom-5">
          <button className={iconBtn} aria-label="تكبير" onClick={() => { const w = wrapRef.current; if (w) zoomAt(1.4, w.clientWidth / 2, w.clientHeight / 2); }}><Plus className="h-5 w-5" /></button>
          <button className={iconBtn} aria-label="تصغير" onClick={() => { const w = wrapRef.current; if (w) zoomAt(1 / 1.4, w.clientWidth / 2, w.clientHeight / 2); }}><Minus className="h-5 w-5" /></button>
          <button className={iconBtn} aria-label="إعادة الضبط" onClick={fit}><Locate className="h-5 w-5" /></button>
        </div>
        <div className="absolute bottom-24 right-4 rounded-full bg-[color:var(--surface)]/90 px-3 py-1.5 text-xs font-black tabular-nums text-[color:var(--maroon)] shadow ring-1 ring-[color:var(--hairline)] sm:bottom-5">{scalePct}%</div>

        {/* مفتاح */}
        <div className="absolute right-4 top-16 w-40 rounded-xl bg-[color:var(--surface)]/90 p-2.5 shadow ring-1 ring-[color:var(--hairline)]">
          <div className="h-2 w-full rounded-full" style={{ background: HEAT_GRADIENT_CSS }} />
          <div className="mt-1 flex justify-between text-[10px] font-bold text-muted-foreground"><span>أقلّ</span><span>أعلى تركيزًا</span></div>
        </div>
      </div>

      {/* الخطّ الزمني */}
      <div className="flex items-center gap-3 border-t border-[color:var(--hairline)] bg-[color:var(--surface)]/95 px-4 py-2.5">
        <button onClick={playTimeline} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color:var(--maroon)] text-white shadow transition hover:bg-[color:var(--maroon-700)]" aria-label={playing ? 'إيقاف' : 'تشغيل الخطّ الزمني'}>
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
        </button>
        <input
          type="range" min={0} max={days.length - 1} value={tlDay ?? days.length - 1}
          onChange={(e) => setTlDay(Number(e.target.value))}
          className="h-1.5 flex-1 cursor-pointer accent-[color:var(--maroon)]"
        />
        <span className="shrink-0 text-xs font-bold text-muted-foreground tabular-nums">
          {tlDay === null ? 'الإجمالي' : new Date(days[tlDay]).toLocaleDateString('en-GB')}
        </span>
        {tlDay !== null && (
          <button onClick={stopTimeline} className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-[color:var(--maroon)] hover:bg-[color:var(--surface-2)]">إلغاء</button>
        )}
      </div>
    </div>,
    document.body
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
