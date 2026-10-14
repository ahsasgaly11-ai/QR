'use client';

import { useState } from 'react';
import { ClipboardCheck, Plus, Target, Trash2 } from 'lucide-react';
import type { ExitQuestion, LessonPhase, Pedagogy } from '@/lib/types';
import { PEDAGOGY_LIMITS, PHASES, parseOutcomes, pedagogyStatus } from '@/lib/pedagogy';

/**
 * مسوّدة النموذج: النواتج نصّ متعدّد الأسطر والمدة نصّ، فتُكتب بحرّية ثم
 * تُحوَّل إلى Pedagogy منظّفة عند الحفظ (انظر draftToPedagogy).
 */
export interface PedagogyDraft {
  objective: string;
  outcomesText: string;
  duration: string;
  phase: LessonPhase | '';
  usage: string;
  support: string;
  exitTicket: ExitQuestion[];
}

export const EMPTY_PEDAGOGY_DRAFT: PedagogyDraft = {
  objective: '',
  outcomesText: '',
  duration: '',
  phase: '',
  usage: '',
  support: '',
  exitTicket: [],
};

export function pedagogyToDraft(p: Pedagogy | undefined): PedagogyDraft {
  return {
    objective: p?.objective ?? '',
    outcomesText: (p?.outcomes ?? []).join('\n'),
    duration: p?.duration ? String(p.duration) : '',
    phase: p?.phase ?? '',
    usage: p?.usage ?? '',
    support: p?.support ?? '',
    exitTicket: (p?.exitTicket ?? []).map((q) => ({ ...q, options: [...q.options] })),
  };
}

/** القيمة الخام للمسوّدة — تُمرَّر إلى normalizePedagogy قبل الحفظ. */
export function draftToPedagogy(d: PedagogyDraft): Pedagogy {
  return {
    objective: d.objective,
    outcomes: parseOutcomes(d.outcomesText),
    duration: Number(d.duration) || undefined,
    phase: d.phase || undefined,
    usage: d.usage,
    support: d.support,
    exitTicket: d.exitTicket,
  };
}

const NEW_Q: ExitQuestion = { q: '', options: ['', ''], answer: 0 };

