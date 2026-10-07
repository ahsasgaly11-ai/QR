'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  BookMarked,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import type { Unit } from '@/lib/types';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// تعديل وحدة دراسية قائمة (العنوان والوصف والدروس وترتيبها) وتأكيد حذفها.
// معرّفات الدروس القائمة تبقى كما هي حتى لا تنفصل عنها أنشطتها المرفوعة.
// ---------------------------------------------------------------------------

function uid(prefix: string) {
  return prefix + '-' + Math.random().toString(36).slice(2, 8);
}

/** نافذة فوق الصفحة — عبر بوابة إلى body لأن حركات الانتقال تضع transform
 *  على حاوية المحتوى فيصير fixed نسبيًّا لها. */
function Modal({
  label,
  onClose,
  children,
  className,
}: {
  label: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={cn('card-premium my-8 w-full rounded-3xl p-6 sm:p-8', className)}>
        {children}
      </div>
    </div>,
    document.body
  );
}

export function UnitEditor({
  unit,
  context,
  activityCount,
  onSave,
  onDelete,
  onClose,
}: {
  unit: Unit;
  /** المادة ← المستوى، للعرض فقط */
  context: string;
  /** عدد الأنشطة المرتبطة بكل درس (حسب معرّفه) */
  activityCount: (lessonId: string) => number;
  onSave: (unit: Unit) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(unit.title);
  const [summary, setSummary] = useState(unit.summary ?? '');
  const [lessons, setLessons] = useState(() =>
    unit.lessons.map((l) => ({ id: l.id, title: l.title }))
  );
  /** الدرس المنتظر تأكيد حذفه (له أنشطة مرتبطة) */
  const [arming, setArming] = useState<string | null>(null);

  const input =
    'w-full rounded-xl border border-[color:var(--hairline-strong)] bg-[color:var(--surface)] px-4 py-2.5 text-sm font-bold outline-none focus:border-[color:var(--maroon)]';
  const iconBtn =
    'grid h-8 w-8 shrink-0 place-items-center rounded-lg transition hover:scale-105 disabled:opacity-30 disabled:hover:scale-100';

  const edit = (fn: (l: { id: string; title: string }[]) => void) =>
    setLessons((prev) => {
      const next = [...prev];
      fn(next);
      return next;
    });

  function removeLesson(i: number) {
    const l = lessons[i];
    if (activityCount(l.id) > 0 && arming !== l.id) {
      setArming(l.id);
      return;
    }
    setArming(null);
    edit((ls) => ls.splice(i, 1));
  }

  function save() {
    onSave({
      ...unit,
      title: title.trim(),
      summary: summary.trim(),
      lessons: lessons
        .filter((l) => l.title.trim())
        .map((l) => ({
          id: l.id,
          title: l.title.trim(),
          activities: unit.lessons.find((x) => x.id === l.id)?.activities ?? [],
        })),
    });
    onClose();
  }

  const removed = unit.lessons.filter((l) => !lessons.some((x) => x.id === l.id));
  const hiddenActivities = removed.reduce((n, l) => n + activityCount(l.id), 0);

  return (
    <Modal label="تعديل الوحدة" onClose={onClose} className="max-w-2xl">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-bold text-[color:var(--maroon)]">
            تعديل الوحدة
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{context}</p>
        </div>
        <button
          onClick={onClose}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[color:var(--surface-2)] text-muted-foreground hover:text-[color:var(--maroon)]"
          aria-label="إغلاق"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <label className="mb-1.5 block text-sm font-black text-[color:var(--maroon)]">
        عنوان الوحدة
      </label>
      <div className="flex items-center gap-2">
        <BookMarked className="h-5 w-5 shrink-0 text-[color:var(--gold)]" />
        <input className={input + ' text-base'} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <label className="mb-1.5 mt-4 block text-sm font-black text-[color:var(--maroon)]">
        وصف مختصر <span className="font-bold text-muted-foreground">(اختياري)</span>
      </label>
      <textarea
        className={input + ' min-h-[64px] font-medium'}
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="يظهر تحت عنوان الوحدة في صفحة المادة"
      />

      <span className="mb-1.5 mt-4 block text-sm font-black text-[color:var(--maroon)]">
        الدروس ({lessons.filter((l) => l.title.trim()).length})
      </span>
      <div className="max-h-[45vh] space-y-1.5 overflow-y-auto border-r-2 border-[color:var(--hairline)] pr-3">
        {lessons.map((l, i) => {
          const count = activityCount(l.id);
          return (
            <div key={l.id}>
              <div className="flex items-center gap-1.5">
                <span className="w-5 shrink-0 text-center text-xs font-black text-muted-foreground">
                  {i + 1}
                </span>
                <input
                  className={cn(input, 'py-2 text-xs')}
                  value={l.title}
                  placeholder="عنوان الدرس"
                  onChange={(e) => edit((ls) => (ls[i] = { ...ls[i], title: e.target.value }))}
                />
                {count > 0 && (
                  <span
                    className="shrink-0 rounded-full bg-[color:var(--teal)]/15 px-2 py-0.5 text-[11px] font-black text-[color:var(--teal)]"
                    title="أنشطة مرفوعة في هذا الدرس"
                  >
                    {count} نشاط
                  </span>
                )}
                <button
                  className={iconBtn + ' bg-[color:var(--surface-2)] text-muted-foreground'}
                  disabled={i === 0}
                  onClick={() => edit((ls) => ls.splice(i - 1, 0, ls.splice(i, 1)[0]))}
                  aria-label="تحريك لأعلى"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  className={iconBtn + ' bg-[color:var(--surface-2)] text-muted-foreground'}
                  disabled={i === lessons.length - 1}
                  onClick={() => edit((ls) => ls.splice(i + 1, 0, ls.splice(i, 1)[0]))}
                  aria-label="تحريك لأسفل"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  className={cn(
                    iconBtn,
                    arming === l.id
                      ? 'w-auto bg-[color:var(--coral)] px-2 text-[11px] font-black text-white'
                      : 'bg-[color:var(--coral)]/15 text-[color:var(--coral)]'
                  )}
                  onClick={() => removeLesson(i)}
                  aria-label="حذف الدرس"
                >
                  {arming === l.id ? 'تأكيد' : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </div>
              {arming === l.id && (
                <p className="mr-7 mt-1 text-[11px] font-bold text-[color:var(--coral)]">
                  في هذا الدرس {count} نشاط — لن تظهر للزوّار بعد حذفه. اضغط «تأكيد» للحذف.
                </p>
              )}
            </div>
          );
        })}
        {lessons.length === 0 && (
          <p className="text-xs text-muted-foreground">لا دروس في هذه الوحدة بعد.</p>
        )}
      </div>
      <button
        className="mt-2 flex items-center gap-1 text-xs font-bold text-[color:var(--maroon)] hover:underline"
        onClick={() => edit((ls) => ls.push({ id: uid('l'), title: '' }))}
      >
        <Plus className="h-3.5 w-3.5" /> إضافة درس
      </button>

      {hiddenActivities > 0 && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-[color:var(--gold)]/15 px-4 py-2.5 text-xs font-bold text-[color:var(--maroon)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          حذفت دروسًا فيها {hiddenActivities} نشاط — ستُخفى عن الزوّار وتبقى في «إدارة الأنشطة»
          لنقلها إلى درس آخر.
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[color:var(--hairline)] pt-4">
        <button
          onClick={save}
          disabled={!title.trim()}
          className="btn-primary btn-sm px-6 text-sm disabled:opacity-50"
        >
          <CheckCircle2 className="h-4 w-4" /> حفظ التعديلات
        </button>
        <button onClick={onClose} className="btn-ghost btn-sm px-5 text-sm">
          إلغاء
        </button>
        <button
          onClick={onDelete}
          className="mr-auto flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold text-[color:var(--coral)] transition hover:bg-[color:var(--coral)]/10"
        >
          <Trash2 className="h-4 w-4" /> حذف الوحدة
        </button>
      </div>
    </Modal>
  );
}

export function ConfirmDeleteUnit({
  unit,
  activities,
  onConfirm,
  onClose,
}: {
  unit: Unit;
  /** عدد الأنشطة والمراجعات المرتبطة بالوحدة */
  activities: number;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal label="حذف الوحدة" onClose={onClose} className="max-w-md">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[color:var(--coral)]/15 text-[color:var(--coral)]">
          <Trash2 className="h-5 w-5" />
        </span>
        <h3 className="font-display text-lg font-bold text-[color:var(--maroon)]">
          حذف الوحدة؟
        </h3>
      </div>
      <p className="text-sm leading-7">
        ستُحذف <span className="font-black">«{unit.title}»</span> مع دروسها (
        {unit.lessons.length} درس).
      </p>
      {activities > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-[color:var(--gold)]/15 px-4 py-2.5 text-xs font-bold leading-6 text-[color:var(--maroon)]">
          <AlertTriangle className="mt-1 h-4 w-4 shrink-0" />
          ترتبط بها {activities} نشاط/مراجعة — لن تُحذف ملفاتها، لكنها ستُخفى عن الزوّار
          وتبقى في «إدارة الأنشطة» لنقلها إلى وحدة أخرى.
        </p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        لا يُطبَّق الحذف على الموقع حتى تضغط «حفظ البنية».
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className="btn-sm flex items-center gap-1.5 rounded-xl bg-[color:var(--coral)] px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-110"
        >
          <Trash2 className="h-4 w-4" /> نعم، احذف الوحدة
        </button>
        <button onClick={onClose} className="btn-ghost btn-sm px-5 text-sm">
          إلغاء
        </button>
      </div>
    </Modal>
  );
}
