'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ImagePlus,
  ClipboardPaste,
  Loader2,
  CheckCircle2,
  X,
  AlertTriangle,
  Wand2,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  BookMarked,
} from 'lucide-react';
import { textToDraftUnit, type DraftUnit } from '@/lib/index-parser';
import { getIdToken } from '@/lib/auth';
import { cn, normalizeAr } from '@/lib/utils';

// ---------------------------------------------------------------------------
// إضافة وحدة واحدة إلى مستوى قائم من صورة: صفحة افتتاح الوحدة أو جزء الفهرس
// الخاص بها. تُقرأ الصورة بصريًا على الخادم فتُبنى الوحدة ودروسها، ثم يراجعها
// المشرف ويعدّلها قبل إضافتها إلى المحرّر.
// ---------------------------------------------------------------------------

type Mode = 'choose' | 'text' | 'review';

const MAX_FILES = 8;
/** أطول ضلع للصورة بعد التصغير — يكفي لقراءة الخط ويُبقي الطلب خفيفًا. */
const MAX_SIDE = 2000;

const toDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error('تعذّر قراءة الصورة.'));
    fr.readAsDataURL(file);
  });

/**
 * يصغّر صور الجوال الكبيرة قبل الإرسال. إن تعذّر فكّ الصورة في المتصفّح
 * (مثل HEIC خارج Safari) تُرسل كما هي ويتولّاها الخادم.
 */
async function prepareImage(file: File): Promise<{ data: string; mimeType: string }> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no-canvas');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    return { data: canvas.toDataURL('image/jpeg', 0.88), mimeType: 'image/jpeg' };
  } catch {
    return { data: await toDataUrl(file), mimeType: file.type || 'image/jpeg' };
  }
}

