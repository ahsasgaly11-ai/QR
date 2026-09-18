'use client';

import { useState } from 'react';
import {
  Plus,
  Trash2,
  Save,
  Loader2,
  CheckCircle2,
  Copy,
  BookMarked,
  Layers,
  GraduationCap,
  FolderOpen,
  FileScan,
} from 'lucide-react';
import type { Subject } from '@/lib/types';
import { saveStructure } from '@/lib/content';
import { revalidateContent } from '@/lib/revalidate';
import { isFirebaseConfigured } from '@/lib/firebase';
import { IndexImporter } from './index-importer';
import type { ParsedUnit } from '@/lib/index-parser';

function uid(prefix: string) {
  return prefix + '-' + Math.random().toString(36).slice(2, 8);
}

const EMOJIS = ['🔬', '➗', '📖', '🌍', '🧪', '🧮', '✏️', '🎨', '💻', '⚗️'];

/**
 * ألوان المواد — مشتقّة من هوية وزارة التربية والتعليم أو منسجمة معها،
 * فلا تظهر مادة جديدة بلون غريب عن بقيّة الموقع. كل مادة لونان: أساسي
 * ومكمّل يُبنى منهما تدرّج ترويسة المادة.
 */
const PALETTE: { name: string; color: string; accent: string }[] = [
  { name: 'عنّابي', color: '#8a173e', accent: '#6a0f2e' },
  { name: 'ذهبي', color: '#b0892e', accent: '#8c6a20' },
  { name: 'أخضر', color: '#3f7a4a', accent: '#2c5a36' },
  { name: 'أزرق', color: '#1a5f9c', accent: '#123f6b' },
  { name: 'تركوازي', color: '#14746f', accent: '#0d514e' },
  { name: 'بنفسجي', color: '#6a3d8f', accent: '#4c2a68' },
  { name: 'نحاسي', color: '#b4602a', accent: '#8a441c' },
];

