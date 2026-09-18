'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  UploadCloud,
  CheckCircle2,
  Copy,
  Info,
  Loader2,
  FileCode2,
  Plus,
  Play,
  BookOpen,
  HardDrive,
} from 'lucide-react';
import type { ActivityType, Subject, Activity } from '@/lib/types';
import { ACTIVITY_META } from '@/lib/types';
import { isFirebaseConfigured, getDb, getBucket } from '@/lib/firebase';
import { saveStructure, toStructure } from '@/lib/content';
import {
  saveLocalActivity,
  saveLocalStructure,
  getLocalStructure,
} from '@/lib/local-store';

const TYPES = Object.keys(ACTIVITY_META) as ActivityType[];
const NEW = '__new__';

function slug(s: string) {
  return (
    s
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'item'
  );
}
const rid = () => Math.random().toString(36).slice(2, 7);

interface Result {
  mode: 'firebase' | 'demo';
  activity: Activity;
  newUnit?: string;
  newLesson?: string;
  fileName: string;
}

export function AdminUploader({ subjects }: { subjects: Subject[] }) {
  const available = subjects.filter((s) => s.grades.length > 0);
  const [subjectId, setSubjectId] = useState(available[0]?.id ?? '');
  const subject = subjects.find((s) => s.id === subjectId);
  const [gradeId, setGradeId] = useState(subject?.grades[0]?.id ?? '');
  const grade = subject?.grades.find((g) => g.id === gradeId);
  const [unitId, setUnitId] = useState(grade?.units[0]?.id ?? NEW);
  const unit = grade?.units.find((u) => u.id === unitId);
  const [lessonId, setLessonId] = useState(unit?.lessons[0]?.id ?? NEW);

  const [newUnitName, setNewUnitName] = useState('');
  const [newLessonName, setNewLessonName] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ActivityType>('experiment');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const unitIsNew = unitId === NEW;
  const lessonIsNew = lessonId === NEW || unitIsNew;

  function pickSubject(id: string) {
    setSubjectId(id);
    const s = subjects.find((x) => x.id === id);
    const g = s?.grades[0];
    setGradeId(g?.id ?? '');
    const u = g?.units[0];
    setUnitId(u?.id ?? NEW);
    setLessonId(u?.lessons[0]?.id ?? NEW);
  }
  function pickGrade(id: string) {
    setGradeId(id);
    const g = subject?.grades.find((x) => x.id === id);
    const u = g?.units[0];
    setUnitId(u?.id ?? NEW);
    setLessonId(u?.lessons[0]?.id ?? NEW);
  }
  function pickUnit(id: string) {
    setUnitId(id);
    if (id === NEW) {
      setLessonId(NEW);
    } else {
      const u = grade?.units.find((x) => x.id === id);
      setLessonId(u?.lessons[0]?.id ?? NEW);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!file) return setError('الرجاء اختيار ملف HTML للنشاط.');
    if (!title.trim()) return setError('الرجاء إدخال عنوان النشاط.');
    if (!subjectId || !gradeId) return setError('الرجاء اختيار المادة والمستوى.');
    if (unitIsNew && !newUnitName.trim())
      return setError('الرجاء إدخال اسم الوحدة الجديدة.');
    if (lessonIsNew && !newLessonName.trim())
      return setError('الرجاء إدخال اسم الدرس الجديد.');
    if (!unitIsNew && !unitId) return setError('الرجاء اختيار الوحدة.');
    if (!lessonIsNew && !lessonId) return setError('الرجاء اختيار الدرس.');

    // معرّفات لاتينية آمنة في الروابط (العناوين العربية تُكسر ترميز الـ URL)
    const stamp = Date.now().toString(36);
    const finalUnitId = unitIsNew ? `u-${stamp}-${rid()}` : unitId;
    const finalLessonId = lessonIsNew ? `l-${stamp}-${rid()}` : lessonId;
    const id = `act-${stamp}-${rid()}`;

    const baseActivity: Activity = {
      id,
      title: title.trim(),
      description: description.trim(),
      type,
      file: file.name,
      subjectId,
      gradeId,
      unitId: finalUnitId,
      lessonId: finalLessonId,
      createdAt: Date.now(),
    };

    // ---- وضع العرض: يُحفظ داخل المتصفّح ليصبح قابلًا للتشغيل فورًا ----
    if (!isFirebaseConfigured) {
      setBusy(true);
      try {
        const html = await file.text();

        // احفظ أي وحدة/درس جديد في البنية المحلية ليجد النشاط مكانه
        if (unitIsNew || lessonIsNew) {
          const tree = getLocalStructure() ?? toStructure(subjects);
          const s = tree.find((x) => x.id === subjectId);
          const g = s?.grades.find((x) => x.id === gradeId);
          if (g) {
            let targetUnit = g.units.find((u) => u.id === finalUnitId);
            if (unitIsNew) {
              targetUnit = {
                id: finalUnitId,
                title: newUnitName.trim(),
                summary: '',
                color: subject?.color ?? '#8a173e',
                lessons: [],
              };
              g.units.push(targetUnit);
            }
            if (!targetUnit) targetUnit = g.units.find((u) => u.id === unitId);
            if (lessonIsNew && targetUnit) {
              targetUnit.lessons.push({
                id: finalLessonId,
                title: newLessonName.trim(),
                activities: [],
              });
            }
            saveLocalStructure(tree);
          }
        }

        const localActivity: Activity = { ...baseActivity, local: true };
        const ok = await saveLocalActivity(localActivity, html);
        if (!ok) throw new Error('تعذّر حفظ النشاط في متصفّحك.');

        setResult({
          mode: 'demo',
          activity: localActivity,
          newUnit: unitIsNew ? newUnitName.trim() : undefined,
          newLesson: lessonIsNew ? newLessonName.trim() : undefined,
          fileName: file.name,
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'تعذّر حفظ النشاط محليًا.'
        );
      } finally {
        setBusy(false);
      }
      return;
    }

    // ---- Firebase mode ----
    setBusy(true);
    try {
      const db = getDb();
      const bucket = getBucket();
      if (!db || !bucket) throw new Error('تعذّر الاتصال بخدمة التخزين.');

      // 1) persist any new unit/lesson into the curriculum structure
      if (unitIsNew || lessonIsNew) {
        const tree = toStructure(subjects);
        const s = tree.find((x) => x.id === subjectId);
        const g = s?.grades.find((x) => x.id === gradeId);
        if (!g) throw new Error('تعذّر إيجاد المستوى المحدّد.');
        let targetUnit = g.units.find((u) => u.id === finalUnitId);
        if (unitIsNew) {
          targetUnit = {
            id: finalUnitId,
            title: newUnitName.trim(),
            summary: '',
            color: subject?.color ?? '#8a1538',
            lessons: [],
          };
          g.units.push(targetUnit);
        }
        if (!targetUnit) targetUnit = g.units.find((u) => u.id === unitId);
        if (lessonIsNew && targetUnit) {
          targetUnit.lessons.push({
            id: finalLessonId,
            title: newLessonName.trim(),
            activities: [],
          });
        }
        await saveStructure(tree);
      }

      // 2) upload the file
      const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
      const { doc, setDoc } = await import('firebase/firestore');
      const path = `activities/${subjectId}/${id}-${file.name}`;
      const storageRef = ref(bucket, path);
      await uploadBytes(storageRef, file, { contentType: 'text/html' });
      const downloadUrl = await getDownloadURL(storageRef);

      // 3) write activity metadata
      await setDoc(doc(db, 'activities', id), {
        ...baseActivity,
        file: downloadUrl,
        external: true,
      });

      setResult({ mode: 'firebase', activity: baseActivity, fileName: file.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء رفع النشاط.');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setResult(null);
    setTitle('');
    setDescription('');
    setFile(null);
    setNewUnitName('');
    setNewLessonName('');
  }

  function copySnippet() {
    if (!result) return;
    navigator.clipboard
      ?.writeText(JSON.stringify(result.activity, null, 2))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
  }

  const inputCls =
    'w-full rounded-xl border border-[color:var(--hairline-strong)] bg-[color:var(--surface)] px-4 py-2.5 text-sm font-bold text-foreground outline-none transition focus:border-[color:var(--maroon)] focus:ring-2 focus:ring-[color:var(--maroon)]/20';
  const labelCls = 'mb-1.5 block text-sm font-black text-[color:var(--maroon)]';

  // ---- success / result screen ----
  if (result) {
    return (
      <div className="card-premium rounded-3xl p-8">
        <div className="mb-4 flex items-center gap-3 text-[color:var(--teal)]">
          <CheckCircle2 className="h-9 w-9" />
          <h3 className="font-display text-2xl font-bold">
            {result.mode === 'firebase'
              ? 'تم رفع النشاط بنجاح!'
              : 'تم رفع النشاط — جاهز للتجربة الآن'}
          </h3>
        </div>

        {result.mode === 'firebase' ? (
          <p className="text-muted-foreground">
            أصبح النشاط «{result.activity.title}» متاحًا الآن في المنصّة ضمن
            الدرس المحدّد. يمكن للزوّار تجربته وتحميله، وتُحتسب مشاهداته
            وتنزيلاته تلقائيًا.
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-muted-foreground">
              حُفظ النشاط «{result.activity.title}» وأصبح ظاهرًا في درسه داخل
              المنصّة — يمكنك تشغيله وتحميله فورًا.
            </p>
            {(result.newUnit || result.newLesson) && (
              <p className="text-sm text-muted-foreground">
                وأُضيفت
                {result.newUnit ? ` الوحدة «${result.newUnit}»` : ''}
                {result.newUnit && result.newLesson ? ' و' : ''}
                {result.newLesson ? `الدرس «${result.newLesson}»` : ''} إلى بنية
                المناهج.
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              <Link href={`/play/${result.activity.id}`} className="btn-primary px-6 text-base">
                <Play className="h-5 w-5 fill-current" /> جرّب اللعبة الآن
              </Link>
              <Link
                href={`/subject/${result.activity.subjectId}`}
                className="btn-ghost px-6 text-base"
              >
                <BookOpen className="h-5 w-5" /> عرضها في الدرس
              </Link>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-[color:var(--gold)]/35 bg-[color:var(--gold)]/10 p-4 text-sm">
              <HardDrive className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--gold)]" />
              <p>
                <b>وضع العرض:</b> النشاط محفوظ في <b>هذا المتصفّح فقط</b> — ممتاز
                للتجربة والمراجعة، لكنه لن يظهر لبقيّة الزوّار ولن تُجمَع
                إحصاءاته إلا بعد تفعيل Firebase. لنقله بشكل دائم، انسخ الملف إلى{' '}
                <code className="rounded bg-[color:var(--surface-2)] px-1.5 py-0.5 font-mono text-xs">
                  public/games/
                </code>{' '}
                وأضِف الكائن أدناه إلى{' '}
                <code className="rounded bg-[color:var(--surface-2)] px-1.5 py-0.5 font-mono text-xs">
                  SEED_ACTIVITIES
                </code>
                .
              </p>
            </div>

            <details className="rounded-2xl border border-[color:var(--hairline)] p-4">
              <summary className="cursor-pointer text-sm font-bold text-[color:var(--maroon)]">
                إظهار بيانات النشاط (JSON)
              </summary>
              <div className="relative mt-3">
                <pre className="max-h-64 overflow-auto rounded-2xl bg-[#211619] p-4 text-left text-xs leading-6 text-[#f5ece4]" dir="ltr">
                  {JSON.stringify(result.activity, null, 2)}
                </pre>
                <button
                  onClick={copySnippet}
                  className="absolute left-3 top-3 flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white backdrop-blur hover:bg-white/20"
                >
                  {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'تم النسخ' : 'نسخ'}
                </button>
              </div>
            </details>
          </div>
        )}
        <button onClick={reset} className="btn-primary btn-sm mt-6 px-6 py-2.5 text-sm">
          <UploadCloud className="h-4 w-4" /> رفع نشاط آخر
        </button>
      </div>
    );
  }

  const hasUnits = (grade?.units.length ?? 0) > 0;
  const hasLessons = (unit?.lessons.length ?? 0) > 0;

  return (
    <form onSubmit={onSubmit} className="card-premium rounded-3xl p-6 sm:p-8">
      {!isFirebaseConfigured && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-[color:var(--sky)]/30 bg-[color:var(--sky)]/10 p-4 text-sm">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--sky)]" />
          <p>
            <b>وضع العرض:</b> Firebase غير مُعدّ، لذا يُحفظ النشاط داخل هذا
            المتصفّح ويصبح قابلًا للتشغيل والتحميل فورًا للتجربة. بعد تفعيل
            Firebase يُرفع للمنصّة ليراه جميع الزوّار وتُجمَع إحصاءاته.
          </p>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelCls}>المادة</label>
          <select className={inputCls} value={subjectId} onChange={(e) => pickSubject(e.target.value)}>
            {available.map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>المستوى</label>
          <select className={inputCls} value={gradeId} onChange={(e) => pickGrade(e.target.value)}>
            {subject?.grades.map((g) => (
              <option key={g.id} value={g.id}>{g.title}</option>
            ))}
          </select>
        </div>

        {/* Unit: existing or new */}
        <div>
          <label className={labelCls}>الوحدة</label>
          {hasUnits && (
            <select className={inputCls} value={unitId} onChange={(e) => pickUnit(e.target.value)}>
              {grade?.units.map((u) => (
                <option key={u.id} value={u.id}>{u.title}</option>
              ))}
              <option value={NEW}>➕ وحدة جديدة…</option>
            </select>
          )}
          {unitIsNew && (
            <div className={hasUnits ? 'mt-2' : ''}>
              <input
                className={inputCls}
                value={newUnitName}
                onChange={(e) => setNewUnitName(e.target.value)}
                placeholder="اسم الوحدة الجديدة (مثال: الوحدة الأولى: النباتات)"
              />
            </div>
          )}
          {!hasUnits && (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Plus className="h-3 w-3" /> لا توجد وحدات بعد — اكتب اسم أول وحدة.
            </p>
          )}
        </div>

        {/* Lesson: existing or new */}
        <div>
          <label className={labelCls}>الدرس</label>
          {!unitIsNew && hasLessons && (
            <select className={inputCls} value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
              {unit?.lessons.map((l) => (
                <option key={l.id} value={l.id}>{l.title}</option>
              ))}
              <option value={NEW}>➕ درس جديد…</option>
            </select>
          )}
          {lessonIsNew && (
            <div className={!unitIsNew && hasLessons ? 'mt-2' : ''}>
              <input
                className={inputCls}
                value={newLessonName}
                onChange={(e) => setNewLessonName(e.target.value)}
                placeholder="اسم الدرس الجديد (مثال: أجزاء النبات)"
              />
            </div>
          )}
        </div>
      </div>

      <div className="mt-5">
        <label className={labelCls}>عنوان النشاط / اللعبة</label>
        <input
          className={inputCls}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="مثال: تجربة دورة الماء في الطبيعة"
        />
      </div>

      <div className="mt-5">
        <label className={labelCls}>وصف مختصر (اختياري)</label>
        <textarea
          className={inputCls}
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="وصف موجز يظهر للطلبة…"
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
                type === t ? 'text-white shadow-md' : 'bg-[color:var(--surface-2)] text-[color:var(--maroon)] hover:brightness-95'
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
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[color:var(--gold)]/50 bg-[color:var(--surface-2)]/60 p-8 text-center transition hover:border-[color:var(--maroon)] hover:bg-[color:var(--gold)]/5">
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
              <span className="text-xs text-muted-foreground">ملف واحد قائم بذاته (.html)</span>
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

      <button type="submit" disabled={busy} className="btn-primary mt-6 w-full justify-center py-3.5 text-base">
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
