'use client';

import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity as ActivityIcon,
  BarChart3,
  Building2,
  CalendarDays,
  Download,
  FileText,
  Filter,
  Flame,
  GraduationCap,
  Layers3,
  LayoutGrid,
  Locate,
  MapPin,
  Minus,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  School,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react';
import type { Activity, Subject } from '@/lib/types';
import {
  GENDER_LABEL,
  MUNICIPALITIES,
  MUNICIPALITY_BY_ID,
  QATAR_SCHOOLS,
  SCHOOL_BY_ID,
  STAGE_LABEL,
  searchSchools,
  type MunicipalityId,
  type SchoolGender,
  type SchoolStage,
} from '@/data/qatar-schools';
import {
  MUNICIPALITY_SHAPES,
  QATAR_BBOX as GEO,
  QATAR_OUTLINE,
} from '@/data/qatar-geo';
import {
  buildHeatLUT,
  HEAT_GRADIENT_CSS,
  isDarkTheme,
  METRIC_LABEL,
  METRIC_UNIT,
  normX,
  normY,
  pointInRings,
  rampColor,
  type MapMode,
  type MetricKey,
  type SchoolMetric,
} from '@/lib/heatmap-shared';
import {
  activityMatches,
  activityTitle,
  aggregateActivities,
  aggregateUnits,
  buildDailyValues,
  buildSchoolValues,
  getPeriodWindow,
  hasContentFilter,
  percentChange,
  schoolMatches,
  type HeatmapFilters,
  type NormalizationMode,
  type PeriodKey,
  type SchoolActivityMetric,
} from '@/lib/heatmap-analytics';
import { formatFull, formatPercent } from '@/lib/utils';

interface Transform {
  scale: number;
  panX: number;
  panY: number;
  baseW: number;
  baseH: number;
}

interface ClusterHit {
  x: number;
  y: number;
  r: number;
  ids: string[];
}

type RecentWindow = 'all' | 'hour' | 'today' | 'week';

const MAX_SCALE = 36;
const SHAPE_BY_ID = Object.fromEntries(MUNICIPALITY_SHAPES.map((s) => [s.id, s]));

const PERIOD_LABEL: Record<PeriodKey, string> = {
  today: 'اليوم',
  '7d': '7 أيام',
  '30d': '30 يومًا',
  term: 'الفصل الحالي',
  all: 'الكل',
};

const RECENT_LABEL: Record<RecentWindow, string> = {
  all: 'كل النشاط',
  hour: 'آخر ساعة',
  today: 'اليوم',
  week: 'آخر أسبوع',
};

