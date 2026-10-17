'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, CheckCircle2, Loader2, Presentation, Sparkles, Wand2, X } from 'lucide-react';
import type { Activity, Pedagogy, Subject } from '@/lib/types';
import { isFirebaseConfigured } from '@/lib/firebase';
import { fetchUploadedActivities, getStructure, locateActivity, updateActivity } from '@/lib/content';
import { revalidateContent } from '@/lib/revalidate';
import { normalizePedagogy, pedagogyStatus, PHASE_LABEL } from '@/lib/pedagogy';
import type { PedagogyExtraction } from '@/lib/pedagogy-extract';
import { cn } from '@/lib/utils';

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
      {fromDeck ? 'من العرض' : 'مقترح'}
    </span>
  );
}

/** معاينة ما سيُحفظ، مع وسم كل جزء: مأخوذ من العرض أم مقترح من النموذج. */
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
 * استخراج البيانات التربوية من العروض التقديمية الذكية: يُقرأ نصّ الشرائح في
 * المتصفّح، ويحلّله النموذج على الخادم، فتُعرض الأهداف والنواتج والأسئلة
 * للمراجعة ثم تُحفظ في حقول النشاط التربوية بضغطة.
 */
export function PresentationPedagogyExtract({
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

  const decks = useMemo(
    () => activities.filter((a) => a.presentation).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
    [activities]
  );
  const incomplete = decks.filter((a) => !pedagogyStatus(a.pedagogy).complete);
  const ready = decks.filter((a) => rows[a.id]?.kind === 'ready');

  const setRow = (id: string, s: RowState) => setRows((r) => ({ ...r, [id]: s }));

  async function extract(a: Activity): Promise<void> {
    try {
      setRow(a.id, { kind: 'working', step: 'جارٍ قراءة العرض…' });
      let html: string | null = null;
      if (a.local) {
        const { getLocalRecord } = await import('@/lib/local-store');
        html = (await getLocalRecord(a.id))?.html ?? null;
      } else if (a.stored === 'firestore') {
        const { loadGameHtml } = await import('@/lib/game-store');
        html = await loadGameHtml(a.id);
      } else {
        const res = await fetch(a.external ? a.file : `/games/${a.file}`);
        html = res.ok ? await res.text() : null;
      }
      if (!html) throw new Error('تعذّر تحميل ملف العرض.');

      const { extractDeckText } = await import('@/lib/deck-text');
      const text = extractDeckText(html);

      setRow(a.id, { kind: 'working', step: 'جارٍ التحليل…' });
      const { getIdToken } = await import('@/lib/auth');
      const token = await getIdToken();
      if (!token) throw new Error('سجّل الدخول بحساب المالك أولًا (يتطلّب Firebase).');
      const { subject, grade, lesson } = locateActivity(structure, a);
      const res = await fetch('/api/extract-pedagogy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text, title: a.title, subject: subject?.title, grade: grade?.title, lesson: lesson?.title }),
      });
      const json = (await res.json().catch(() => ({}))) as Partial<PedagogyExtraction> & { error?: string };
      if (!res.ok || !json.pedagogy) throw new Error(json.error || `تعذّر التحليل (${res.status}).`);
      setRow(a.id, { kind: 'ready', result: json as PedagogyExtraction });
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
    // واحدًا تلو الآخر: لكل عرض ملف كبير، وحصّة النموذج المجانية محدودة
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
    setNotice(`حُفظت البيانات التربوية لـ ${ok} عرضًا.`);
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
            <Presentation className="h-5 w-5 text-[color:var(--maroon)]" />
            العروض التقديمية الذكية: استخراج البيانات التربوية
            <span className="beta-pill">تجريبي</span>
          </p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            يُقرأ نصّ شرائح كل عرض ويُستخرج منه الهدف التعليمي ونواتج التعلّم وأسئلة التقويم الختامي (مع
            إجاباتها) وموضع التوظيف وطريقته، ثم تراجعها وتعتمدها فتُحفظ في حقول العرض نفسها. يوسم كل جزء بـ«من
            العرض» أو «مقترح».
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

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold">
        <span className="rounded-full bg-[color:var(--surface-2)] px-3 py-1.5">العروض: {decks.length}</span>
        <span className="rounded-full bg-[color:var(--gold)]/20 px-3 py-1.5 text-[color:var(--maroon)]">
          ناقصة البيانات: {incomplete.length}
        </span>
        {ready.length > 0 && (
          <span className="rounded-full bg-[color:var(--teal)]/15 px-3 py-1.5 text-[color:var(--teal)]">
            جاهزة للاعتماد: {ready.length}
          </span>
        )}
      </div>

      {decks.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">لا توجد عروض مرفوعة بعد — ارفعها من تبويب «العروض الذكية».</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {decks.map((a) => {
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
          {incomplete.length > 0 ? `استخراج من ${incomplete.length} عرضًا ناقصًا` : 'كل العروض مكتملة البيانات'}
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
