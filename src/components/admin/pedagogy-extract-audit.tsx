'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, CheckCircle2, Loader2, Sparkles, Wand2, X } from 'lucide-react';
import type { Activity, Pedagogy, Subject } from '@/lib/types';
import { isFirebaseConfigured } from '@/lib/firebase';
import { fetchUploadedActivities, getStructure, locateActivity, updateActivity } from '@/lib/content';
import { revalidateContent } from '@/lib/revalidate';
import { normalizePedagogy, pedagogyStatus, PHASE_LABEL } from '@/lib/pedagogy';
import type { PedagogyExtraction } from '@/lib/pedagogy-extract';
import { activityKind, loadActivityHtml, requestPedagogyExtraction } from '@/lib/pedagogy-extract-client';
import { cn } from '@/lib/utils';

/** أقسام المنصّة كما تظهر في لوحة الإدارة */
type Section = 'all' | 'presentations' | 'lessons' | 'smart' | 'reviews';
const SECTIONS: { id: Section; label: string; match: (a: Activity) => boolean }[] = [
  { id: 'all', label: 'كل الأقسام', match: () => true },
  { id: 'lessons', label: 'أنشطة الدروس', match: (a) => !a.presentation && !a.unitReview && !a.smartReinforcement },
  { id: 'presentations', label: 'العروض الذكية', match: (a) => !!a.presentation },
  { id: 'smart', label: 'ألعاب التعزيز', match: (a) => !!a.smartReinforcement },
  { id: 'reviews', label: 'مراجعات الوحدات', match: (a) => !!a.unitReview },
];

type RowState =
  | { kind: 'idle' }
  | { kind: 'working'; step: string }
  | { kind: 'ready'; result: PedagogyExtraction }
  | { kind: 'saved' }
  | { kind: 'error'; message: string };

/**
 * يدمج المستخرَج مع الموجود: بلا «استبدال» يُكمل الحقول الفارغة فقط ويُبقي
 * ما كتبه المشرف، ومع «استبدال» يحلّ المستخرَج محلّ الموجود.
 */
function merge(current: Pedagogy | undefined, extracted: Pedagogy, overwrite: boolean): Pedagogy {
  if (overwrite || !current) return extracted;
  const out: Pedagogy = { ...current };
  if (!out.objective) out.objective = extracted.objective;
  if (!out.outcomes?.length) out.outcomes = extracted.outcomes;
  if (!out.duration) out.duration = extracted.duration;
  if (!out.phase) out.phase = extracted.phase;
  if (!out.usage) out.usage = extracted.usage;
  if (!out.support) out.support = extracted.support;
  if (!out.exitTicket?.length) out.exitTicket = extracted.exitTicket;
  return out;
}

function SourceTag({ fromDeck }: { fromDeck: boolean }) {
  return (
    <span
      className={cn(
        'mr-1.5 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold align-middle',
        fromDeck ? 'bg-[color:var(--teal)]/15 text-[color:var(--teal)]' : 'bg-[color:var(--gold)]/20 text-[color:var(--maroon)]'
      )}
    >
      {fromDeck ? 'من الملف' : 'مقترح'}
    </span>
  );
}