export function PedagogyFields({
  value,
  onChange,
  inputClass,
  labelClass,
}: {
  value: PedagogyDraft;
  onChange: (next: PedagogyDraft) => void;
  inputClass: string;
  labelClass: string;
}) {
  const [open, setOpen] = useState(true);
  const set = (patch: Partial<PedagogyDraft>) => onChange({ ...value, ...patch });
  const status = pedagogyStatus(draftToPedagogy(value));

  const setQ = (i: number, patch: Partial<ExitQuestion>) =>
    set({ exitTicket: value.exitTicket.map((q, k) => (k === i ? { ...q, ...patch } : q)) });
  const setOpt = (i: number, j: number, text: string) =>
    setQ(i, { options: value.exitTicket[i].options.map((o, k) => (k === j ? text : o)) });

  return (
    <fieldset className="mt-6 rounded-2xl border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/5 p-4">
      <legend className="flex items-center gap-2 px-1 text-sm font-extrabold text-[color:var(--maroon)]">
        <Target className="h-4 w-4" /> الهدف التعليمي والتقويم
      </legend>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs leading-5 text-muted-foreground">
          يظهر للمعلّم في صفحة النشاط، ويقرؤه المحكّم ليعرف ما الذي يخدمه النشاط وكيف يُقاس أثره.
        </p>
        <button type="button" onClick={() => setOpen((v) => !v)} className="btn-ghost btn-sm px-3 py-1.5 text-xs">
          {open ? 'طيّ' : 'عرض'}
        </button>
      </div>
      <p
        className={
          'mt-2 rounded-lg px-3 py-1.5 text-xs font-bold ' +
          (status.complete
            ? 'bg-[color:var(--teal)]/15 text-[color:var(--teal)]'
            : 'bg-[color:var(--surface-2)] text-muted-foreground')
        }
      >
        {status.complete ? 'البيانات التربوية مكتملة ✓' : `ناقص: ${status.missing.join('، ')}`}
      </p>

      {open && (
        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="ped-objective" className={labelClass}>الهدف التعليمي</label>
            <input
              id="ped-objective"
              className={inputClass}
              value={value.objective}
              maxLength={PEDAGOGY_LIMITS.objective}
              onChange={(e) => set({ objective: e.target.value })}
              placeholder="مثال: أن يصنّف الطالب الأسنان إلى قواطع وأنياب وأضراس بحسب وظيفتها"
            />
          </div>

          <div>
            <label htmlFor="ped-outcomes" className={labelClass}>
              نواتج التعلّم <span className="font-normal text-muted-foreground">(ناتج في كل سطر)</span>
            </label>
            <textarea
              id="ped-outcomes"
              className={inputClass}
              rows={3}
              value={value.outcomesText}
              onChange={(e) => set({ outcomesText: e.target.value })}
              placeholder={'يسمّي أنواع الأسنان الثلاثة\nيربط كل نوع بوظيفته في المضغ\nيفسّر أهمية العناية بالأسنان'}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className={labelClass}>موضع التوظيف في الدرس</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="موضع التوظيف">
                {PHASES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => set({ phase: value.phase === p.id ? '' : p.id })}
                    aria-pressed={value.phase === p.id}
                    title={p.hint}
                    className={
                      'rounded-xl px-3 py-2 text-sm font-bold transition ' +
                      (value.phase === p.id
                        ? 'bg-[color:var(--maroon)] text-white shadow-md'
                        : 'bg-[color:var(--surface-2)] text-[color:var(--maroon)] hover:brightness-95')
                    }
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="ped-duration" className={labelClass}>المدة المقترحة (دقائق)</label>
              <input
                id="ped-duration"
                className={inputClass}
                type="number"
                min={1}
                max={PEDAGOGY_LIMITS.durationMax}
                inputMode="numeric"
                value={value.duration}
                onChange={(e) => set({ duration: e.target.value })}
                placeholder="مثال: 15"
              />
            </div>
          </div>

          <div>
            <label htmlFor="ped-usage" className={labelClass}>طريقة التوظيف في الصف</label>
            <textarea
              id="ped-usage"
              className={inputClass}
              rows={3}
              maxLength={PEDAGOGY_LIMITS.usage}
              value={value.usage}
              onChange={(e) => set({ usage: e.target.value })}
              placeholder="مثال: يعرض المعلّم النشاط على السبورة ويطلب من الطلبة التنبّؤ قبل كل خطوة، ثم يعمل الطلبة في ثنائيات على الأجهزة ويسجّلون ملاحظاتهم…"
            />
          </div>

          <div>
            <label htmlFor="ped-support" className={labelClass}>
              الفروق الفردية وأدوات الدعم <span className="font-normal text-muted-foreground">(اختياري)</span>
            </label>
            <textarea
              id="ped-support"
              className={inputClass}
              rows={2}
              maxLength={PEDAGOGY_LIMITS.support}
              value={value.support}
              onChange={(e) => set({ support: e.target.value })}
              placeholder="مثال: للطلبة بطيئي التعلّم يُعاد النشاط بوضع التلميحات؛ للمتفوّقين سؤال تحدٍّ إضافي؛ متاح بلغة الإشارة والتباين العالي"
            />
          </div>

          <div className="rounded-xl border border-[color:var(--hairline)] bg-[color:var(--surface)] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-sm font-extrabold text-[color:var(--maroon)]">
                <ClipboardCheck className="h-4 w-4" /> التقويم الختامي (تذكرة الخروج)
              </p>
              {value.exitTicket.length < PEDAGOGY_LIMITS.questions && (
                <button
                  type="button"
                  onClick={() => set({ exitTicket: [...value.exitTicket, { ...NEW_Q, options: ['', ''] }] })}
                  className="btn-ghost btn-sm px-3 py-1.5 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" /> سؤال
                </button>
              )}
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              من 1 إلى 3 أسئلة اختيار من متعدّد تظهر للطالب بعد النشاط. تُسجَّل النتائج بلا أسماء
              وتظهر «نسبة الإتقان» في لوحة الإحصاءات، وهي دليل التعلّم الذي يطلبه المحكّم.
            </p>
            {value.exitTicket.map((q, i) => (
              <div key={i} className="mt-3 rounded-lg border border-[color:var(--hairline)] p-3">
                <div className="flex items-start gap-2">
                  <input
                    className={inputClass}
                    value={q.q}
                    maxLength={PEDAGOGY_LIMITS.question}
                    onChange={(e) => setQ(i, { q: e.target.value })}
                    placeholder={`السؤال ${i + 1}`}
                    aria-label={`نص السؤال ${i + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => set({ exitTicket: value.exitTicket.filter((_, k) => k !== i) })}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[color:var(--coral)]/15 text-[color:var(--coral)]"
                    aria-label={`حذف السؤال ${i + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {q.options.map((o, j) => (
                    <label key={j} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={`ped-q-${i}-answer`}
                        checked={q.answer === j}
                        onChange={() => setQ(i, { answer: j })}
                        className="accent-[color:var(--maroon)]"
                        aria-label={`الإجابة الصحيحة هي الخيار ${j + 1}`}
                      />
                      <input
                        className={inputClass}
                        value={o}
                        maxLength={PEDAGOGY_LIMITS.option}
                        onChange={(e) => setOpt(i, j, e.target.value)}
                        placeholder={`الخيار ${j + 1}`}
                        aria-label={`الخيار ${j + 1} للسؤال ${i + 1}`}
                      />
                      {q.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() =>
                            setQ(i, {
                              options: q.options.filter((_, k) => k !== j),
                              answer: q.answer === j ? 0 : q.answer > j ? q.answer - 1 : q.answer,
                            })
                          }
                          className="text-xs text-muted-foreground hover:text-[color:var(--coral)]"
                          aria-label={`حذف الخيار ${j + 1}`}
                        >
                          ✕
                        </button>
                      )}
                    </label>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">علّم الدائرة بجانب الإجابة الصحيحة.</span>
                  {q.options.length < PEDAGOGY_LIMITS.options && (
                    <button
                      type="button"
                      onClick={() => setQ(i, { options: [...q.options, ''] })}
                      className="text-xs font-bold text-[color:var(--maroon)] hover:underline"
                    >
                      + خيار
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </fieldset>
  );
}