function recentCutoff(key: RecentWindow): number {
  const now = new Date();
  if (key === 'all') return 0;
  if (key === 'hour') return Date.now() - 60 * 60 * 1000;
  if (key === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Date.now() - 7 * 24 * 60 * 60 * 1000;
}

function sumValues(values: Record<string, number>): number {
  return Object.values(values).reduce((n, v) => n + (Number(v) || 0), 0);
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

export function HeatmapExplorer({
  metrics,
  activityMetrics,
  subjects,
  activities,
  mySchoolId,
  onClose,
}: {
  metrics: Record<string, SchoolMetric>;
  activityMetrics: SchoolActivityMetric[];
  subjects: Subject[];
  activities: Activity[];
  mySchoolId: string | null;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const transformRef = useRef<Transform>({
    scale: 1,
    panX: 0,
    panY: 0,
    baseW: 1,
    baseH: 1,
  });
  const clusterHitsRef = useRef<ClusterHit[]>([]);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ dist: number } | null>(null);
  const downRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const lutRef = useRef<Uint8ClampedArray | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [mounted, setMounted] = useState(false);
  const [metric, setMetric] = useState<MetricKey>('users');
  const [mode, setMode] = useState<MapMode>('heat');
  const [normalization, setNormalization] = useState<NormalizationMode>('total');
  const [recent, setRecent] = useState<RecentWindow>('all');
  const [filters, setFilters] = useState<HeatmapFilters>({
    period: 'all',
    subjectId: 'all',
    gradeId: 'all',
    unitId: 'all',
    gender: 'all',
    stage: 'all',
  });
  const [selectedMuni, setSelectedMuni] = useState<MunicipalityId | null>(null);
  const [selectedSchool, setSelectedSchool] = useState<string | null>(null);
  const [compareA, setCompareA] = useState<MunicipalityId>('doha');
  const [compareB, setCompareB] = useState<MunicipalityId>('rayyan');
  const [searchQ, setSearchQ] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [timelineIndex, setTimelineIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [scalePct, setScalePct] = useState(100);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);
  const [themeTick, setThemeTick] = useState(0);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const obs = new MutationObserver(() => setThemeTick((n) => n + 1));
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    });
    return () => obs.disconnect();
  }, []);

  const periodWindow = useMemo(
    () => getPeriodWindow(filters.period),
    [filters.period]
  );

  const gradeOptions = useMemo(() => {
    if (filters.subjectId === 'all') return [];
    return subjects.find((s) => s.id === filters.subjectId)?.grades ?? [];
  }, [subjects, filters.subjectId]);

  const unitOptions = useMemo(() => {
    if (filters.subjectId === 'all' || filters.gradeId === 'all') return [];
    const subject = subjects.find((s) => s.id === filters.subjectId);
    return subject?.grades.find((g) => g.id === filters.gradeId)?.units ?? [];
  }, [subjects, filters.subjectId, filters.gradeId]);

  // الأنشطة الظاهرة فعليًا في بنية المنهج الحالية. نستخدمها لمعرفة هل
  // الفلتر يضيّق المحتوى فعلًا أم أنه مجرد اختيار للمادة الوحيدة بالموقع.
  const curriculumActivities = useMemo(
    () =>
      subjects.flatMap((subject) =>
        subject.grades.flatMap((grade) =>
          grade.units.flatMap((unit) =>
            unit.lessons.flatMap((lesson) => lesson.activities)
          )
        )
      ),
    [subjects]
  );

  const effectiveFilters = useMemo<HeatmapFilters>(() => {
    if (!hasContentFilter(filters) || curriculumActivities.length === 0) {
      return filters;
    }

    const matchingCount = curriculumActivities.filter((activity) =>
      activityMatches(activity, filters)
    ).length;

    // إذا كان الفلتر المختار يشمل كل الأنشطة الظاهرة أصلًا (مثال: العلوم
    // هي المادة الوحيدة)، فهو لا يغيّر نطاق البيانات، لذا نحتفظ بالإجماليات
    // التاريخية بدل الانتقال إلى طبقة التحليلات التفصيلية الحديثة فقط.
    if (matchingCount === curriculumActivities.length) {
      return {
        ...filters,
        subjectId: 'all',
        gradeId: 'all',
        unitId: 'all',
      };
    }

    return filters;
  }, [filters, curriculumActivities]);

  const lastActiveBySchool = useMemo(() => {
    const out: Record<string, number> = {};
    // آخر نشاط مشتق من طبقة مدرسة × نشاط الجديدة. عند استخدام فلتر وحدة
    // نحصره في الوحدة، وإلا نأخذ آخر نشاط معروف للمدرسة على مستوى المنصة.
    for (const row of activityMetrics) {
      if (hasContentFilter(effectiveFilters) && !activityMatches(row, effectiveFilters)) continue;
      out[row.schoolId] = Math.max(out[row.schoolId] || 0, row.lastActiveAt || 0);
    }
    return out;
  }, [activityMetrics, effectiveFilters]);

  const currentValuesBase = useMemo(
    () =>
      buildSchoolValues({
        baseMetrics: metrics,
        activityMetrics,
        schools: QATAR_SCHOOLS,
        filters: effectiveFilters,
        metric,
        days: periodWindow.current,
      }),
    [metrics, activityMetrics, effectiveFilters, metric, periodWindow.current]
  );

  const previousValuesBase = useMemo(
    () =>
      buildSchoolValues({
        baseMetrics: metrics,
        activityMetrics,
        schools: QATAR_SCHOOLS,
        filters: effectiveFilters,
        metric,
        days: periodWindow.previous,
      }),
    [metrics, activityMetrics, effectiveFilters, metric, periodWindow.previous]
  );

  const dailyValues = useMemo(
    () =>
      buildDailyValues({
        baseMetrics: metrics,
        activityMetrics,
        schools: QATAR_SCHOOLS,
        filters: effectiveFilters,
        metric,
        days: periodWindow.playback,
      }),
    [metrics, activityMetrics, effectiveFilters, metric, periodWindow.playback]
  );

  const applyRecent = useCallback(
    (values: Record<string, number>) => {
      if (recent === 'all') return values;
      const cutoff = recentCutoff(recent);
      return Object.fromEntries(
        Object.entries(values).map(([id, v]) => [
          id,
          (lastActiveBySchool[id] || 0) >= cutoff ? v : 0,
        ])
      );
    },
    [recent, lastActiveBySchool]
  );

  const currentValues = useMemo(
    () => applyRecent(currentValuesBase),
    [applyRecent, currentValuesBase]
  );
  const previousValues = useMemo(
    () => applyRecent(previousValuesBase),
    [applyRecent, previousValuesBase]
  );

  const eligibleSchools = useMemo(
    () =>
      QATAR_SCHOOLS.filter((s) =>
        schoolMatches(s, { gender: filters.gender, stage: filters.stage })
      ),
    [filters.gender, filters.stage]
  );

  const activeSchoolIds = useMemo(
    () =>
      new Set(
        Object.entries(currentValues)
          .filter(([, v]) => v > 0)
          .map(([id]) => id)
      ),
    [currentValues]
  );

  const total = useMemo(() => sumValues(currentValues), [currentValues]);
  const previousTotal = useMemo(
    () => sumValues(previousValues),
    [previousValues]
  );
  const change = useMemo(
    () =>
      filters.period === 'all'
        ? undefined
        : percentChange(total, previousTotal),
    [filters.period, total, previousTotal]
  );

  const activeHour = useMemo(
    () =>
      eligibleSchools.filter(
        (s) => (lastActiveBySchool[s.id] || 0) >= recentCutoff('hour')
      ).length,
    [eligibleSchools, lastActiveBySchool]
  );

  const timelineValues = useMemo(() => {
    if (timelineIndex === null) return currentValues;
    const days = periodWindow.playback.slice(0, timelineIndex + 1);
    const fullDays = periodWindow.playback;
    const out: Record<string, number> = {};
    const useOpeningBalance = filters.period === 'all';

    for (const school of eligibleSchools) {
      const id = school.id;
      const daily = dailyValues[id] || {};
      const shown = days.reduce((n, d) => n + (daily[d] || 0), 0);
      const inPlayback = fullDays.reduce((n, d) => n + (daily[d] || 0), 0);
      const opening = useOpeningBalance
        ? Math.max(0, (currentValuesBase[id] || 0) - inPlayback)
        : 0;
      out[id] = opening + shown;
    }
    return applyRecent(out);
  }, [
    timelineIndex,
    currentValues,
    currentValuesBase,
    dailyValues,
    eligibleSchools,
    periodWindow.playback,
    filters.period,
    applyRecent,
  ]);

  const displayValues = timelineIndex === null ? currentValues : timelineValues;

  const municipalityRows = useMemo(() => {
    return MUNICIPALITIES.map((m) => {
      const schools = eligibleSchools.filter((s) => s.municipalityId === m.id);
      const value = schools.reduce((n, s) => n + (displayValues[s.id] || 0), 0);
      const active = schools.filter((s) => (displayValues[s.id] || 0) > 0).length;
      return {
        ...m,
        value:
          normalization === 'per-school' && schools.length
            ? value / schools.length
            : value,
        rawValue: value,
        schools: schools.length,
        active,
      };
    });
  }, [eligibleSchools, displayValues, normalization]);

  const maxMuni = Math.max(1, ...municipalityRows.map((m) => m.value));

  const analysisMetric: 'plays' | 'downloads' =
    metric === 'downloads' ? 'downloads' : 'plays';

  const insightSchoolIds = useMemo(() => {
    if (!selectedMuni) return activeSchoolIds;
    return new Set(
      QATAR_SCHOOLS.filter((s) => s.municipalityId === selectedMuni)
        .filter((s) => activeSchoolIds.has(s.id))
        .map((s) => s.id)
    );
  }, [selectedMuni, activeSchoolIds]);

  const insightEligibleCount = useMemo(() => {
    if (!selectedMuni) return eligibleSchools.length;
    return eligibleSchools.filter((s) => s.municipalityId === selectedMuni).length;
  }, [selectedMuni, eligibleSchools]);

  const insightSpread = insightEligibleCount
    ? (insightSchoolIds.size / insightEligibleCount) * 100
    : 0;

  const topActivities = useMemo(
    () =>
      aggregateActivities({
        rows: activityMetrics,
        filters: effectiveFilters,
        metric: analysisMetric,
        days: periodWindow.current,
        schoolIds: insightSchoolIds,
      }).slice(0, 3),
    [
      activityMetrics,
      effectiveFilters,
      analysisMetric,
      periodWindow.current,
      insightSchoolIds,
    ]
  );

  const topUnits = useMemo(
    () =>
      aggregateUnits({
        rows: activityMetrics,
        filters: effectiveFilters,
        metric: analysisMetric,
        days: periodWindow.current,
        subjects,
        schoolIds: insightSchoolIds,
      }).slice(0, 3),
    [
      activityMetrics,
      effectiveFilters,
      analysisMetric,
      periodWindow.current,
      subjects,
      insightSchoolIds,
    ]
  );

  const searchResults = useMemo(
    () => (searchQ ? searchSchools(searchQ, 30) : []),
    [searchQ]
  );

  const compareStats = useCallback(
    (id: MunicipalityId) => {
      const municipality = MUNICIPALITY_BY_ID[id];
      const schools = eligibleSchools.filter((s) => s.municipalityId === id);
      const schoolIds = new Set(schools.map((s) => s.id));
      const raw = schools.reduce((n, s) => n + (currentValues[s.id] || 0), 0);
      const value =
        normalization === 'per-school' && schools.length ? raw / schools.length : raw;
      const active = schools.filter((s) => (currentValues[s.id] || 0) > 0).length;
      const unit = aggregateUnits({
        rows: activityMetrics,
        filters: effectiveFilters,
        metric: analysisMetric,
        days: periodWindow.current,
        subjects,
        schoolIds,
      })[0];
      const activity = aggregateActivities({
        rows: activityMetrics,
        filters: effectiveFilters,
        metric: analysisMetric,
        days: periodWindow.current,
        schoolIds,
      })[0];
      return { municipality, value, raw, active, schools: schools.length, unit, activity };
    },
    [
      eligibleSchools,
      currentValues,
      normalization,
      activityMetrics,
      effectiveFilters,
      analysisMetric,
      periodWindow.current,
      subjects,
    ]
  );

  const selectedSchoolInfo = useMemo(() => {
    if (!selectedSchool) return null;
    const school = SCHOOL_BY_ID[selectedSchool];
    if (!school) return null;
    const schoolIds = new Set([school.id]);
    const unit = aggregateUnits({
      rows: activityMetrics,
      filters: effectiveFilters,
      metric: analysisMetric,
      days: periodWindow.current,
      subjects,
      schoolIds,
    })[0];
    const activity = aggregateActivities({
      rows: activityMetrics,
      filters: effectiveFilters,
      metric: analysisMetric,
      days: periodWindow.current,
      schoolIds,
    })[0];
    const last7 = getPeriodWindow('7d').playback;
    const bars = buildDailyValues({
      baseMetrics: metrics,
      activityMetrics,
      schools: [school],
      filters: effectiveFilters,
      metric,
      days: last7,
    })[school.id] || {};
    return {
      school,
      value: currentValues[school.id] || 0,
      lastActiveAt: lastActiveBySchool[school.id] || 0,
      unit,
      activity,
      bars: last7.map((d) => ({ day: d, value: bars[d] || 0 })),
    };
  }, [
    selectedSchool,
    activityMetrics,
    effectiveFilters,
    analysisMetric,
    periodWindow.current,
    subjects,
    metrics,
    metric,
    currentValues,
    lastActiveBySchool,
  ]);

  const metricLabel =
    metric === 'users' && hasContentFilter(effectiveFilters)
      ? 'المدارس النشطة'
      : METRIC_LABEL[metric];
  const metricUnit =
    metric === 'users' && hasContentFilter(effectiveFilters) ? 'مدرسة' : METRIC_UNIT[metric];

  const fit = useCallback(() => {
    const wrap = mapRef.current;
    if (!wrap) return;
    const W = wrap.clientWidth;
    const H = wrap.clientHeight;
    const pad = 56;
    const latRatio =
      (GEO.latMax - GEO.latMin) /
      ((GEO.lngMax - GEO.lngMin) *
        Math.cos((((GEO.latMin + GEO.latMax) / 2) * Math.PI) / 180));
    let baseW = Math.min(W - pad, (H - pad) / latRatio);
    baseW = Math.max(130, baseW);
    const baseH = baseW * latRatio;
    transformRef.current = {
      scale: 1,
      baseW,
      baseH,
      panX: (W - baseW) / 2,
      panY: (H - baseH) / 2,
    };
    setScalePct(100);
  }, []);

  const requestDraw = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      drawMap();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    displayValues,
    municipalityRows,
    selectedMuni,
    selectedSchool,
    mode,
    themeTick,
    lastActiveBySchool,
    metricLabel,
    normalization,
  ]);

  const zoomAt = useCallback(
    (factor: number, px: number, py: number) => {
      const t = transformRef.current;
      const next = Math.min(MAX_SCALE, Math.max(1, t.scale * factor));
      const k = next / t.scale;
      t.panX = px - (px - t.panX) * k;
      t.panY = py - (py - t.panY) * k;
      t.scale = next;
      if (next === 1) fit();
      setScalePct(Math.round(next * 100));
      requestDraw();
    },
    [fit, requestDraw]
  );

  const focusSchool = useCallback(
    (id: string) => {
      const school = SCHOOL_BY_ID[id];
      const wrap = mapRef.current;
      if (!school || !wrap) return;
      setSelectedSchool(id);
      setSelectedMuni(school.municipalityId);
      setSearchQ(school.name);
      setSearchOpen(false);
      const t = transformRef.current;
      const target = Math.max(4, Math.min(MAX_SCALE, 7));
      t.scale = target;
      t.panX =
        wrap.clientWidth / 2 - normX(school.lng) * t.baseW * target;
      t.panY =
        wrap.clientHeight / 2 - normY(school.lat) * t.baseH * target;
      setScalePct(Math.round(target * 100));
      requestDraw();
    },
    [requestDraw]
  );

  const drawMap = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = mapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = wrap.clientWidth;
    const H = wrap.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (
      canvas.width !== Math.round(W * dpr) ||
      canvas.height !== Math.round(H * dpr)
    ) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const dark = isDarkTheme();
    const t = transformRef.current;
    const SX = (lng: number) => normX(lng) * t.baseW * t.scale + t.panX;
    const SY = (lat: number) => normY(lat) * t.baseH * t.scale + t.panY;
    const pathOf = (rings: [number, number][][]) => {
      const p = new Path2D();
      for (const ring of rings) {
        ring.forEach(([lng, lat], i) => {
          const x = SX(lng);
          const y = SY(lat);
          if (i === 0) p.moveTo(x, y);
          else p.lineTo(x, y);
        });
        p.closePath();
      }
      return p;
    };

    const land = pathOf([QATAR_OUTLINE]);
    ctx.save();
    ctx.shadowColor = dark ? 'rgba(0,0,0,.52)' : 'rgba(106,15,46,.22)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = dark ? 'rgba(39,27,29,.98)' : 'rgba(255,255,255,.97)';
    ctx.fill(land);
    ctx.restore();

    if (mode === 'regions') {
      for (const shp of MUNICIPALITY_SHAPES) {
        const row = municipalityRows.find((m) => m.id === shp.id);
        const value = row?.value || 0;
        const p = pathOf(shp.rings);
        const dim = selectedMuni && selectedMuni !== shp.id ? 0.3 : 1;
        ctx.fillStyle =
          value > 0
            ? rampColor(0.12 + (value / maxMuni) * 0.88, 0.92 * dim)
            : dark
              ? 'rgba(255,255,255,.04)'
              : 'rgba(120,96,48,.06)';
        ctx.fill(p);
        ctx.lineWidth = selectedMuni === shp.id ? 2.5 : 1;
        ctx.strokeStyle =
          selectedMuni === shp.id
            ? dark
              ? '#e3c26b'
              : '#6a0f2e'
            : dark
              ? 'rgba(245,236,228,.22)'
              : 'rgba(106,15,46,.3)';
        ctx.stroke(p);
      }
    } else {
      const fill = ctx.createLinearGradient(0, 0, 0, H);
      fill.addColorStop(0, dark ? 'rgba(120,96,48,.13)' : 'rgba(168,140,74,.13)');
      fill.addColorStop(1, dark ? 'rgba(80,64,32,.08)' : 'rgba(120,96,48,.08)');
      ctx.fillStyle = fill;
      ctx.fill(land);

      const pts = QATAR_SCHOOLS.map((s) => ({
        x: SX(s.lng),
        y: SY(s.lat),
        w: displayValues[s.id] || 0,
      })).filter((p) => p.w > 0 && p.x > -200 && p.x < W + 200 && p.y > -200 && p.y < H + 200);

      if (pts.length) {
        const RES = t.scale > 3 ? 0.45 : 0.58;
        const gw = Math.max(2, Math.round(W * RES));
        const gh = Math.max(2, Math.round(H * RES));
        const grid = new Float32Array(gw * gh);
        const R = Math.min(165, Math.max(24, t.baseW * 0.16 * t.scale)) * RES;
        const R2 = R * R;
        let gmax = 0;
        for (const p of pts) {
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
          const lut = (lutRef.current ??= buildHeatLUT());
          const img = ctx.createImageData(gw, gh);
          for (let i = 0; i < grid.length; i++) {
            const v = grid[i] / gmax;
            if (v <= 0) continue;
            const tt = Math.min(255, Math.round(Math.sqrt(v) * 255));
            const o = i * 4;
            const l = tt * 4;
            img.data[o] = lut[l];
            img.data[o + 1] = lut[l + 1];
            img.data[o + 2] = lut[l + 2];
            img.data[o + 3] = lut[l + 3];
          }
          const heat = document.createElement('canvas');
          heat.width = gw;
          heat.height = gh;
          heat.getContext('2d')?.putImageData(img, 0, 0);
          ctx.save();
          ctx.clip(land);
          ctx.filter = 'blur(4px)';
          ctx.drawImage(heat, 0, 0, W, H);
          ctx.filter = 'none';
          ctx.restore();
        }
      }

      ctx.lineWidth = 1.4;
      ctx.strokeStyle = dark ? 'rgba(227,194,107,.5)' : 'rgba(106,15,46,.55)';
      ctx.stroke(land);
    }

    clusterHitsRef.current = [];
    const visibleSchools = eligibleSchools.filter((s) => {
      const x = SX(s.lng);
      const y = SY(s.lat);
      return x > -30 && x < W + 30 && y > -30 && y < H + 30;
    });

    if (t.scale < 2.25) {
      const CELL = 48;
      const groups = new Map<
        string,
        { ids: string[]; sx: number; sy: number; value: number; recent: boolean }
      >();
      for (const school of visibleSchools) {
        const x = SX(school.lng);
        const y = SY(school.lat);
        const key = String(Math.floor(x / CELL)) + ':' + String(Math.floor(y / CELL));
        const g = groups.get(key) || {
          ids: [],
          sx: 0,
          sy: 0,
          value: 0,
          recent: false,
        };
        g.ids.push(school.id);
        g.sx += x;
        g.sy += y;
        g.value += displayValues[school.id] || 0;
        if ((lastActiveBySchool[school.id] || 0) >= recentCutoff('hour')) g.recent = true;
        groups.set(key, g);
      }

      for (const g of groups.values()) {
        const x = g.sx / g.ids.length;
        const y = g.sy / g.ids.length;
        const active = g.value > 0;
        const r = g.ids.length > 1 ? Math.min(18, 7 + Math.sqrt(g.ids.length) * 2.2) : 4.2;
        if (g.recent) {
          ctx.beginPath();
          ctx.arc(x, y, r + 5, 0, Math.PI * 2);
          ctx.strokeStyle = dark ? 'rgba(227,194,107,.7)' : 'rgba(224,170,52,.72)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = active
          ? dark
            ? 'rgba(227,194,107,.94)'
            : 'rgba(106,15,46,.9)'
          : dark
            ? 'rgba(245,236,228,.22)'
            : 'rgba(106,15,46,.2)';
        ctx.fill();
        if (g.ids.length > 1) {
          ctx.fillStyle = active && !dark ? '#fff' : dark ? '#1e1215' : '#fff';
          ctx.font = '700 10px "Readex Pro", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(g.ids.length), x, y + 0.5);
        }
        clusterHitsRef.current.push({ x, y, r: r + 8, ids: g.ids });
      }
    } else {
      const maxSchool = Math.max(
        1,
        ...visibleSchools.map((s) => displayValues[s.id] || 0)
      );
      const occupied: { x: number; y: number; w: number; h: number }[] = [];
      for (const school of visibleSchools) {
        const value = displayValues[school.id] || 0;
        const x = SX(school.lng);
        const y = SY(school.lat);
        const r = value > 0 ? 3 + Math.sqrt(value / maxSchool) * 4 : 2;
        const recentNow = (lastActiveBySchool[school.id] || 0) >= recentCutoff('hour');
        if (recentNow) {
          ctx.beginPath();
          ctx.arc(x, y, r + 5, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(224,170,52,.82)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle =
          school.id === selectedSchool
            ? '#e0aa34'
            : value > 0
              ? dark
                ? 'rgba(227,194,107,.92)'
                : 'rgba(106,15,46,.9)'
              : dark
                ? 'rgba(245,236,228,.2)'
                : 'rgba(106,15,46,.2)';
        ctx.fill();
        clusterHitsRef.current.push({ x, y, r: 13, ids: [school.id] });

        if (t.scale >= 4 && (value > 0 || school.id === selectedSchool)) {
          ctx.font = '700 11px "Readex Pro", sans-serif';
          const tw = Math.min(170, ctx.measureText(school.name).width);
          const box = { x: x - tw / 2 - 5, y: y + 8, w: tw + 10, h: 16 };
          const collides = occupied.some(
            (o) =>
              !(box.x + box.w < o.x ||
                o.x + o.w < box.x ||
                box.y + box.h < o.y ||
                o.y + o.h < box.y)
          );
          if (!collides || school.id === selectedSchool) {
            ctx.fillStyle = dark ? 'rgba(24,15,18,.9)' : 'rgba(255,255,255,.92)';
            roundRect(ctx, box.x, box.y, box.w, box.h, 7);
            ctx.fill();
            ctx.fillStyle = dark ? '#e3c26b' : '#5a1029';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(school.name, x, box.y + box.h / 2, 166);
            occupied.push(box);
          }
        }
      }
    }

    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 13px "Readex Pro", sans-serif';
    for (const m of municipalityRows) {
      const shape = SHAPE_BY_ID[m.id];
      const cx = shape ? shape.centroid[0] : m.lng;
      const cy = shape ? shape.centroid[1] : m.lat;
      const x = SX(cx);
      const y = SY(cy);
      if (x < -40 || x > W + 40 || y < -20 || y > H + 20) continue;
      const label =
        m.value > 0
          ? m.name + ' · ' + formatFull(m.value)
          : m.name;
      const tw = ctx.measureText(label).width;
      ctx.fillStyle =
        selectedMuni === m.id
          ? 'rgba(224,170,52,.96)'
          : 'rgba(106,15,46,.92)';
      roundRect(ctx, x - tw / 2 - 7, y - 9, tw + 14, 18, 8);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(label, x, y);
    }

    if (mySchoolId && SCHOOL_BY_ID[mySchoolId]) {
      const school = SCHOOL_BY_ID[mySchoolId];
      const x = SX(school.lng);
      const y = SY(school.lat);
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.strokeStyle = '#e0aa34';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }, [
    displayValues,
    eligibleSchools,
    mode,
    municipalityRows,
    maxMuni,
    selectedMuni,
    selectedSchool,
    lastActiveBySchool,
    mySchoolId,
  ]);

  useEffect(() => {
    if (!mounted) return;
    fit();
    setThemeTick((n) => n + 1);
    const onResize = () => {
      fit();
      setThemeTick((n) => n + 1);
    };
    window.addEventListener('resize', onResize);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [mounted, fit, onClose]);

  useEffect(() => {
    requestDraw();
  }, [requestDraw, displayValues, mode, selectedMuni, selectedSchool, themeTick]);

  useEffect(() => {
    if (!mounted) return;
    const wrap = mapRef.current;
    if (!wrap) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = wrap.getBoundingClientRect();
      const dy = Math.max(-100, Math.min(100, e.deltaY));
      zoomAt(
        Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)),
        e.clientX - rect.left,
        e.clientY - rect.top
      );
    };
    wrap.addEventListener('wheel', onWheel, { passive: false });
    return () => wrap.removeEventListener('wheel', onWheel);
  }, [mounted, zoomAt]);

  const hitAt = (x: number, y: number) => {
    let best: ClusterHit | null = null;
    let bestD = Infinity;
    for (const hit of clusterHitsRef.current) {
      const d = Math.hypot(hit.x - x, hit.y - y);
      if (d <= hit.r && d < bestD) {
        best = hit;
        bestD = d;
      }
    }
    return best;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button,input,select,a')) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    downRef.current = { x: e.clientX, y: e.clientY, moved: false };
    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      pinchRef.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const wrap = mapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();

    if (pointersRef.current.size === 0) {
      const hit = hitAt(e.clientX - rect.left, e.clientY - rect.top);
      if (hit) {
        if (hit.ids.length > 1) {
          setTooltip({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            text: String(hit.ids.length) + ' مدارس متقاربة',
          });
        } else {
          const school = SCHOOL_BY_ID[hit.ids[0]];
          setTooltip({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            text:
              school.name +
              ' · ' +
              formatFull(displayValues[school.id] || 0) +
              ' ' +
              metricUnit,
          });
        }
      } else setTooltip(null);
      return;
    }

    const prev = pointersRef.current.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    pointersRef.current.set(e.pointerId, cur);
    if (
      downRef.current &&
      Math.hypot(cur.x - downRef.current.x, cur.y - downRef.current.y) > 6
    ) {
      downRef.current.moved = true;
    }

    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const [a, b] = [...pointersRef.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt(
        dist / (pinchRef.current.dist || dist),
        (a.x + b.x) / 2 - rect.left,
        (a.y + b.y) / 2 - rect.top
      );
      pinchRef.current.dist = dist;
    } else if (pointersRef.current.size === 1) {
      const t = transformRef.current;
      t.panX += cur.x - prev.x;
      t.panY += cur.y - prev.y;
      requestDraw();
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const wrap = mapRef.current;
    if (!pointersRef.current.has(e.pointerId)) return;
    const tapped =
      Boolean(downRef.current && !downRef.current.moved) &&
      pointersRef.current.size === 1;
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;

    if (tapped && wrap) {
      const rect = wrap.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const hit = hitAt(sx, sy);
      if (hit) {
        if (hit.ids.length === 1) {
          focusSchool(hit.ids[0]);
        } else {
          const t = transformRef.current;
          const factor = Math.min(3, Math.max(1.7, 8 / t.scale));
          zoomAt(factor, hit.x, hit.y);
        }
      } else {
        const t = transformRef.current;
        const nx = (sx - t.panX) / (t.baseW * t.scale);
        const ny = (sy - t.panY) / (t.baseH * t.scale);
        const lng = GEO.lngMin + nx * (GEO.lngMax - GEO.lngMin);
        const lat = GEO.latMax - ny * (GEO.latMax - GEO.latMin);
        const region = MUNICIPALITY_SHAPES.find((shape) =>
          pointInRings(lng, lat, shape.rings)
        );
        setSelectedMuni(region ? (region.id as MunicipalityId) : null);
        setSelectedSchool(null);
      }
    }
    downRef.current = null;
  };

  const playTimeline = () => {
    if (playing) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      setPlaying(false);
      return;
    }
    const days = periodWindow.playback;
    if (!days.length) return;
    setPlaying(true);
    let i = timelineIndex === null ? 0 : timelineIndex;
    setTimelineIndex(i);
    timerRef.current = setInterval(() => {
      i += 1;
      if (i >= days.length) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        setPlaying(false);
        return;
      }
      setTimelineIndex(i);
    }, 650);
  };

  const resetFilters = () => {
    setFilters({
      period: 'all',
      subjectId: 'all',
      gradeId: 'all',
      unitId: 'all',
      gender: 'all',
      stage: 'all',
    });
    setRecent('all');
    setTimelineIndex(null);
    setSelectedMuni(null);
    setSelectedSchool(null);
  };

  const buildExport = () => {
    const src = canvasRef.current;
    const wrap = mapRef.current;
    if (!src || !wrap) return null;
    const scale = 2;
    const W = wrap.clientWidth;
    const H = wrap.clientHeight;
    const head = 90;
    const foot = 50;
    const out = document.createElement('canvas');
    out.width = W * scale;
    out.height = (H + head + foot) * scale;
    const c = out.getContext('2d');
    if (!c) return null;
    c.scale(scale, scale);
    c.fillStyle = '#fffdfa';
    c.fillRect(0, 0, W, H + head + foot);
    c.fillStyle = '#8a173e';
    c.fillRect(0, 0, W, 5);
    c.direction = 'rtl';
    c.textAlign = 'right';
    c.textBaseline = 'middle';
    c.fillStyle = '#6a0f2e';
    c.font = '700 21px "Readex Pro", sans-serif';
    c.fillText('تحليلات الخريطة التعليمية — دولة قطر', W - 20, 30);
    c.fillStyle = '#80652d';
    c.font = '600 13px "Readex Pro", sans-serif';
    c.fillText(
      metricLabel +
        ' · ' +
        periodWindow.label +
        ' · ' +
        (normalization === 'per-school' ? 'لكل مدرسة' : 'الإجمالي'),
      W - 20,
      57
    );
    c.fillText('المدارس النشطة: ' + activeSchoolIds.size + ' من ' + eligibleSchools.length, W - 20, 76);
    c.drawImage(src, 0, head, W, H);
    const grad = c.createLinearGradient(20, 0, 220, 0);
    grad.addColorStop(0, 'rgba(244,214,138,.6)');
    grad.addColorStop(0.5, '#e0aa34');
    grad.addColorStop(0.8, '#b02a54');
    grad.addColorStop(1, '#6a0f2e');
    c.fillStyle = grad;
    c.fillRect(20, H + head + 20, 200, 10);
    c.fillStyle = '#80652d';
    c.textAlign = 'right';
    c.fillText('منصة مناهج قطر التفاعلية', W - 20, H + head + 27);
    return out;
  };

  const exportPNG = () => {
    const out = buildExport();
    if (!out) return;
    out.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'qatar-learning-heatmap.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }, 'image/png');
  };

  const exportPDF = async () => {
    const out = buildExport();
    if (!out) return;
    try {
      const { jsPDF } = await import('jspdf');
      const img = out.toDataURL('image/png');
      const wmm = 297;
      const hmm = (out.height / out.width) * wmm;
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [wmm, hmm],
      });
      pdf.addImage(img, 'PNG', 0, 0, wmm, hmm);
      pdf.save('qatar-learning-heatmap.pdf');
    } catch {
      /* ignore */
    }
  };

  if (!mounted) return null;

  const compareLeft = compareStats(compareA);
  const compareRight = compareStats(compareB);
  const maxBar =
    selectedSchoolInfo?.bars.reduce((m, x) => Math.max(m, x.value), 1) || 1;

  const selectClass =
    'rounded-xl border border-[color:var(--hairline-strong)] bg-[color:var(--surface)] px-3 py-2 text-xs font-bold text-foreground outline-none focus:border-[color:var(--maroon)]';
  const chip = (active: boolean) =>
    'rounded-lg px-2.5 py-1.5 text-xs font-black transition ' +
    (active
      ? 'bg-[color:var(--maroon)] text-white shadow-sm'
      : 'text-[color:var(--maroon)] hover:bg-[color:var(--surface-2)]');

  return createPortal(
    <div className="fixed inset-0 z-[220] flex flex-col overflow-hidden bg-[color:var(--surface)]" dir="rtl">
      <header className="max-h-[46vh] shrink-0 overflow-y-auto border-b border-[color:var(--hairline)] bg-[color:var(--surface)]/95 px-3 py-2 backdrop-blur lg:max-h-none lg:overflow-visible">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <GraduationCap className="h-5 w-5 shrink-0 text-[color:var(--gold)]" />
            <div className="min-w-0">
              <h2 className="truncate font-display text-sm font-black text-[color:var(--maroon)] sm:text-base">
                مركز تحليل الخريطة التعليمية
              </h2>
              <p className="hidden text-[11px] font-bold text-muted-foreground sm:block">
                قطر ← البلدية ← المدرسة ← الوحدة ← النشاط
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button onClick={exportPNG} className="btn-ghost btn-sm px-2.5 py-1.5 text-xs">
              <Download className="h-3.5 w-3.5" /> PNG
            </button>
            <button onClick={exportPDF} className="btn-ghost btn-sm px-2.5 py-1.5 text-xs">
              <FileText className="h-3.5 w-3.5" /> PDF
            </button>
            <button onClick={resetFilters} className="btn-ghost btn-sm px-2.5 py-1.5 text-xs">
              <RefreshCw className="h-3.5 w-3.5" /> إعادة
            </button>
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 rounded-xl bg-[color:var(--maroon)] px-3 py-2 text-sm font-black text-white"
            >
              <X className="h-4 w-4" /> إغلاق
            </button>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-xl bg-[color:var(--surface-2)]/70 p-0.5 ring-1 ring-[color:var(--hairline)]">
            {(['users', 'plays', 'downloads'] as MetricKey[]).map((k) => (
              <button
                key={k}
                onClick={() => {
                  setMetric(k);
                  setTimelineIndex(null);
                }}
                className={chip(metric === k)}
              >
                {METRIC_LABEL[k]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-0.5 rounded-xl bg-[color:var(--surface-2)]/70 p-0.5 ring-1 ring-[color:var(--hairline)]">
            <button onClick={() => setMode('heat')} className={chip(mode === 'heat')}>
              <span className="flex items-center gap-1"><Flame className="h-3.5 w-3.5" /> حرارة</span>
            </button>
            <button onClick={() => setMode('regions')} className={chip(mode === 'regions')}>
              <span className="flex items-center gap-1"><LayoutGrid className="h-3.5 w-3.5" /> مناطق</span>
            </button>
          </div>

          <div className="flex items-center gap-0.5 rounded-xl bg-[color:var(--surface-2)]/70 p-0.5 ring-1 ring-[color:var(--hairline)]">
            <button onClick={() => setNormalization('total')} className={chip(normalization === 'total')}>
              الإجمالي
            </button>
            <button onClick={() => setNormalization('per-school')} className={chip(normalization === 'per-school')}>
              لكل مدرسة
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-0.5 rounded-xl bg-[color:var(--surface-2)]/70 p-0.5 ring-1 ring-[color:var(--hairline)]">
            {(Object.keys(PERIOD_LABEL) as PeriodKey[]).map((p) => (
              <button
                key={p}
                onClick={() => {
                  setFilters((x) => ({ ...x, period: p }));
                  setTimelineIndex(null);
                }}
                className={chip(filters.period === p)}
              >
                {PERIOD_LABEL[p]}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-xs font-black text-[color:var(--maroon)]">
            <Filter className="h-3.5 w-3.5" /> الفلاتر
          </span>
          <select
            className={selectClass}
            value={filters.subjectId}
            onChange={(e) =>
              setFilters((x) => ({
                ...x,
                subjectId: e.target.value,
                gradeId: 'all',
                unitId: 'all',
              }))
            }
          >
            <option value="all">كل المواد</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
          <select
            className={selectClass}
            value={filters.gradeId}
            disabled={filters.subjectId === 'all'}
            onChange={(e) =>
              setFilters((x) => ({ ...x, gradeId: e.target.value, unitId: 'all' }))
            }
          >
            <option value="all">كل المستويات</option>
            {gradeOptions.map((g) => (
              <option key={g.id} value={g.id}>{g.title}</option>
            ))}
          </select>
          <select
            className={selectClass}
            value={filters.unitId}
            disabled={filters.gradeId === 'all'}
            onChange={(e) => setFilters((x) => ({ ...x, unitId: e.target.value }))}
          >
            <option value="all">كل الوحدات</option>
            {unitOptions.map((u) => (
              <option key={u.id} value={u.id}>{u.title}</option>
            ))}
          </select>
          <select
            className={selectClass}
            value={filters.gender}
            onChange={(e) =>
              setFilters((x) => ({
                ...x,
                gender: e.target.value as HeatmapFilters['gender'],
              }))
            }
          >
            <option value="all">بنين وبنات</option>
            {(Object.keys(GENDER_LABEL) as SchoolGender[]).map((g) => (
              <option key={g} value={g}>{GENDER_LABEL[g]}</option>
            ))}
          </select>
          <select
            className={selectClass}
            value={filters.stage}
            onChange={(e) =>
              setFilters((x) => ({
                ...x,
                stage: e.target.value as HeatmapFilters['stage'],
              }))
            }
          >
            <option value="all">كل المراحل</option>
            {(Object.keys(STAGE_LABEL) as SchoolStage[]).map((s) => (
              <option key={s} value={s}>{STAGE_LABEL[s]}</option>
            ))}
          </select>
          <select
            className={selectClass}
            value={recent}
            onChange={(e) => setRecent(e.target.value as RecentWindow)}
          >
            {(Object.keys(RECENT_LABEL) as RecentWindow[]).map((r) => (
              <option key={r} value={r}>{RECENT_LABEL[r]}</option>
            ))}
          </select>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SummaryMini
            icon={ActivityIcon}
            label={metricLabel}
            value={formatFull(total)}
          />
          <SummaryMini
            icon={School}
            label="انتشار المدارس"
            value={activeSchoolIds.size + '/' + eligibleSchools.length + ' · ' + formatPercent(activeSchoolIds.size, eligibleSchools.length || 1)}
          />
          <SummaryMini
            icon={Zap}
            label="نشطة آخر ساعة"
            value={String(activeHour)}
          />
          <SummaryMini
            icon={typeof change === 'number' && change < 0 ? TrendingDown : TrendingUp}
            label="مقارنة بالفترة السابقة"
            value={
              change === undefined
                ? 'غير متاح للكل'
                : change === null
                  ? 'بيانات جديدة'
                  : (change > 0 ? '+' : '') + change.toFixed(1) + '%'
            }
          />
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_350px]">
        <section
          ref={mapRef}
          className="relative min-h-[280px] flex-1 touch-none overflow-hidden bg-gradient-to-b from-[color:var(--surface)] to-[color:var(--surface-2)]/60 lg:min-h-0"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <canvas ref={canvasRef} className="block h-full w-full" />

          <div className="absolute right-3 top-3 z-10 w-[min(92%,440px)]">
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchQ}
                onChange={(e) => {
                  setSearchQ(e.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                placeholder="ابحث عن مدرسة…"
                className="w-full rounded-xl border border-[color:var(--hairline-strong)] bg-[color:var(--surface)]/95 py-2.5 pr-9 pl-3 text-sm font-bold shadow-lg outline-none focus:border-[color:var(--maroon)]"
              />
              {searchOpen && searchResults.length > 0 && (
                <ul className="absolute inset-x-0 top-full mt-1 max-h-64 overflow-y-auto rounded-xl border border-[color:var(--hairline)] bg-[color:var(--surface)] shadow-xl">
                  {searchResults.map((s) => (
                    <li key={s.id}>
                      <button
                        onClick={() => focusSchool(s.id)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-right text-sm hover:bg-[color:var(--surface-2)]"
                      >
                        <MapPin className="h-3.5 w-3.5 text-[color:var(--gold)]" />
                        <span className="truncate font-bold">{s.name}</span>
                        <span className="mr-auto shrink-0 text-xs text-muted-foreground">
                          {MUNICIPALITY_BY_ID[s.municipalityId].name}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {tooltip && (
            <div
              className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-[125%] rounded-lg bg-[color:var(--maroon)] px-2.5 py-1.5 text-xs font-bold text-white shadow-lg"
              style={{ left: tooltip.x, top: tooltip.y }}
            >
              {tooltip.text}
            </div>
          )}

          <div className="absolute bottom-20 left-3 flex flex-col gap-2 sm:bottom-4">
            <button
              className="icon-3d h-10 w-10 rounded-xl"
              aria-label="تكبير"
              onClick={() => {
                const w = mapRef.current;
                if (w) zoomAt(1.45, w.clientWidth / 2, w.clientHeight / 2);
              }}
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              className="icon-3d h-10 w-10 rounded-xl"
              aria-label="تصغير"
              onClick={() => {
                const w = mapRef.current;
                if (w) zoomAt(1 / 1.45, w.clientWidth / 2, w.clientHeight / 2);
              }}
            >
              <Minus className="h-4 w-4" />
            </button>
            <button className="icon-3d h-10 w-10 rounded-xl" aria-label="إعادة الضبط" onClick={() => { fit(); requestDraw(); }}>
              <Locate className="h-4 w-4" />
            </button>
          </div>

          <div className="absolute bottom-20 right-3 rounded-full bg-[color:var(--surface)]/92 px-3 py-1.5 text-xs font-black text-[color:var(--maroon)] shadow sm:bottom-4">
            {scalePct}%
          </div>

          <div className="absolute left-3 top-3 rounded-xl bg-[color:var(--surface)]/92 p-2.5 shadow ring-1 ring-[color:var(--hairline)]">
            <div className="h-2 w-32 rounded-full" style={{ background: HEAT_GRADIENT_CSS }} />
            <div className="mt-1 flex justify-between text-[10px] font-bold text-muted-foreground">
              <span>أقل</span><span>أعلى تركيزًا</span>
            </div>
            <p className="mt-1 text-[10px] font-bold text-[color:var(--gold)]">
              الحلقة الذهبية = نشاط خلال آخر ساعة
            </p>
          </div>

          {selectedMuni && (
            <button
              onClick={() => setSelectedMuni(null)}
              className="absolute left-3 top-24 flex items-center gap-1 rounded-xl bg-[color:var(--maroon)] px-3 py-1.5 text-xs font-black text-white shadow"
            >
              <MapPin className="h-3.5 w-3.5" />
              {MUNICIPALITY_BY_ID[selectedMuni].name}
              <X className="h-3 w-3" />
            </button>
          )}
        </section>

        <aside className="max-h-[38vh] shrink-0 overflow-y-auto border-t border-[color:var(--hairline)] bg-[color:var(--surface)] p-4 lg:max-h-none lg:min-h-0 lg:border-r lg:border-t-0">
          {selectedSchoolInfo ? (
            <SchoolDetail
              info={selectedSchoolInfo}
              metricLabel={metricLabel}
              metricUnit={metricUnit}
              maxBar={maxBar}
              activities={activities}
              onClose={() => setSelectedSchool(null)}
            />
          ) : (
            <>
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-[color:var(--gold)]" />
                  <h3 className="font-black text-[color:var(--maroon)]">
                    {selectedMuni
                      ? 'تحليل ' + MUNICIPALITY_BY_ID[selectedMuni].name
                      : 'ملخص الانتشار'}
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <MiniCard label="مدارس نشطة" value={String(insightSchoolIds.size)} />
                  <MiniCard label="نسبة الانتشار" value={insightSpread.toFixed(1) + '%'} />
                </div>

                <InsightList
                  title="الوحدات الأكثر استخدامًا"
                  icon={Layers3}
                  rows={topUnits.map((u) => ({
                    key: u.key,
                    title: u.title,
                    sub: u.activeSchools + ' مدارس نشطة',
                    value: formatFull(u.value),
                  }))}
                  empty="ستظهر الوحدات هنا مع بدء تسجيل التحليلات التفصيلية."
                />

                <InsightList
                  title="الأنشطة الأكثر استخدامًا"
                  icon={Sparkles}
                  rows={topActivities.map((a) => ({
                    key: a.activityId,
                    title: activityTitle(a.activityId, activities),
                    sub: 'تشغيل ' + formatFull(a.plays) + ' · تنزيل ' + formatFull(a.downloads),
                    value: formatFull(a.value),
                  }))}
                  empty="لا توجد بيانات نشاط تفصيلية لهذه الفلاتر بعد."
                />
              </section>

              <section className="mt-6 border-t border-[color:var(--hairline)] pt-5">
                <div className="mb-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-[color:var(--gold)]" />
                  <h3 className="font-black text-[color:var(--maroon)]">مقارنة منطقتين</h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    className={selectClass}
                    value={compareA}
                    onChange={(e) => setCompareA(e.target.value as MunicipalityId)}
                  >
                    {MUNICIPALITIES.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <select
                    className={selectClass}
                    value={compareB}
                    onChange={(e) => setCompareB(e.target.value as MunicipalityId)}
                  >
                    {MUNICIPALITIES.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {[compareLeft, compareRight].map((x) => (
                    <div key={x.municipality.id} className="rounded-2xl border border-[color:var(--hairline)] bg-[color:var(--surface-2)]/55 p-3">
                      <p className="font-black text-[color:var(--maroon)]">{x.municipality.name}</p>
                      <p className="mt-2 font-display text-xl font-black tabular-nums">
                        {formatFull(x.value)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {metricUnit} · {x.active}/{x.schools} مدارس نشطة
                      </p>
                      <p className="mt-2 line-clamp-2 text-[11px] font-bold text-muted-foreground">
                        {x.unit ? 'وحدة بارزة: ' + x.unit.title : 'لا توجد وحدة بارزة بعد'}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                        {x.activity
                          ? 'نشاط بارز: ' + activityTitle(x.activity.activityId, activities)
                          : 'لا توجد بيانات نشاط تفصيلية'}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-6 border-t border-[color:var(--hairline)] pt-5">
                <h3 className="mb-2 flex items-center gap-2 font-black text-[color:var(--maroon)]">
                  <School className="h-4 w-4 text-[color:var(--gold)]" />
                  مدارس ذات نشاط ملحوظ
                </h3>
                <div className="space-y-2">
                  {eligibleSchools
                    .filter((s) => (currentValues[s.id] || 0) > 0)
                    .sort(
                      (a, b) =>
                        (currentValues[b.id] || 0) - (currentValues[a.id] || 0)
                    )
                    .slice(0, 8)
                    .map((s) => (
                      <button
                        key={s.id}
                        onClick={() => focusSchool(s.id)}
                        className="flex w-full items-center gap-2 rounded-xl border border-[color:var(--hairline)] p-2.5 text-right hover:bg-[color:var(--surface-2)]"
                      >
                        <MapPin className="h-4 w-4 shrink-0 text-[color:var(--gold)]" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-black">{s.name}</span>
                          <span className="block text-[10px] text-muted-foreground">
                            {MUNICIPALITY_BY_ID[s.municipalityId].name}
                          </span>
                        </span>
                        <span className="text-xs font-black tabular-nums text-[color:var(--maroon)]">
                          {formatFull(currentValues[s.id] || 0)}
                        </span>
                      </button>
                    ))}
                </div>
              </section>

              <p className="mt-5 rounded-xl bg-[color:var(--gold)]/10 px-3 py-2 text-[11px] font-bold leading-5 text-[color:var(--gold)]">
                ملاحظة: التحليل التفصيلي حسب الوحدة والتاريخ يبدأ من تاريخ نشر هذه النسخة؛
                الأرقام التراكمية القديمة تبقى محفوظة في عرض «الكل».
              </p>
            </>
          )}
        </aside>
      </main>

      <footer className="border-t border-[color:var(--hairline)] bg-[color:var(--surface)] px-3 py-2">
        <div className="flex items-center gap-3">
          <button
            onClick={playTimeline}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color:var(--maroon)] text-white shadow"
            aria-label={playing ? 'إيقاف الحركة الزمنية' : 'تشغيل الحركة الزمنية'}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
          </button>
          <CalendarDays className="hidden h-4 w-4 text-[color:var(--gold)] sm:block" />
          <input
            type="range"
            min={0}
            max={Math.max(0, periodWindow.playback.length - 1)}
            value={
              timelineIndex === null
                ? Math.max(0, periodWindow.playback.length - 1)
                : timelineIndex
            }
            onChange={(e) => {
              if (timerRef.current) clearInterval(timerRef.current);
              timerRef.current = null;
              setPlaying(false);
              setTimelineIndex(Number(e.target.value));
            }}
            className="h-1.5 min-w-0 flex-1 cursor-pointer accent-[color:var(--maroon)]"
          />
          <span className="shrink-0 text-xs font-bold tabular-nums text-muted-foreground">
            {timelineIndex === null
              ? periodWindow.label
              : new Date(periodWindow.playback[timelineIndex] + 'T12:00:00').toLocaleDateString('ar-QA', {
                  day: 'numeric',
                  month: 'short',
                })}
          </span>
          {timelineIndex !== null && (
            <button
              onClick={() => setTimelineIndex(null)}
              className="rounded-lg px-2 py-1 text-xs font-black text-[color:var(--maroon)] hover:bg-[color:var(--surface-2)]"
            >
              الإجمالي
            </button>
          )}
        </div>
      </footer>
    </div>,
    document.body
  );
}

function SummaryMini({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-xl border border-[color:var(--hairline)] bg-[color:var(--surface-2)]/55 px-3 py-2">
      <Icon className="h-4 w-4 shrink-0 text-[color:var(--gold)]" />
      <span className="min-w-0">
        <span className="block truncate text-[10px] font-bold text-muted-foreground">{label}</span>
        <span className="block truncate text-sm font-black tabular-nums text-foreground">{value}</span>
      </span>
    </div>
  );
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[color:var(--hairline)] bg-[color:var(--surface-2)]/55 p-3">
      <p className="text-[10px] font-bold text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl font-black tabular-nums text-[color:var(--maroon)]">
        {value}
      </p>
    </div>
  );
}

function InsightList({
  title,
  icon: Icon,
  rows,
  empty,
}: {
  title: string;
  icon: typeof Layers3;
  rows: { key: string; title: string; sub: string; value: string }[];
  empty: string;
}) {
  return (
    <div className="mt-5">
      <h4 className="mb-2 flex items-center gap-2 text-xs font-black text-foreground">
        <Icon className="h-3.5 w-3.5 text-[color:var(--gold)]" /> {title}
      </h4>
      {rows.length ? (
        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.key}
              className="flex items-start gap-2 rounded-xl border border-[color:var(--hairline)] bg-[color:var(--surface-2)]/45 p-2.5"
            >
              <span className="min-w-0 flex-1">
                <span className="block line-clamp-2 text-xs font-black">{row.title}</span>
                <span className="mt-0.5 block text-[10px] text-muted-foreground">{row.sub}</span>
              </span>
              <span className="shrink-0 text-xs font-black tabular-nums text-[color:var(--maroon)]">
                {row.value}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-[color:var(--hairline-strong)] p-3 text-[11px] leading-5 text-muted-foreground">
          {empty}
        </p>
      )}
    </div>
  );
}

function SchoolDetail({
  info,
  metricLabel,
  metricUnit,
  maxBar,
  activities,
  onClose,
}: {
  info: {
    school: (typeof QATAR_SCHOOLS)[number];
    value: number;
    lastActiveAt: number;
    unit?: { title: string } | null;
    activity?: { activityId: string } | null;
    bars: { day: string; value: number }[];
  };
  metricLabel: string;
  metricUnit: string;
  maxBar: number;
  activities: Activity[];
  onClose: () => void;
}) {
  return (
    <section>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-black text-[color:var(--gold)]">تحليل المدرسة</p>
          <h3 className="mt-1 font-display text-lg font-black text-[color:var(--maroon)]">
            {info.school.name}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {MUNICIPALITY_BY_ID[info.school.municipalityId].name} · {STAGE_LABEL[info.school.stage]} · {GENDER_LABEL[info.school.gender]}
          </p>
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-[color:var(--surface-2)]">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <MiniCard label={metricLabel} value={formatFull(info.value) + ' ' + metricUnit} />
        <MiniCard
          label="آخر نشاط"
          value={
            info.lastActiveAt
              ? new Date(info.lastActiveAt).toLocaleDateString('ar-QA', {
                  day: 'numeric',
                  month: 'short',
                })
              : '—'
          }
        />
      </div>

      <div className="mt-4 rounded-2xl border border-[color:var(--hairline)] bg-[color:var(--surface-2)]/45 p-3">
        <p className="text-xs font-black text-foreground">آخر 7 أيام</p>
        <div className="mt-3 flex h-24 items-end gap-1.5">
          {info.bars.map((b) => (
            <div key={b.day} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <div
                className="w-full rounded-t-md bg-[color:var(--maroon)]/80"
                style={{ height: Math.max(3, (b.value / maxBar) * 72) }}
                title={formatFull(b.value)}
              />
              <span className="text-[8px] font-bold text-muted-foreground">
                {new Date(b.day + 'T12:00:00').toLocaleDateString('ar-QA', { day: 'numeric' })}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-xs font-black text-foreground">أبرز الاستخدام</p>
        <p className="rounded-xl border border-[color:var(--hairline)] p-3 text-xs leading-5">
          <b className="text-[color:var(--maroon)]">الوحدة:</b>{' '}
          {info.unit?.title || 'لا توجد بيانات تفصيلية بعد'}
        </p>
        <p className="rounded-xl border border-[color:var(--hairline)] p-3 text-xs leading-5">
          <b className="text-[color:var(--maroon)]">النشاط:</b>{' '}
          {info.activity
            ? activityTitle(info.activity.activityId, activities)
            : 'لا توجد بيانات تفصيلية بعد'}
        </p>
      </div>
    </section>
  );
}