export function UnitFromImage({
  subjectTitle,
  gradeTitle,
  existingUnitTitles,
  onAdd,
  onClose,
}: {
  subjectTitle: string;
  gradeTitle: string;
  /** عناوين وحدات المستوى الحالية — للتنبيه عند التكرار */
  existingUnitTitles: string[];
  onAdd: (unit: DraftUnit) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>('choose');
  const [raw, setRaw] = useState('');
  const [draft, setDraft] = useState<DraftUnit>({ title: '', summary: '', lessons: [] });
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const input =
    'w-full rounded-xl border border-[color:var(--hairline-strong)] bg-[color:var(--surface)] px-4 py-2.5 text-sm font-bold outline-none focus:border-[color:var(--maroon)]';
  const iconBtn =
    'grid h-8 w-8 shrink-0 place-items-center rounded-lg transition hover:scale-105 disabled:opacity-30 disabled:hover:scale-100';

  // أغلِق بمفتاح Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  function startReview(unit: DraftUnit) {
    setDraft({
      title: unit.title,
      summary: unit.summary,
      lessons: unit.lessons.length ? unit.lessons : [''],
    });
    setError('');
    setMode('review');
  }

  function analyseText(text: string) {
    const unit = textToDraftUnit(text);
    if (!unit) {
      setError('لم نتعرّف على عنوان الوحدة أو دروسها. اكتب العنوان في السطر الأول ثم درسًا في كل سطر.');
      return;
    }
    startReview(unit);
  }

  async function onImages(list: File[]) {
    const files = list.filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) {
      setError('اختر صورة (JPG أو PNG أو WEBP أو HEIC).');
      return;
    }
    if (files.length > MAX_FILES) {
      setError(`الحد الأقصى ${MAX_FILES} صور في المرة الواحدة.`);
      return;
    }
    setError('');
    setBusy(true);
    try {
      setStatus('جارٍ تجهيز الصور…');
      const payload = await Promise.all(files.map(prepareImage));
      setPreviews(payload.map((p) => p.data));

      setStatus('جارٍ قراءة الوحدة ودروسها من الصورة…');
      const idToken = await getIdToken();
      const res = await fetch('/api/import-index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: payload, idToken, mode: 'unit' }),
      });
      const data = (await res.json()) as {
        unit?: DraftUnit;
        text?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || 'تعذّر تحليل الصورة.');

      if (data.unit) {
        startReview(data.unit);
      } else if (data.text) {
        setRaw(data.text);
        analyseText(data.text);
      } else {
        throw new Error('لم يُستخرج شيء من الصورة. جرّب صورة أوضح.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر تحليل الصورة.');
    } finally {
      setBusy(false);
      setStatus('');
    }
  }

  // لصق صورة مباشرة من الحافظة (Ctrl+V) في شاشة الاختيار
  useEffect(() => {
    if (mode !== 'choose') return;
    const onPaste = (e: ClipboardEvent) => {
      const imgs = Array.from(e.clipboardData?.files ?? []).filter((f) =>
        f.type.startsWith('image/')
      );
      if (imgs.length && !busy) {
        e.preventDefault();
        onImages(imgs);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, busy]);

  const editLessons = (fn: (l: string[]) => void) =>
    setDraft((d) => {
      const lessons = [...d.lessons];
      fn(lessons);
      return { ...d, lessons };
    });

  const lessons = draft.lessons.map((l) => l.trim()).filter(Boolean);
  const duplicate =
    draft.title.trim() &&
    existingUnitTitles.some((t) => normalizeAr(t.trim()) === normalizeAr(draft.title.trim()));

  // عبر بوابة إلى body: حركات انتقال الصفحة تضع transform على حاوية المحتوى،
  // فيصير fixed نسبيًّا لها وتظهر النافذة بعيدًا عن موضع التمرير.
  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="إضافة وحدة من صورة"
    >
      <div className="card-premium my-8 w-full max-w-3xl rounded-3xl p-6 sm:p-8">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-bold text-[color:var(--maroon)]">
              إضافة وحدة جديدة من صورة
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              إلى <span className="font-bold text-foreground">{subjectTitle}</span> ←{' '}
              <span className="font-bold text-foreground">{gradeTitle}</span> — أرفق صورة
              صفحة افتتاح الوحدة أو جزء الفهرس الخاص بها، فتُبنى الوحدة ودروسها تلقائيًا.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[color:var(--surface-2)] text-muted-foreground hover:text-[color:var(--maroon)]"
            aria-label="إغلاق"
          >
            <X className="h-5 w-5" />
          </button>
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
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!busy) onImages(Array.from(e.dataTransfer.files));
                }}
                className={cn(
                  'flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-[color:var(--gold)]/50 bg-[color:var(--surface-2)]/60 p-6 text-center transition hover:border-[color:var(--maroon)] sm:col-span-2',
                  busy && 'pointer-events-none opacity-50'
                )}
              >
                <ImagePlus className="h-9 w-9 text-[color:var(--maroon)]" />
                <span className="font-bold text-[color:var(--maroon)]">أرفق صورة الوحدة</span>
                <span className="text-xs text-muted-foreground">
                  اسحبها هنا أو اخترها أو صوّرها بالجوال — ويمكن لصقها (Ctrl+V). حتى{' '}
                  {MAX_FILES} صفحات للوحدة الواحدة.
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => {
                    if (e.target.files) onImages(Array.from(e.target.files));
                    e.target.value = '';
                  }}
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
                  بديل يعمل دون مفتاح القراءة البصرية
                </span>
              </button>
            </div>
          </>
        )}

        {/* ---------- لصق النص ---------- */}
        {mode === 'text' && (
          <div>
            <textarea
              className={input + ' min-h-[200px] font-medium leading-7'}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={'السطر الأول عنوان الوحدة، ثم درس في كل سطر، مثال:\nالوحدة 4: الضوء والظلال\n4.1 من أين يأتي الضوء؟\n4.2 كيف تتكوّن الظلال؟'}
            />
            <div className="mt-4 flex flex-wrap gap-3">
              <button onClick={() => analyseText(raw)} className="btn-primary btn-sm px-6 text-sm">
                <Wand2 className="h-4 w-4" /> بناء الوحدة
              </button>
              <button onClick={() => setMode('choose')} className="btn-ghost btn-sm px-5 text-sm">
                رجوع
              </button>
            </div>
          </div>
        )}

        {/* ---------- مراجعة وتعديل قبل الإضافة ---------- */}
        {mode === 'review' && (
          <div className={cn('grid gap-5', previews.length > 0 && 'md:grid-cols-[1fr_200px]')}>
            <div className="min-w-0">
              <label className="mb-1.5 block text-sm font-black text-[color:var(--maroon)]">
                عنوان الوحدة
              </label>
              <div className="flex items-center gap-2">
                <BookMarked className="h-5 w-5 shrink-0 text-[color:var(--gold)]" />
                <input
                  className={input + ' text-base'}
                  value={draft.title}
                  placeholder="مثال: الوحدة 4: الضوء والظلال"
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                />
              </div>
              {duplicate && (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-[color:var(--gold)]">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  توجد وحدة بالعنوان نفسه في هذا المستوى — تأكّد أنها ليست مكرّرة.
                </p>
              )}

              <label className="mb-1.5 mt-4 block text-sm font-black text-[color:var(--maroon)]">
                وصف مختصر <span className="font-bold text-muted-foreground">(اختياري)</span>
              </label>
              <textarea
                className={input + ' min-h-[64px] font-medium'}
                value={draft.summary}
                onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))}
                placeholder="يظهر تحت عنوان الوحدة في صفحة المادة"
              />

              <div className="mb-1.5 mt-4 flex items-center justify-between">
                <span className="text-sm font-black text-[color:var(--maroon)]">
                  الدروس ({lessons.length})
                </span>
              </div>
              <div className="max-h-[40vh] space-y-1.5 overflow-y-auto border-r-2 border-[color:var(--hairline)] pr-3">
                {draft.lessons.map((l, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="w-5 shrink-0 text-center text-xs font-black text-muted-foreground">
                      {i + 1}
                    </span>
                    <input
                      className={cn(input, 'py-2 text-xs')}
                      value={l}
                      placeholder="عنوان الدرس"
                      onChange={(e) => editLessons((ls) => (ls[i] = e.target.value))}
                    />
                    <button
                      className={iconBtn + ' bg-[color:var(--surface-2)] text-muted-foreground'}
                      disabled={i === 0}
                      onClick={() => editLessons((ls) => ls.splice(i - 1, 0, ls.splice(i, 1)[0]))}
                      aria-label="تحريك لأعلى"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      className={iconBtn + ' bg-[color:var(--surface-2)] text-muted-foreground'}
                      disabled={i === draft.lessons.length - 1}
                      onClick={() => editLessons((ls) => ls.splice(i + 1, 0, ls.splice(i, 1)[0]))}
                      aria-label="تحريك لأسفل"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      className={iconBtn + ' bg-[color:var(--coral)]/15 text-[color:var(--coral)]'}
                      onClick={() => editLessons((ls) => ls.splice(i, 1))}
                      aria-label="حذف الدرس"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                className="mt-2 flex items-center gap-1 text-xs font-bold text-[color:var(--maroon)] hover:underline"
                onClick={() => editLessons((ls) => ls.push(''))}
              >
                <Plus className="h-3.5 w-3.5" /> إضافة درس
              </button>
            </div>

            {previews.length > 0 && (
              <div className="order-first space-y-2 md:order-none">
                <span className="block text-xs font-black text-muted-foreground">
                  الصورة الأصلية للمقارنة
                </span>
                <div className="flex gap-2 overflow-x-auto md:max-h-[60vh] md:flex-col md:overflow-y-auto">
                  {previews.map((src, i) => (
                    <a key={i} href={src} target="_blank" rel="noreferrer" className="shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt={`صفحة ${i + 1}`}
                        className="h-40 w-auto rounded-xl border border-[color:var(--hairline)] object-contain md:h-auto md:w-full"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 border-t border-[color:var(--hairline)] pt-4 md:col-span-2">
              <button
                onClick={() => {
                  onAdd({
                    title: draft.title.trim(),
                    summary: draft.summary.trim(),
                    lessons,
                  });
                  onClose();
                }}
                disabled={!draft.title.trim()}
                className="btn-primary btn-sm px-6 text-sm disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                إضافة الوحدة و{lessons.length} درس
              </button>
              <button
                onClick={() => {
                  setPreviews([]);
                  setMode('choose');
                }}
                className="btn-ghost btn-sm px-5 text-sm"
              >
                صورة أخرى
              </button>
              <span className="text-xs text-muted-foreground">
                تُضاف إلى المحرّر — ولن تُحفظ حتى تضغط «حفظ البنية».
              </span>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
