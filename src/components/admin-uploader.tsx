'use client';

import { useMemo, useState } from 'react';
import {
  UploadCloud,
  CheckCircle2,
  Copy,
  Info,
  Loader2,
  FileCode2,
} from 'lucide-react';
import type { ActivityType, Subject } from '@/lib/types';
import { ACTIVITY_META } from '@/lib/types';
import { isFirebaseConfigured, getDb, getBucket, ensureAuth } from '@/lib/firebase';

const TYPES = Object.keys(ACTIVITY_META) as ActivityType[];

function slug(s: string) {
  return (
    s
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'activity'
  );
}

export function AdminUploader({ subjects }: { subjects: Subject[] }) {
  const available = subjects.filter((s) => s.grades.length > 0);
  const [subjectId, setSubjectId] = useState(available[0]?.id ?? '');
  const subject = subjects.find((s) => s.id === subjectId);
  const [gradeId, setGradeId] = useState(subject?.grades[0]?.id ?? '');
  const grade = subject?.grades.find((g) => g.id === gradeId);
  const [unitId, setUnitId] = useState(grade?.units[0]?.id ?? '');
  const unit = grade?.units.find((u) => u.id === unitId);
  const [lessonId, setLessonId] = useState(unit?.lessons[0]?.id ?? '');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ActivityType>('experiment');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | 'firebase' | 'demo'>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // keep dependent selects valid
  function pickSubject(id: string) {
    setSubjectId(id);
    const s = subjects.find((x) => x.id === id);
    const g = s?.grades[0];
    setGradeId(g?.id ?? '');
    const u = g?.units[0];
    setUnitId(u?.id ?? '');
    setLessonId(u?.lessons[0]?.id ?? '');
  }
  function pickGrade(id: string) {
    setGradeId(id);
    const g = subject?.grades.find((x) => x.id === id);
    const u = g?.units[0];
    setUnitId(u?.id ?? '');
    setLessonId(u?.lessons[0]?.id ?? '');
  }
  function pickUnit(id: string) {
    setUnitId(id);
    const u = grade?.units.find((x) => x.id === id);
    setLessonId(u?.lessons[0]?.id ?? '');
  }

  const activityObject = useMemo(
    () => ({
      id: (title ? slug(title) : 'new-activity') + '-' + Date.now().toString(36).slice(-4),
      title: title || 'عنوان النشاط',
      description,
      type,
      file: file?.name ?? 'your-activity.html',
      subjectId,
      gradeId,
      unitId,
      lessonId,
    }),
    [title, description, type, file, subjectId, gradeId, unitId, lessonId]
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!file) return setError('الرجاء اختيار ملف HTML للنشاط.');
    if (!title.trim()) return setError('الرجاء إدخال عنوان النشاط.');
    if (!lessonId) return setError('الرجاء اختيار الدرس.');

    // Demo mode: no Firebase — guide the author.
    if (!isFirebaseConfigured) {
      setDone('demo');
      return;
    }

    setBusy(true);
    try {
      await ensureAuth();
      const db = getDb();
      const bucket = getBucket();
      if (!db || !bucket) throw new Error('تعذّر الاتصال بخدمة التخزين.');
      const { ref, uploadBytes, getDownloadURL } = await import(
        'firebase/storage'
      );
      const { doc, setDoc } = await import('firebase/firestore');

      const id = activityObject.id;
      const path = `activities/${subjectId}/${id}-${file.name}`;
      const storageRef = ref(bucket, path);
      await uploadBytes(storageRef, file, { contentType: 'text/html' });
      const downloadUrl = await getDownloadURL(storageRef);

      await setDoc(doc(db, 'activities', id), {
        title,
        description,
        type,
        file: downloadUrl,
        external: true,
        subjectId,
        gradeId,
        unitId,
        lessonId,
        createdAt: Date.now(),
      });
      setDone('firebase');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'حدث خطأ أثناء رفع النشاط.'
      );
    } finally {
      setBusy(false);
    }
  }

  function copySnippet() {
    navigator.clipboard
      ?.writeText(JSON.stringify(activityObject, null, 2))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
  }

  const inputCls =
    'w-full rounded-xl border border-[color:var(--gold)]/30 bg-white px-4 py-2.5 text-sm font-medium text-foreground outline-none transition focus:border-[color:var(--maroon)] focus:ring-2 focus:ring-[color:var(--maroon)]/20';
  const labelCls = 'mb-1.5 block text-sm font-black text-[color:var(--maroon)]';

  if (done) {
    return (
      <div className="rounded-3xl border border-[color:var(--gold)]/30 bg-[color:var(--surface)] p-8 shadow-lg">
        <div className="mb-4 flex items-center gap-3 text-[color:var(--teal)]">
          <CheckCircle2 className="h-9 w-9" />
          <h3 className="font-display text-2xl font-black">
            {done === 'firebase' ? 'تم رفع النشاط بنجاح!' : 'النشاط جاهز للإضافة'}
          </h3>
        </div>
        {done === 'firebase' ? (
          <p className="text-muted-foreground">
            أصبح النشاط «{title}» متاحًا الآن في المنصّة ضمن الدرس المحدّد. يمكن
            للزوّار تجربته وتحميله، وستُحتسب مشاهداته وتنزيلاته تلقائيًا.
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-muted-foreground">
              المنصّة تعمل حاليًا في «وضع العرض» (بدون إعداد Firebase). لإضافة
              نشاطك بشكل دائم:
            </p>
            <ol className="list-inside list-decimal space-y-2 text-sm text-foreground">
              <li>
                انسخ الملف{' '}
                <code className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-xs">
                  {file?.name}
                </code>{' '}
                إلى المجلد{' '}
                <code className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-xs">
                  public/games/
                </code>
              </li>
              <li>
                أضف الكائن التالي إلى مصفوفة{' '}
                <code className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-xs">
                  SEED_ACTIVITIES
                </code>{' '}
                في{' '}
                <code className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-xs">
                  src/data/curriculum.ts
                </code>
              </li>
            </ol>
            <div className="relative">
              <pre className="max-h-64 overflow-auto rounded-2xl bg-[#241a14] p-4 text-left text-xs leading-6 text-[#f6ecdd]" dir="ltr">
                {JSON.stringify(activityObject, null, 2)}
              </pre>
              <button
                onClick={copySnippet}
                className="absolute left-3 top-3 flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white backdrop-blur hover:bg-white/20"
              >
                {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'تم النسخ' : 'نسخ'}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              أو فعّل Firebase (Firestore + Storage) عبر متغيّرات البيئة ليصبح
              الرفع مباشرًا من هذه الصفحة. راجع ملف README.
            </p>
          </div>
        )}
        <button
          onClick={() => {
            setDone(null);
            setTitle('');
            setDescription('');
            setFile(null);
          }}
          className="mt-6 rounded-xl bg-[color:var(--maroon)] px-6 py-2.5 text-sm font-black text-white hover:bg-[color:var(--maroon-700)]"
        >
          رفع نشاط آخر
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-3xl border border-[color:var(--gold)]/30 bg-[color:var(--surface)] p-6 shadow-lg sm:p-8"
    >
      {!isFirebaseConfigured && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-[color:var(--sky)]/30 bg-[color:var(--sky)]/10 p-4 text-sm text-[color:var(--maroon)]">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--sky)]" />
          <p>
            <b>وضع العرض:</b> Firebase غير مُعدّ حاليًا، لذا سيُنشئ النموذج
            تعليمات وكائن بيانات جاهزًا للإضافة. بعد إعداد Firebase سيتم الرفع
            مباشرة إلى المنصّة.
          </p>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelCls}>المادة</label>
          <select
            className={inputCls}
            value={subjectId}
            onChange={(e) => pickSubject(e.target.value)}
          >
            {available.map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>المستوى</label>
          <select
            className={inputCls}
            value={gradeId}
            onChange={(e) => pickGrade(e.target.value)}
          >
            {subject?.grades.map((g) => (
              <option key={g.id} value={g.id}>{g.title}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>الوحدة</label>
          <select
            className={inputCls}
            value={unitId}
            onChange={(e) => pickUnit(e.target.value)}
          >
            {grade?.units.map((u) => (
              <option key={u.id} value={u.id}>{u.title}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>الدرس</label>
          <select
            className={inputCls}
            value={lessonId}
            onChange={(e) => setLessonId(e.target.value)}
          >
            {unit?.lessons.map((l) => (
              <option key={l.id} value={l.id}>{l.title}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-5">
        <label className={labelCls}>عنوان النشاط</label>
        <input
          className={inputCls}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="مثال: تجربة دورة الماء في الطبيعة"
        />
      </div>

      <div className="mt-5">
        <label className={labelCls}>وصف مختصر</label>
        <textarea
          className={inputCls}
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="اكتب وصفًا موجزًا يظهر للطلبة…"
        />
      </div>

      <div className="mt-5">
        <label className={labelCls}>نوع النشاط</label>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => setType(t)}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                type === t
                  ? 'text-white shadow-md'
                  : 'bg-white text-[color:var(--maroon)] hover:bg-black/5'
              }`}
              style={type === t ? { background: ACTIVITY_META[t].color } : {}}
            >
              {ACTIVITY_META[t].label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <label className={labelCls}>ملف النشاط (HTML)</label>
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[color:var(--gold)]/50 bg-[color:var(--surface)]/70 p-8 text-center transition hover:border-[color:var(--maroon)] hover:bg-[color:var(--gold)]/5">
          {file ? (
            <>
              <FileCode2 className="h-9 w-9 text-[color:var(--teal)]" />
              <span className="font-bold text-foreground">{file.name}</span>
              <span className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(1)} كيلوبايت — اضغط للتغيير
              </span>
            </>
          ) : (
            <>
              <UploadCloud className="h-9 w-9 text-[color:var(--maroon)]" />
              <span className="font-bold text-[color:var(--maroon)]">
                اسحب ملف HTML هنا أو اضغط للاختيار
              </span>
              <span className="text-xs text-muted-foreground">
                ملف واحد قائم بذاته (.html)
              </span>
            </>
          )}
          <input
            type="file"
            accept=".html,text/html"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-[color:var(--coral)]/15 px-4 py-2.5 text-sm font-bold text-[color:var(--coral)]">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[color:var(--maroon)] px-6 py-3.5 text-base font-black text-white shadow-xl shadow-[color:var(--maroon)]/25 transition hover:-translate-y-0.5 hover:bg-[color:var(--maroon-700)] disabled:opacity-60"
      >
        {busy ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" /> جارٍ الرفع…
          </>
        ) : (
          <>
            <UploadCloud className="h-5 w-5" /> رفع النشاط
          </>
        )}
      </button>
    </form>
  );
}