/** معاينة ما سيُحفظ، مع وسم كل جزء: مأخوذ من الملف أم مقترح من النموذج. */
function ResultPreview({ result }: { result: PedagogyExtraction }) {
  const p = result.pedagogy;
  return (
    <div className="mt-3 space-y-3 rounded-xl border border-[color:var(--hairline)] bg-[color:var(--surface)] p-3 text-sm leading-7">
      {p.objective && (
        <div>
          <p className="text-xs font-bold text-[color:var(--maroon)]">
            الهدف التعليمي <SourceTag fromDeck={result.fromDeck.objective} />
          </p>
          <p>{p.objective}</p>
        </div>
      )}
      {p.outcomes?.length ? (
        <div>
          <p className="text-xs font-bold text-[color:var(--maroon)]">
            نواتج التعلّم <SourceTag fromDeck={result.fromDeck.outcomes} />
          </p>
          <ul className="list-disc pr-5">
            {p.outcomes.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {p.exitTicket?.length ? (
        <div>
          <p className="text-xs font-bold text-[color:var(--maroon)]">أسئلة التقويم الختامي</p>
          <ol className="list-decimal space-y-1.5 pr-5">
            {p.exitTicket.map((q, i) => (
              <li key={q.q}>
                {q.q} <SourceTag fromDeck={result.fromDeck.questions[i] ?? false} />
                <span className="mt-1 flex flex-wrap gap-1.5">
                  {q.options.map((o, j) => (
                    <span
                      key={o}
                      className={cn(
                        'rounded-lg px-2 py-0.5 text-xs',
                        j === q.answer
                          ? 'bg-[color:var(--teal)]/15 font-bold text-[color:var(--teal)]'
                          : 'bg-[color:var(--surface-2)] text-muted-foreground'
                      )}
                    >
                      {j === q.answer && <Check className="ml-1 inline h-3 w-3" aria-label="الإجابة الصحيحة" />}
                      {o}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">
        {[p.phase && PHASE_LABEL[p.phase], p.duration && `${p.duration} دقيقة`].filter(Boolean).join(' • ')}
        {(p.usage || p.support) && ' • مع طريقة التوظيف ومراعاة الفروق الفردية (مقترحة)'}
      </p>
    </div>
  );
}

/**
 * استخراج البيانات التربوية من ملفات كل الأقسام (أنشطة الدروس، العروض الذكية،
 * ألعاب التعزيز، مراجعات الوحدات): يُقرأ نصّ الملف في المتصفّح، ويحلّله النموذج
 * على الخادم، فتُعرض الأهداف والنواتج والأسئلة للمراجعة ثم تُحفظ بضغطة.
 */
export function PedagogyExtractAudit({
  activities: initial,
  structure: initialStructure,
}: {
  activities: Activity[];
  structure: Subject[];
}) {
  const [activities, setActivities] = useState<Activity[]>(initial);
  const [structure, setStructure] = useState<Subject[]>(initialStructure);
  const [overwrite, setOverwrite] = useState(false);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [bulk, setBulk] = useState(false);
  const [notice, setNotice] = useState('');
  const [section, setSection] = useState<Section>('all');

  useEffect(() => {
    let alive = true;
    (async () => {
      if (isFirebaseConfigured) {
        const [acts, tree] = await Promise.all([fetchUploadedActivities(), getStructure()]);
        if (!alive) return;
        if (acts.length) setActivities(acts);
        setStructure(tree);
      } else {
        const { listLocalActivities } = await import('@/lib/local-store');
        const acts = await listLocalActivities();
        if (alive && acts.length) setActivities((list) => [...list.filter((a) => !acts.some((x) => x.id === a.id)), ...acts]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // المرفوعة فقط: الأنشطة المضمَّنة في الكود لا تُعدَّل من هنا
  const uploaded = useMemo(
    () =>
      activities
        .filter((a) => a.local || a.stored === 'firestore' || a.external)
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
    [activities]
  );
  const files = uploaded.filter(SECTIONS.find((x) => x.id === section)!.match);
  const incomplete = files.filter((a) => !pedagogyStatus(a.pedagogy).complete);
  const ready = files.filter((a) => rows[a.id]?.kind === 'ready');

  const setRow = (id: string, s: RowState) => setRows((r) => ({ ...r, [id]: s }));

  async function extract(a: Activity): Promise<void> {
    try {
      setRow(a.id, { kind: 'working', step: 'جارٍ قراءة الملف…' });
      const html = await loadActivityHtml(a);
      if (!html) throw new Error('تعذّر تحميل ملف النشاط.');
      setRow(a.id, { kind: 'working', step: 'جارٍ التحليل…' });
      const { subject, grade, unit, lesson } = locateActivity(structure, a);
      const result = await requestPedagogyExtraction(html, {
        kind: activityKind(a),
        title: a.title,
        subject: a.smartReinforcement ? undefined : subject?.title,
        grade: a.smartReinforcement ? undefined : grade?.title,
        lesson: a.smartReinforcement ? undefined : a.unitReview ? unit?.title : lesson?.title,
      });
      setRow(a.id, { kind: 'ready', result });
    } catch (e) {
      setRow(a.id, { kind: 'error', message: e instanceof Error ? e.message : 'خطأ غير متوقّع.' });
    }
  }

  async function save(a: Activity, result: PedagogyExtraction): Promise<boolean> {
    const pedagogy = normalizePedagogy(merge(a.pedagogy, result.pedagogy, overwrite));
    if (!pedagogy) return false;
    try {
      if (isFirebaseConfigured && !a.local) {
        await updateActivity(a.id, { pedagogy });
      } else {
        const { getLocalRecord, saveLocalActivity } = await import('@/lib/local-store');
        const rec = await getLocalRecord(a.id);
        if (!rec || !(await saveLocalActivity({ ...rec.activity, pedagogy }, rec.html))) throw new Error('تعذّر الحفظ في المتصفّح.');
      }
      setActivities((list) => list.map((x) => (x.id === a.id ? { ...x, pedagogy } : x)));
      setRow(a.id, { kind: 'saved' });
      return true;
    } catch (e) {
      setRow(a.id, { kind: 'error', message: e instanceof Error ? e.message : 'تعذّر الحفظ.' });
      return false;
    }
  }

  async function extractAll() {
    setBulk(true);
    setNotice('');
    // واحدًا تلو الآخر: الملفات كبيرة، وحصّة النموذج المجانية محدودة
    for (const a of incomplete) await extract(a);
    setBulk(false);
  }

  async function saveAll() {
    setBulk(true);
    let ok = 0;
    let subjectId: string | undefined;
    for (const a of ready) {
      const s = rows[a.id];
      if (s?.kind === 'ready' && (await save(a, s.result))) {
        ok++;
        subjectId = a.subjectId;
      }
    }
    if (ok && isFirebaseConfigured) await revalidateContent({ subjectId });
    setNotice(`حُفظت البيانات التربوية لـ ${ok} ملفًا.`);
    setBulk(false);
  }

  async function saveOne(a: Activity, result: PedagogyExtraction) {
    if ((await save(a, result)) && isFirebaseConfigured) await revalidateContent({ subjectId: a.subjectId });
  }

  return (
    <div className="panel rounded-2xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
            <Wand2 className="h-5 w-5 text-[color:var(--maroon)]" />
            استخراج البيانات التربوية من الملفات
            <span className="beta-pill">تجريبي</span>
          </p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            لكل ملف مرفوع في أي قسم يُقرأ نصّه ويُستخرج منه الهدف التعليمي ونواتج التعلّم وأسئلة التقويم الختامي
            (مع إجاباتها) وموضع التوظيف وطريقته، ثم تراجعها وتعتمدها فتُحفظ في حقول النشاط نفسها. يوسم كل جزء
            بـ«من الملف» أو «مقترح». ويتمّ الاستخراج تلقائيًا أيضًا عند اختيار الملف في نماذج الرفع.
          </p>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[color:var(--maroon)]"
            checked={overwrite}
            onChange={(e) => setOverwrite(e.target.checked)}
          />
          استبدال البيانات الموجودة
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="الأقسام">
        {SECTIONS.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={section === x.id}
            onClick={() => setSection(x.id)}
            className={cn('level-tab', section === x.id && 'is-on')}
          >
            {x.label} ({uploaded.filter(x.match).length})
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold">
        <span className="rounded-full bg-[color:var(--surface-2)] px-3 py-1.5">الملفات: {files.length}</span>
        <span className="rounded-full bg-[color:var(--gold)]/20 px-3 py-1.5 text-[color:var(--maroon)]">
          ناقصة البيانات: {incomplete.length}
        </span>
        {ready.length > 0 && (
          <span className="rounded-full bg-[color:var(--teal)]/15 px-3 py-1.5 text-[color:var(--teal)]">
            جاهزة للاعتماد: {ready.length}
          </span>
        )}
      </div>

      {files.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">لا توجد ملفات مرفوعة في هذا القسم بعد.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {files.map((a) => {
            const s = rows[a.id] ?? { kind: 'idle' };
            const st = pedagogyStatus(a.pedagogy);
            const { subject, lesson } = locateActivity(structure, a);
            return (
              <li key={a.id} className="rounded-xl border border-[color:var(--hairline)] p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-foreground">{a.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[subject?.title, lesson?.title].filter(Boolean).join(' ← ')}
                      {' • '}
                      {st.complete ? (
                        <span className="text-[color:var(--teal)]">البيانات مكتملة</span>
                      ) : (
                        <span className="text-[color:var(--coral)]">ناقص: {st.missing.join('، ')}</span>
                      )}
                    </p>
                  </div>
                  {s.kind === 'working' ? (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> {s.step}
                    </span>
                  ) : s.kind === 'ready' ? (
                    <div className="flex gap-2">
                      <button type="button" disabled={bulk} onClick={() => void saveOne(a, s.result)} className="btn-primary btn-sm px-3 py-1.5 text-xs">
                        <Check className="h-4 w-4" /> اعتماد
                      </button>
                      <button type="button" disabled={bulk} onClick={() => setRow(a.id, { kind: 'idle' })} className="btn-ghost btn-sm px-3 py-1.5 text-xs">
                        <X className="h-4 w-4" /> تجاهل
                      </button>
                    </div>
                  ) : s.kind === 'saved' ? (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-[color:var(--teal)]">
                      <CheckCircle2 className="h-4 w-4" /> حُفظت
                    </span>
                  ) : (
                    <button type="button" disabled={bulk} onClick={() => void extract(a)} className="btn-ghost btn-sm px-3 py-1.5 text-xs">
                      <Wand2 className="h-4 w-4" /> استخراج
                    </button>
                  )}
                </div>
                {s.kind === 'error' && (
                  <p role="alert" className="mt-2 rounded-lg bg-[color:var(--coral)]/15 px-3 py-1.5 text-xs font-bold text-[color:var(--coral)]">
                    {s.message}
                  </p>
                )}
                {s.kind === 'ready' && <ResultPreview result={s.result} />}
              </li>
            );
          })}
        </ul>
      )}

      {notice && (
        <p className="mt-3 rounded-xl bg-[color:var(--teal)]/15 px-4 py-2.5 text-sm font-bold text-[color:var(--teal)]">{notice}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void extractAll()}
          disabled={bulk || incomplete.length === 0}
          className="btn-primary px-5 py-2.5 text-sm"
        >
          {bulk ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {incomplete.length > 0 ? `استخراج من ${incomplete.length} ملفًا ناقصًا` : 'كل الملفات هنا مكتملة البيانات'}
        </button>
        {ready.length > 0 && (
          <button type="button" onClick={() => void saveAll()} disabled={bulk} className="btn-ghost px-5 py-2.5 text-sm">
            <Check className="h-4 w-4" /> اعتماد الكل ({ready.length})
          </button>
        )}
      </div>
    </div>
  );
}
