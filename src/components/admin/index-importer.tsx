'use client';

import { useState } from 'react';
import {
  ImagePlus,
  ClipboardPaste,
  Loader2,
  CheckCircle2,
  X,
  ListChecks,
  AlertTriangle,
  Wand2,
  FileText,
} from 'lucide-react';
import type { Subject } from '@/lib/types';
import {
  parseIndexText,
  countSelected,
  type ParsedUnit,
} from '@/lib/index-parser';
import { getIdToken } from '@/lib/auth';
import { cn } from '@/lib/utils';

type Mode = 'choose' | 'text' | 'review';

export function IndexImporter({
  subjects,
  onImport,
  onClose,
}: {
  subjects: Subject[];
  /** يُضيف الوحدات/الدروس المعتمدة إلى شجرة المناهج في المحرّر */
  onImport: (units: ParsedUnit[], subjectId: string, gradeId: string) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>('choose');
  const [raw, setRaw] = useState('');
  const [units, setUnits] = useState<ParsedUnit[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const withGrades = subjects.filter((s) => s.grades.length > 0);
  const [subjectId, setSubjectId] = useState(withGrades[0]?.id ?? subjects[0]?.id ?? '');
  const subject = subjects.find((s) => s.id === subjectId);
  const [gradeId, setGradeId] = useState(subject?.grades[0]?.id ?? '');

  const input =
    'w-full rounded-xl border border-[color:var(--hairline-strong)] bg-[color:var(--surface)] px-4 py-2.5 text-sm font-bold outline-none focus:border-[color:var(--maroon)]';

  function analyse(text: string) {
    const parsed = parseIndexText(text);
    if (parsed.length === 0) {
      setError('لم نتعرّف على أي وحدات أو دروس. تأكّد أن النص يحتوي أسطر الفهرس.');
      return;
    }
    setUnits(parsed);
    setError('');
    setMode('review');
  }

  const toDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(new Error(`تعذّر قراءة ${file.name}`));
      fr.readAsDataURL(file);
    });

  /** يرسل الملفات (صور أو PDF ممسوح) إلى الخادم للقراءة البصرية. */
  async function readViaServer(files: File[]) {
    setStatus(
      files.length > 1
        ? `جارٍ قراءة ${files.length} صفحات…`
        : 'جارٍ قراءة الملف…'
    );
    const payload = await Promise.all(
      files.map(async (f) => ({ data: await toDataUrl(f), mimeType: f.type }))
    );
    const idToken = await getIdToken();
    const res = await fetch('/api/import-index', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: payload, idToken }),
    });
    const data = (await res.json()) as { text?: string; error?: string };
    if (!res.ok) throw new Error(data.error || 'تعذّر تحليل الملفات.');
    return data.text ?? '';
  }

  /** المعالج الموحّد: صور متعدّدة أو ملف PDF. */
  async function onFiles(fileList: FileList) {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setError('');
    setBusy(true);
    try {
      const pdf = files.find((f) => f.type === 'application/pdf');
      let text = '';

      if (pdf) {
        // 1) جرّب استخراج النص محليًا (بلا خادم وبلا تكلفة)
        setStatus('جارٍ استخراج النص من الـ PDF…');
        const { extractPdfText } = await import('@/lib/pdf-text');
        const out = await extractPdfText(pdf, {
          onProgress: (n, t) => setStatus(`قراءة صفحة ${n} من ${t}…`),
        });
        if (!out.looksScanned && out.text.trim().length > 40) {
          text = out.text;
        } else {
          // 2) ملف ممسوح ضوئيًا — اقرأه بصريًا عبر الخادم
          setStatus('الملف ممسوح ضوئيًا — جارٍ القراءة البصرية…');
          text = await readViaServer([pdf]);
        }
      } else {
        text = await readViaServer(files);
      }

      setRaw(text);
      analyse(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر تحليل الملفات.');
    } finally {
      setBusy(false);
      setStatus('');
    }
  }

  const totals = countSelected(units);

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
      <div className="card-premium my-8 w-full max-w-3xl rounded-3xl p-6 sm:p-8">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-bold text-[color:var(--maroon)]">
              استيراد الوحدات والدروس من الفهرس
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              أضِف منهجًا كاملًا دفعة واحدة، ثم راجِعه قبل الإضافة.
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[color:var(--surface-2)] text-muted-foreground hover:text-[color:var(--maroon)]"
            aria-label="إغلاق"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* وجهة الاستيراد */}
        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-black text-[color:var(--maroon)]">
              المادة
            </label>
            <select
              className={input}
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                const s = subjects.find((x) => x.id === e.target.value);
                setGradeId(s?.grades[0]?.id ?? '');
              }}
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-black text-[color:var(--maroon)]">
              المستوى
            </label>
            <select className={input} value={gradeId} onChange={(e) => setGradeId(e.target.value)}>
              {subject?.grades.map((g) => (
                <option key={g.id} value={g.id}>{g.title}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <p className="mb-4 flex items-start gap-2 rounded-xl bg-[color:var(--coral)]/15 px-4 py-3 text-sm font-bold text-[color:var(--coral)]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        {/* ---------- اختيار الطريقة ---------- */}
        {mode === 'choose' && (
          <>
            {busy && (
              <div className="mb-4 flex items-center justify-center gap-3 rounded-2xl bg-[color:var(--surface-2)] p-5 text-sm font-bold text-[color:var(--maroon)]">
                <Loader2 className="h-5 w-5 animate-spin" />
                {status || 'جارٍ المعالجة…'}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <label
                className={cn(
                  'flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-[color:var(--gold)]/50 bg-[color:var(--surface-2)]/60 p-6 text-center transition hover:border-[color:var(--maroon)]',
                  busy && 'pointer-events-none opacity-50'
                )}
              >
                <ImagePlus className="h-8 w-8 text-[color:var(--maroon)]" />
                <span className="font-bold text-[color:var(--maroon)]">صور الفهرس</span>
                <span className="text-xs text-muted-foreground">
                  يمكن اختيار عدة صفحات معًا
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => e.target.files && onFiles(e.target.files)}
                />
              </label>

              <label
                className={cn(
                  'flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-[color:var(--gold)]/50 bg-[color:var(--surface-2)]/60 p-6 text-center transition hover:border-[color:var(--maroon)]',
                  busy && 'pointer-events-none opacity-50'
                )}
              >
                <FileText className="h-8 w-8 text-[color:var(--maroon)]" />
                <span className="font-bold text-[color:var(--maroon)]">ملف PDF</span>
                <span className="text-xs text-muted-foreground">
                  يُقرأ داخل متصفّحك بلا إعداد
                </span>
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => e.target.files && onFiles(e.target.files)}
                />
              </label>

              <button
                onClick={() => setMode('text')}
                disabled={busy}
                className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-[color:var(--gold)]/50 bg-[color:var(--surface-2)]/60 p-6 text-center transition hover:border-[color:var(--maroon)] disabled:opacity-50"
              >
                <ClipboardPaste className="h-8 w-8 text-[color:var(--maroon)]" />
                <span className="font-bold text-[color:var(--maroon)]">لصق النص</span>
                <span className="text-xs text-muted-foreground">
                  الأدقّ دائمًا وبلا تكلفة
                </span>
              </button>
            </div>
          </>
        )}

        {/* ---------- لصق النص ---------- */}
        {mode === 'text' && (
          <div>
            <textarea
              className={input + ' min-h-[220px] font-medium leading-7'}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={'الصق أسطر الفهرس هنا، مثال:\nالوحدة 1: المواد وخصائصها\n1.1 كيف أصنّف المواد؟\n1.2 ما خصائص المواد؟'}
            />
            <div className="mt-4 flex flex-wrap gap-3">
              <button onClick={() => analyse(raw)} className="btn-primary btn-sm px-6 text-sm">
                <Wand2 className="h-4 w-4" /> تحليل الفهرس
              </button>
              <button onClick={() => setMode('choose')} className="btn-ghost btn-sm px-5 text-sm">
                رجوع
              </button>
            </div>
          </div>
        )}

        {/* ---------- مراجعة قبل الإضافة ---------- */}
        {mode === 'review' && (
          <div>
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-[color:var(--teal)]/10 px-4 py-3 text-sm font-bold text-[color:var(--teal)]">
              <ListChecks className="h-5 w-5" />
              تعرّفنا على {units.length} وحدة — راجِع وعدّل قبل الإضافة
            </div>

            <div className="max-h-[45vh] space-y-3 overflow-y-auto pr-1">
              {units.map((u, ui) => (
                <div key={ui} className="rounded-2xl border border-[color:var(--hairline)] p-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={u.include}
                      onChange={(e) =>
                        setUnits((prev) => {
                          const n = structuredClone(prev);
                          n[ui].include = e.target.checked;
                          return n;
                        })
                      }
                      className="h-5 w-5 shrink-0 accent-[color:var(--maroon)]"
                    />
                    <input
                      className={input + ' text-base'}
                      value={u.title}
                      onChange={(e) =>
                        setUnits((prev) => {
                          const n = structuredClone(prev);
                          n[ui].title = e.target.value;
                          return n;
                        })
                      }
                    />
                  </div>
                  <div className="mt-2 space-y-1.5 border-r-2 border-[color:var(--hairline)] pr-3">
                    {u.lessons.map((l, li) => (
                      <div key={li} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={l.include}
                          onChange={(e) =>
                            setUnits((prev) => {
                              const n = structuredClone(prev);
                              n[ui].lessons[li].include = e.target.checked;
                              return n;
                            })
                          }
                          className="h-4 w-4 shrink-0 accent-[color:var(--maroon)]"
                        />
                        <input
                          className={cn(input, 'text-xs')}
                          value={l.title}
                          onChange={(e) =>
                            setUnits((prev) => {
                              const n = structuredClone(prev);
                              n[ui].lessons[li].title = e.target.value;
                              return n;
                            })
                          }
                        />
                      </div>
                    ))}
                    {u.lessons.length === 0 && (
                      <p className="text-xs text-muted-foreground">لا دروس في هذه الوحدة</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[color:var(--hairline)] pt-4">
              <button
                onClick={() => {
                  onImport(units, subjectId, gradeId);
                  onClose();
                }}
                disabled={totals.units === 0}
                className="btn-primary btn-sm px-6 text-sm disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                إضافة {totals.units} وحدة و{totals.lessons} درس
              </button>
              <button onClick={() => setMode('choose')} className="btn-ghost btn-sm px-5 text-sm">
                البدء من جديد
              </button>
              <span className="text-xs text-muted-foreground">
                ستُضاف إلى المحرّر — ولن تُحفظ حتى تضغط «حفظ البنية».
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