export function ContentManager({ initial }: { initial: Subject[] }) {
  const [tree, setTree] = useState<Subject[]>(() =>
    JSON.parse(JSON.stringify(initial))
  );
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);

  /** يدمج وحدات/دروس مستوردة من الفهرس في الشجرة الحالية (دون حفظ فوري). */
  function applyImport(units: ParsedUnit[], subjectId: string, gradeId: string) {
    update((t) => {
      const s = t.find((x) => x.id === subjectId);
      const g = s?.grades.find((x) => x.id === gradeId);
      if (!g) return;
      for (const u of units) {
        if (!u.include) continue;
        const newUnit = {
          id: uid('u'),
          title: u.title.trim(),
          summary: '',
          color: s?.color ?? '#8a173e',
          lessons: u.lessons
            .filter((l) => l.include && l.title.trim())
            .map((l) => ({ id: uid('l'), title: l.title.trim(), activities: [] })),
        };
        g.units.push(newUnit);
      }
    });
  }

  const update = (fn: (t: Subject[]) => void) => {
    setTree((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as Subject[];
      fn(next);
      return next;
    });
    setSaved(false);
  };

  const inp =
    'flex-1 rounded-lg border border-[color:var(--hairline)] bg-[color:var(--surface)] px-3 py-1.5 text-sm font-bold outline-none focus:border-[color:var(--maroon)]';
  const iconBtn =
    'grid h-8 w-8 shrink-0 place-items-center rounded-lg transition hover:scale-105';

  async function onSave() {
    setError('');
    if (!isFirebaseConfigured) {
      setSaved(true);
      return;
    }
    setBusy(true);
    try {
      await saveStructure(tree);
      // كل مادة تُحدَّث صفحتها، لا الأولى فقط — وإلا لما ظهرت مادة أُضيفت للتوّ
      await Promise.all(
        tree.map((s) => revalidateContent({ subjectId: s.id }))
      );
      setSaved(true);
    } catch {
      setError('تعذّر حفظ البنية. تحقّق من إعداد Firebase وصلاحياتك.');
    } finally {
      setBusy(false);
    }
  }

  function copyJson() {
    navigator.clipboard
      ?.writeText(JSON.stringify(tree, null, 2))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          أضِف أو عدّل أو احذف المواد والمستويات والوحدات والدروس. لإضافة
          الأنشطة إليها استخدم تبويب «رفع نشاط».
        </p>
        <button
          onClick={() => setImporting(true)}
          className="btn-primary btn-sm shrink-0 px-5 text-sm"
        >
          <FileScan className="h-4 w-4" /> استيراد من الفهرس
        </button>
      </div>

      {importing && (
        <IndexImporter
          subjects={tree}
          onImport={applyImport}
          onClose={() => setImporting(false)}
        />
      )}

      {tree.map((s, si) => (
        <div key={s.id} className="card-premium rounded-2xl p-4">
          <div className="flex items-center gap-2">
            <button
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-lg"
              style={{ background: `${s.color}22` }}
              onClick={() =>
                update((t) => {
                  const cur = EMOJIS.indexOf(t[si].emoji);
                  t[si].emoji = EMOJIS[(cur + 1) % EMOJIS.length];
                })
              }
              title="تغيير الرمز"
            >
              {s.emoji}
            </button>
            <input
              className={inp + ' text-base'}
              value={s.title}
              onChange={(e) => update((t) => (t[si].title = e.target.value))}
            />
            <button
              className={iconBtn + ' bg-[color:var(--coral)]/15 text-[color:var(--coral)]'}
              onClick={() => update((t) => t.splice(si, 1))}
              title="حذف المادة"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {/* لون المادة — يظهر في ترويستها وبطاقتها في الرئيسية */}
          <div className="mt-3 flex flex-wrap items-center gap-2 pr-11">
            <span className="text-xs font-bold text-muted-foreground">اللون:</span>
            {PALETTE.map((c) => (
              <button
                key={c.color}
                onClick={() =>
                  update((t) => {
                    t[si].color = c.color;
                    t[si].accent = c.accent;
                  })
                }
                title={c.name}
                aria-label={`لون ${c.name}`}
                className={
                  'h-6 w-6 rounded-full transition hover:scale-110 ' +
                  (s.color.toLowerCase() === c.color
                    ? 'ring-2 ring-[color:var(--foreground)] ring-offset-2 ring-offset-[color:var(--surface)]'
                    : '')
                }
                style={{ background: `linear-gradient(135deg, ${c.color}, ${c.accent})` }}
              />
            ))}
          </div>

          {/* grades */}
          <div className="mt-3 space-y-3 border-r-2 border-[color:var(--hairline)] pr-3">
            {s.grades.map((g, gi) => (
              <div key={g.id} className="rounded-xl bg-[color:var(--surface-2)] p-3">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 shrink-0 text-[color:var(--maroon)]" />
                  <input
                    className={inp}
                    value={g.title}
                    onChange={(e) =>
                      update((t) => (t[si].grades[gi].title = e.target.value))
                    }
                  />
                  <button
                    className={iconBtn + ' bg-[color:var(--coral)]/15 text-[color:var(--coral)]'}
                    onClick={() => update((t) => t[si].grades.splice(gi, 1))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* units */}
                <div className="mt-2 space-y-2 border-r-2 border-[color:var(--hairline)] pr-3">
                  {g.units.map((u, ui) => (
                    <div key={u.id} className="rounded-lg bg-[color:var(--surface)] p-2.5">
                      <div className="flex items-center gap-2">
                        <BookMarked className="h-4 w-4 shrink-0 text-[color:var(--gold)]" />
                        <input
                          className={inp}
                          value={u.title}
                          onChange={(e) =>
                            update(
                              (t) =>
                                (t[si].grades[gi].units[ui].title =
                                  e.target.value)
                            )
                          }
                        />
                        <button
                          className={iconBtn + ' bg-[color:var(--coral)]/15 text-[color:var(--coral)]'}
                          onClick={() =>
                            update((t) => t[si].grades[gi].units.splice(ui, 1))
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      {/* lessons */}
                      <div className="mt-2 space-y-1.5 border-r-2 border-[color:var(--hairline)] pr-3">
                        {u.lessons.map((l, li) => (
                          <div key={l.id} className="flex items-center gap-2">
                            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <input
                              className={inp + ' text-xs'}
                              value={l.title}
                              onChange={(e) =>
                                update(
                                  (t) =>
                                    (t[si].grades[gi].units[ui].lessons[
                                      li
                                    ].title = e.target.value)
                                )
                              }
                            />
                            <button
                              className={iconBtn + ' bg-[color:var(--coral)]/15 text-[color:var(--coral)]'}
                              onClick={() =>
                                update((t) =>
                                  t[si].grades[gi].units[ui].lessons.splice(li, 1)
                                )
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                        <button
                          className="flex items-center gap-1 text-xs font-bold text-[color:var(--maroon)] hover:underline"
                          onClick={() =>
                            update((t) =>
                              t[si].grades[gi].units[ui].lessons.push({
                                id: uid('l'),
                                title: 'درس جديد',
                                activities: [],
                              })
                            )
                          }
                        >
                          <Plus className="h-3.5 w-3.5" /> إضافة درس
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    className="flex items-center gap-1 text-xs font-bold text-[color:var(--maroon)] hover:underline"
                    onClick={() =>
                      update((t) =>
                        t[si].grades[gi].units.push({
                          id: uid('u'),
                          title: 'وحدة جديدة',
                          summary: '',
                          color: s.color,
                          lessons: [],
                        })
                      )
                    }
                  >
                    <Plus className="h-3.5 w-3.5" /> إضافة وحدة
                  </button>
                </div>
              </div>
            ))}
            <button
              className="flex items-center gap-1 text-xs font-bold text-[color:var(--maroon)] hover:underline"
              onClick={() =>
                update((t) =>
                  t[si].grades.push({
                    id: uid('g'),
                    title: 'مستوى جديد',
                    units: [],
                  })
                )
              }
            >
              <Plus className="h-3.5 w-3.5" /> إضافة مستوى
            </button>
          </div>
        </div>
      ))}

      <button
        className="btn-ghost btn-sm px-4 py-2.5 text-sm"
        onClick={() =>
          update((t) =>
            t.push({
              id: uid('subject'),
              title: 'مادة جديدة',
              titleEn: 'New Subject',
              tagline: 'اكتشف • جرّب • تعلّم',
              color: PALETTE[0].color,
              accent: PALETTE[0].accent,
              emoji: '🧪',
              grades: [],
            })
          )
        }
      >
        <Layers className="h-4 w-4" /> إضافة مادة جديدة
      </button>

      {error && (
        <p className="rounded-xl bg-[color:var(--coral)]/15 px-4 py-2.5 text-sm font-bold text-[color:var(--coral)]">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-[color:var(--hairline)] pt-5">
        <button onClick={onSave} disabled={busy} className="btn-primary btn-sm px-6 py-3 text-sm">
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : saved ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <Save className="h-5 w-5" />
          )}
          {saved ? 'تم الحفظ' : 'حفظ البنية'}
        </button>
        <button onClick={copyJson} className="btn-ghost btn-sm px-4 py-3 text-sm">
          {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          نسخ JSON
        </button>
        {!isFirebaseConfigured && (
          <span className="text-xs text-muted-foreground">
            وضع العرض: انسخ الـ JSON إلى <code>SUBJECTS</code> في
            <code> src/data/curriculum.ts</code> لحفظه.
          </span>
        )}
      </div>
    </div>
  );
}
