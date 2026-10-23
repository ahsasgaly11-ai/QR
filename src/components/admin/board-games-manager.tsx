'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown, ArrowUp, Check, ExternalLink, Eye, EyeOff, FolderInput, FolderSearch, Hand, Link2Off, Loader2, Lock,
  MousePointerClick, Pencil, Plus, RotateCcw, Trash2, X,
} from 'lucide-react';
import type { BoardGame, Subject } from '@/lib/types';
import { BOARD_GAME_META, BOARD_GAMES_PATH, boardGameLinked } from '@/lib/types';
import {
  BOARD_GAME_SLUG_RE,
  SEED_BOARD_GAME_SLUGS,
  boardGameHref,
  boardGameTryHref,
  checkBoardGameFiles,
  deleteBoardGameDoc,
  fetchBoardGameDocs,
  isReservedBoardGameSlug,
  locateBoardGame,
  mergeBoardGames,
  saveBoardGame,
  saveBoardGamesOrder,
  type BoardGameDoc,
} from '@/lib/board-games';
import { revalidateContent } from '@/lib/revalidate';
import { isFirebaseConfigured } from '@/lib/firebase';
import { DOOR_SWATCHES } from '@/lib/site-texts';
import { cn } from '@/lib/utils';
import { useAdminIdentity } from './auth-gate';
import { iconBtn, inp } from './studio-draft';

// ---------------------------------------------------------------------------
// تبويب «ألعاب السبورة» في لوحة الإدارة.
//
// ملفات اللعبة (المجلد public/<slug>/) تُنشر مع الموقع؛ أمّا كل ما يراه الزائر
// عنها — العنوان والوصف والنواتج والدرس والغلاف واللون والترتيب والإخفاء —
// فيُحفظ هنا في Firestore (boardGames/{slug}) ويظهر فورًا بلا نشر جديد.
// الألعاب المضمّنة في الكود تُعدَّل وتُخفى وتُستعاد، ولا تُحذف؛ والمضافة من
// هنا يحذفها المالك.
// ---------------------------------------------------------------------------

const NEW = '__new__';
const NONE = '';

/** نسخة التحرير: المصفوفات نصوصًا متعدّدة الأسطر، والأرقام نصوصًا. */
interface Draft {
  slug: string;
  title: string;
  summary: string;
  subject: string;
  context: string;
  objectives: string;
  modes: string;
  players: string;
  minutes: string;
  cover: string;
  color: string;
  added: string;
  hidden: boolean;
  subjectId: string;
  gradeId: string;
  unitId: string;
  lessonId: string;
}

function toDraft(g?: BoardGame): Draft {
  return {
    slug: g?.slug ?? '',
    title: g?.title ?? '',
    summary: g?.summary ?? '',
    subject: g?.subject ?? '',
    context: g?.context ?? '',
    objectives: (g?.objectives ?? []).join('\n'),
    modes: (g?.modes ?? []).join('\n'),
    players: g?.players ?? '',
    minutes: g ? String(g.minutes || '') : '',
    cover: g?.cover ?? '',
    color: g?.color ?? BOARD_GAME_META.color,
    added: g?.added ?? new Date().toISOString().slice(0, 10),
    hidden: Boolean(g?.hidden),
    subjectId: g?.subjectId ?? NONE,
    gradeId: g?.gradeId ?? NONE,
    unitId: g?.unitId ?? NONE,
    lessonId: g?.lessonId ?? NONE,
  };
}

const splitLines = (v: string) => v.split(/\r?\n|،\s*(?=\S)/).map((x) => x.trim()).filter(Boolean);

/** رسالة خطأ مفهومة للمشرف بدل فشل صامت. */
function errorText(err: unknown, fallback: string): string {
  const code = (err as { code?: string } | null)?.code;
  if (code === 'permission-denied')
    return 'لا تملك صلاحية التعديل — تأكّد من تسجيل الدخول بحساب المالك أو رافع الأنشطة، وأن قواعد Firestore المحدّثة منشورة.';
  if (code === 'unavailable') return 'تعذّر الاتصال بقاعدة البيانات، تحقّق من الإنترنت وحاول مجددًا.';
  return err instanceof Error && err.message ? err.message : fallback;
}

export function BoardGamesManager({ initial, structure }: { initial: BoardGame[]; structure: Subject[] }) {
  const { role } = useAdminIdentity();
  const isOwner = role === 'owner';
  const [games, setGames] = useState<BoardGame[]>(initial);
  /** وثائق Firestore الحالية: لمعرفة أي لعبة مضمّنة عليها تعديلات محفوظة */
  const [docs, setDocs] = useState<Record<string, BoardGameDoc>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(toDraft());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);
  const [filesCheck, setFilesCheck] = useState<{ state: 'idle' | 'checking' | 'ok' | 'missing'; missing: string[] }>({ state: 'idle', missing: [] });

  // القائمة من الخادم قد تكون أقدم بلحظات من حفظٍ تمّ للتوّ — حدّثها من المصدر الحيّ
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let alive = true;
    fetchBoardGameDocs().then((d) => {
      if (!alive) return;
      setDocs(d);
      setGames(mergeBoardGames(d));
    });
    return () => {
      alive = false;
    };
  }, []);

  async function refresh() {
    const d = await fetchBoardGameDocs();
    setDocs(d);
    setGames(mergeBoardGames(d));
  }

  const draftSubject = structure.find((s) => s.id === draft.subjectId);
  const draftGrade = draftSubject?.grades.find((g) => g.id === draft.gradeId);
  const draftUnit = draftGrade?.units.find((u) => u.id === draft.unitId);
  const linked = Boolean(draft.subjectId && draft.gradeId && draft.unitId && draft.lessonId);
  const isNew = editing === NEW;
  const slugOk = BOARD_GAME_SLUG_RE.test(draft.slug) && !isReservedBoardGameSlug(draft.slug);
  const slugTaken = isNew && games.some((g) => g.slug === draft.slug);

  const stats = useMemo(() => {
    const visible = games.filter((g) => !g.hidden);
    return { total: games.length, visible: visible.length, linked: games.filter(boardGameLinked).length };
  }, [games]);

  function locationOf(g: BoardGame): string {
    if (!boardGameLinked(g)) return g.subject ? `${g.subject} — غير مرتبطة بدرس` : 'غير مرتبطة بدرس';
    const { subject, grade, unit, lesson } = locateBoardGame(structure, g);
    if (!lesson) return 'الدرس المرتبط لم يُعثر عليه في شجرة المنهج — أعِد ربطها';
    return [subject?.title, grade?.title, unit?.title, lesson.title].filter(Boolean).join(' ← ');
  }

  function startEdit(g?: BoardGame) {
    setError('');
    setNotice('');
    setConfirming(null);
    setFilesCheck({ state: 'idle', missing: [] });
    setDraft(toDraft(g));
    setEditing(g ? g.slug : NEW);
  }

  function pickSubject(id: string) {
    const s = structure.find((x) => x.id === id);
    const g = s?.grades[0];
    const u = g?.units[0];
    setDraft((d) => ({
      ...d,
      subjectId: id,
      gradeId: g?.id ?? NONE,
      unitId: u?.id ?? NONE,
      lessonId: u?.lessons[0]?.id ?? NONE,
      subject: s?.title ?? d.subject,
    }));
  }

  async function checkFiles() {
    if (!slugOk) return;
    setFilesCheck({ state: 'checking', missing: [] });
    const missing = await checkBoardGameFiles(draft.slug, draft.cover.trim() || undefined);
    setFilesCheck({ state: missing.length ? 'missing' : 'ok', missing });
  }

  async function save() {
    const title = draft.title.trim();
    if (!title) return setError('اكتب عنوان اللعبة.');
    if (isNew) {
      if (!slugOk) return setError('اسم المجلد غير صالح: أحرف لاتينية صغيرة وأرقام وشرطات فقط (مثال: cold-week).');
      if (slugTaken) return setError('توجد لعبة بهذا المجلد أصلًا — عدّلها من القائمة.');
      if (filesCheck.state !== 'ok') {
        setFilesCheck({ state: 'checking', missing: [] });
        const missing = await checkBoardGameFiles(draft.slug, draft.cover.trim() || undefined);
        setFilesCheck({ state: missing.length ? 'missing' : 'ok', missing });
        if (missing.length) return setError(`لم يُعثر على: ${missing.join('، ')}. انشر مجلد اللعبة في public/ أولًا.`);
      }
    }
    const minutes = Math.max(0, Math.round(Number(draft.minutes) || 0));
    const patch: BoardGameDoc = {
      title,
      summary: draft.summary.trim(),
      subject: (linked ? draftSubject?.title : draft.subject.trim()) || draft.subject.trim(),
      objectives: splitLines(draft.objectives),
      modes: splitLines(draft.modes),
      players: draft.players.trim(),
      minutes,
      cover: draft.cover.trim() || `/${draft.slug}/cover.jpg`,
      color: draft.color.trim() || BOARD_GAME_META.color,
      added: draft.added || new Date().toISOString().slice(0, 10),
      hidden: draft.hidden,
      ...(draft.context.trim() ? { context: draft.context.trim() } : {}),
      ...(linked ? { subjectId: draft.subjectId, gradeId: draft.gradeId, unitId: draft.unitId, lessonId: draft.lessonId } : {}),
    };
    const remove: (keyof BoardGameDoc)[] = [];
    if (!draft.context.trim()) remove.push('context');
    if (!linked) remove.push('subjectId', 'gradeId', 'unitId', 'lessonId');
    setBusy(true);
    setError('');
    try {
      const previous = games.find((g) => g.slug === draft.slug);
      await saveBoardGame(draft.slug, patch, remove);
      await refresh();
      // الصفحات المخزّنة: القسم والرئيسية وتصفّح وصفحة المادة (القديمة والجديدة إن نُقلت)
      void revalidateContent({ subjectId: linked ? draft.subjectId : undefined });
      if (previous?.subjectId && previous.subjectId !== draft.subjectId) void revalidateContent({ subjectId: previous.subjectId });
      setNotice(isNew ? `أُضيفت «${title}» إلى القسم.` : `حُفظت تعديلات «${title}».`);
      setEditing(null);
    } catch (e) {
      setError(errorText(e, 'تعذّر الحفظ.'));
    } finally {
      setBusy(false);
    }
  }

  async function quick(g: BoardGame, patch: BoardGameDoc, doneMsg: string) {
    setBusy(true);
    setError('');
    try {
      await saveBoardGame(g.slug, patch);
      await refresh();
      void revalidateContent({ subjectId: g.subjectId });
      setNotice(doneMsg);
    } catch (e) {
      setError(errorText(e, 'تعذّر الحفظ.'));
    } finally {
      setBusy(false);
    }
  }

  async function move(g: BoardGame, dir: -1 | 1) {
    const i = games.findIndex((x) => x.slug === g.slug);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= games.length) return;
    const next = [...games];
    [next[i], next[j]] = [next[j], next[i]];
    setBusy(true);
    setError('');
    try {
      await saveBoardGamesOrder(next.map((x) => x.slug));
      await refresh();
      void revalidateContent({});
    } catch (e) {
      setError(errorText(e, 'تعذّر حفظ الترتيب.'));
    } finally {
      setBusy(false);
    }
  }

  /** للعبة مضمّنة: استعادة الافتراضي. للعبة مضافة: إزالتها من الموقع. */
  async function removeDoc(g: BoardGame) {
    setBusy(true);
    setError('');
    try {
      await deleteBoardGameDoc(g.slug);
      await refresh();
      void revalidateContent({ subjectId: g.subjectId });
      setNotice(SEED_BOARD_GAME_SLUGS.has(g.slug) ? `استُعيدت البيانات الأصلية لـ«${g.title}».` : `أُزيلت «${g.title}» من القسم. ملفاتها في public/ لم تُمسّ.`);
      setConfirming(null);
    } catch (e) {
      setError(errorText(e, 'تعذّر الحذف.'));
    } finally {
      setBusy(false);
    }
  }

  const labelCls = 'mb-1 block text-xs font-semibold text-[color:var(--maroon)]';

  const form = (
    <div className="panel rounded-2xl p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg font-semibold text-foreground">
          {isNew ? 'إضافة لعبة سبورة' : `تعديل «${games.find((g) => g.slug === editing)?.title ?? ''}»`}
        </h3>
        {!isNew && (
          <span className="text-xs text-muted-foreground" dir="ltr">
            /{draft.slug}/
          </span>
        )}
      </div>

      {isNew && (
        <div className="rounded-xl border border-[color:var(--hairline)] p-3">
          <label htmlFor="bg-slug" className={labelCls}>
            <FolderSearch className="inline h-4 w-4" /> اسم مجلد اللعبة في public/
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="bg-slug"
              className={inp + ' flex-1'}
              dir="ltr"
              value={draft.slug}
              onChange={(e) => {
                setDraft((d) => ({ ...d, slug: e.target.value.trim().toLowerCase() }));
                setFilesCheck({ state: 'idle', missing: [] });
              }}
              placeholder="cold-week"
              autoFocus
            />
            <button type="button" onClick={() => void checkFiles()} disabled={!slugOk || filesCheck.state === 'checking'} className="btn-ghost btn-sm px-3 py-2 text-xs">
              {filesCheck.state === 'checking' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderSearch className="h-4 w-4" />}
              تحقّق من الملفات
            </button>
          </div>
          <p className="mt-1.5 text-[11px] font-medium leading-5 text-muted-foreground">
            المجلد يُنشر مع الموقع (index.html وcover.jpg على الأقل) حسب دليل المحرّك في board-kit/README_AR.md. بعد نشره، تكفي هذه
            الاستمارة لظهور اللعبة — بلا تعديل في الكود.
          </p>
          {slugTaken && <p className="mt-1 text-xs font-bold text-[color:var(--coral)]">توجد لعبة بهذا المجلد أصلًا.</p>}
          {filesCheck.state === 'ok' && (
            <p className="mt-1 flex items-center gap-1 text-xs font-bold text-[color:var(--teal)]">
              <Check className="h-4 w-4" /> الملف الرئيسي والغلاف موجودان.
            </p>
          )}
          {filesCheck.state === 'missing' && (
            <p className="mt-1 text-xs font-bold text-[color:var(--coral)]" dir="auto">
              لم يُعثر على: <span dir="ltr">{filesCheck.missing.join(' ، ')}</span>
            </p>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className={labelCls}>عنوان اللعبة</span>
          <input className={inp} value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="مثال: أسبوع الزكام" />
        </label>
        <label className="block sm:col-span-2">
          <span className={labelCls}>الوصف (سطران في البطاقة)</span>
          <textarea className={inp + ' min-h-[4.5rem] resize-y leading-relaxed'} value={draft.summary} onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))} />
        </label>
        <label className="block">
          <span className={labelCls}>ملاحظة قصيرة تحت العنوان (اختياري)</span>
          <input className={inp} value={draft.context} onChange={(e) => setDraft((d) => ({ ...d, context: e.target.value }))} placeholder="مثال: النشاط 1" />
        </label>
        <label className="block">
          <span className={labelCls}>اللاعبون</span>
          <input className={inp} value={draft.players} onChange={(e) => setDraft((d) => ({ ...d, players: e.target.value }))} placeholder="الصف كله أو فريقان" />
        </label>
        <label className="block">
          <span className={labelCls}>نواتج التعلّم (كل ناتج في سطر)</span>
          <textarea className={inp + ' min-h-[6rem] resize-y leading-relaxed'} value={draft.objectives} onChange={(e) => setDraft((d) => ({ ...d, objectives: e.target.value }))} placeholder={'يميّز…\nيذكر…\nيستنتج…'} />
        </label>
        <label className="block">
          <span className={labelCls}>أوضاع اللعب (كل وضع في سطر)</span>
          <textarea className={inp + ' min-h-[6rem] resize-y leading-relaxed'} value={draft.modes} onChange={(e) => setDraft((d) => ({ ...d, modes: e.target.value }))} placeholder={'طالب واحد\nسباق فريقين'} />
        </label>
        <label className="block">
          <span className={labelCls}>مدة الجولة (دقائق)</span>
          <input className={inp} type="number" min={0} max={90} inputMode="numeric" value={draft.minutes} onChange={(e) => setDraft((d) => ({ ...d, minutes: e.target.value }))} />
        </label>
        <label className="block">
          <span className={labelCls}>تاريخ الإضافة</span>
          <input className={inp} type="date" dir="ltr" value={draft.added} onChange={(e) => setDraft((d) => ({ ...d, added: e.target.value }))} />
        </label>
        <div className="block">
          <label htmlFor="bg-cover" className={labelCls}>صورة الغلاف (مسار داخل الموقع)</label>
          <input id="bg-cover" className={inp} dir="ltr" value={draft.cover} onChange={(e) => { setDraft((d) => ({ ...d, cover: e.target.value })); setFilesCheck({ state: 'idle', missing: [] }); }} placeholder={draft.slug ? `/${draft.slug}/cover.jpg` : '/<slug>/cover.jpg'} />
          {(draft.cover || draft.slug) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={draft.cover || `/${draft.slug}/cover.jpg`} alt="" className="mt-2 aspect-[16/10] w-40 rounded-lg border border-[color:var(--hairline)] object-cover" />
          )}
        </div>
        <div className="block">
          <span className={labelCls}>لون البطاقة</span>
          <div className="flex flex-wrap items-center gap-2">
            {[BOARD_GAME_META.color, ...DOOR_SWATCHES].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, color: c }))}
                className={cn('h-7 w-7 rounded-full border-2 transition hover:scale-110', draft.color === c ? 'border-[color:var(--ink)]' : 'border-transparent')}
                style={{ background: c }}
                aria-label={`اللون ${c}`}
                aria-pressed={draft.color === c}
              />
            ))}
            <input type="color" value={/^#[0-9a-f]{6}$/i.test(draft.color) ? draft.color : BOARD_GAME_META.color} onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value }))} aria-label="لون مخصّص" className="h-7 w-9 cursor-pointer rounded border border-[color:var(--hairline)] bg-transparent" />
          </div>
        </div>
      </div>

      {/* ربط الدرس — كالعروض التقديمية: درس واحد لكل لعبة */}
      <div className="rounded-xl border border-[color:var(--hairline)] p-3">
        <p className={labelCls + ' mb-2 flex items-center gap-1.5'}>
          <FolderInput className="h-4 w-4" /> الدرس المرتبط
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <select className={inp} value={draft.subjectId} onChange={(e) => pickSubject(e.target.value)} aria-label="المادة">
            <option value={NONE}>— بلا ربط بدرس —</option>
            {structure.filter((s) => s.grades.length > 0).map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
          {draftSubject && (
            <>
              <select
                className={inp}
                value={draft.gradeId}
                aria-label="المستوى"
                onChange={(e) => {
                  const g = draftSubject.grades.find((x) => x.id === e.target.value);
                  const u = g?.units[0];
                  setDraft((d) => ({ ...d, gradeId: e.target.value, unitId: u?.id ?? NONE, lessonId: u?.lessons[0]?.id ?? NONE }));
                }}
              >
                {draftSubject.grades.map((g) => (
                  <option key={g.id} value={g.id}>{g.title}</option>
                ))}
              </select>
              <select
                className={inp}
                value={draft.unitId}
                aria-label="الوحدة"
                onChange={(e) => {
                  const u = draftGrade?.units.find((x) => x.id === e.target.value);
                  setDraft((d) => ({ ...d, unitId: e.target.value, lessonId: u?.lessons[0]?.id ?? NONE }));
                }}
              >
                {draftGrade?.units.map((u) => (
                  <option key={u.id} value={u.id}>{u.title}</option>
                ))}
              </select>
              <select className={inp} value={draft.lessonId} aria-label="الدرس" onChange={(e) => setDraft((d) => ({ ...d, lessonId: e.target.value }))}>
                {draftUnit?.lessons.map((l) => (
                  <option key={l.id} value={l.id}>{l.title}</option>
                ))}
              </select>
            </>
          )}
        </div>
        {!linked && (
          <label className="mt-3 block">
            <span className={labelCls}>اسم المادة على الغلاف (حين لا تُربط بدرس)</span>
            <input className={inp} value={draft.subject} onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))} placeholder="العلوم" />
          </label>
        )}
        <p className="mt-2 text-[11px] font-medium leading-5 text-muted-foreground">
          اللعبة المرتبطة تظهر شريطًا «لعبة السبورة» داخل درسها في صفحة المادة، ويُقرأ موقعها (المادة • المستوى • الدرس) من شجرة
          المنهج فوق بطاقتها. يجوز ربط أكثر من لعبة بالدرس نفسه، ولا تُحسب ضمن أنشطته.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={draft.hidden} onChange={(e) => setDraft((d) => ({ ...d, hidden: e.target.checked }))} className="h-4 w-4 accent-[color:var(--maroon)]" />
        مخفيّة عن الزوّار (تبقى هنا للمراجعة)
      </label>

      {error && <p className="text-sm font-bold text-[color:var(--coral)]" role="alert">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void save()} disabled={busy} className="btn-primary btn-sm px-4 py-2 text-sm">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {isNew ? 'إضافة اللعبة' : 'حفظ'}
        </button>
        <button type="button" onClick={() => setEditing(null)} disabled={busy} className="btn-ghost btn-sm px-4 py-2 text-sm">
          <X className="h-4 w-4" /> إلغاء
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground">إدارة ألعاب السبورة الذكية</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            عدّل بيانات أي لعبة، واربطها بدرسها، ورتّبها، أو أخفِها. {stats.visible} من {stats.total} ظاهرة للزوّار، و{stats.linked} مرتبطة بدروس.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={BOARD_GAMES_PATH} target="_blank" rel="noreferrer" className="btn-ghost btn-sm px-3 py-2 text-xs">
            <ExternalLink className="h-4 w-4" /> معاينة القسم
          </a>
          <button type="button" onClick={() => startEdit()} disabled={busy || editing === NEW} className="btn-primary btn-sm px-3 py-2 text-xs">
            <Plus className="h-4 w-4" /> إضافة لعبة
          </button>
        </div>
      </div>

      {!isFirebaseConfigured && (
        <p className="rounded-xl bg-[color:var(--gold)]/12 p-3 text-sm text-[color:var(--maroon)]">
          وضع العرض بلا Firebase: القائمة المضمّنة للقراءة فقط، ولا يُحفظ أي تعديل.
        </p>
      )}
      {notice && (
        <p className="flex items-center justify-between gap-3 rounded-xl bg-[color:var(--teal)]/10 p-3 text-sm font-semibold text-[color:var(--teal)]">
          <span><Check className="inline h-4 w-4" /> {notice}</span>
          <button type="button" onClick={() => setNotice('')} className="text-xs text-muted-foreground" aria-label="إغلاق">✕</button>
        </p>
      )}
      {error && !editing && <p className="text-sm font-bold text-[color:var(--coral)]" role="alert">{error}</p>}

      {editing === NEW && form}

      <ul className="space-y-3">
        {games.map((g, i) => {
          const seed = SEED_BOARD_GAME_SLUGS.has(g.slug);
          const overridden = seed && g.slug in docs;
          const isEditing = editing === g.slug;
          const linkedOk = boardGameLinked(g) && Boolean(locateBoardGame(structure, g).lesson);
          return (
            <li key={g.slug} className={cn('panel rounded-2xl p-4', g.hidden && 'opacity-80')}>
              {isEditing ? (
                form
              ) : (
                <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.cover} alt="" width={96} height={60} className="h-[60px] w-24 shrink-0 rounded-lg border border-[color:var(--hairline)] object-cover" style={{ background: g.color }} loading="lazy" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="pill" style={{ color: g.color, background: `color-mix(in srgb, ${g.color} 12%, transparent)` }}>
                        <Hand className="h-3 w-3" /> لعبة سبورة
                      </span>
                      <h4 className="truncate font-display text-base font-semibold text-foreground">{g.title}</h4>
                      <span className="text-xs text-muted-foreground" dir="ltr">/{g.slug}/</span>
                      {seed ? (
                        <span className="pill bg-[color:var(--surface-2)] text-muted-foreground" title="مضمّنة في الكود: تُعدَّل وتُخفى وتُستعاد، ولا تُحذف">
                          <Lock className="h-3 w-3" /> مضمّنة{overridden ? ' • معدَّلة' : ''}
                        </span>
                      ) : (
                        <span className="pill bg-[color:var(--gold)]/15 text-[color:var(--maroon)]">مضافة من الإدارة</span>
                      )}
                      {g.hidden && (
                        <span className="pill bg-[color:var(--coral)]/12 text-[color:var(--coral)]">
                          <EyeOff className="h-3 w-3" /> مخفيّة
                        </span>
                      )}
                      {!linkedOk && (
                        <span className="pill bg-[color:var(--coral)]/12 text-[color:var(--coral)]" title="اربطها بدرسها لتظهر داخل صفحة المادة">
                          <Link2Off className="h-3 w-3" /> بلا درس
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{locationOf(g)}</p>
                    <p className="mt-1 flex flex-wrap gap-3 text-xs">
                      <a href={boardGameHref(g)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-[color:var(--maroon)] underline-offset-4 hover:underline">
                        <ExternalLink className="h-3.5 w-3.5" /> افتح اللعبة
                      </a>
                      <a href={boardGameTryHref(g)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-muted-foreground underline-offset-4 hover:underline">
                        <MousePointerClick className="h-3.5 w-3.5" /> جرّبها بالماوس
                      </a>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    <button type="button" onClick={() => void move(g, -1)} disabled={busy || i === 0} className={iconBtn + ' bg-[color:var(--surface-2)]'} title="تقديم في الترتيب" aria-label="تقديم في الترتيب">
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => void move(g, 1)} disabled={busy || i === games.length - 1} className={iconBtn + ' bg-[color:var(--surface-2)]'} title="تأخير في الترتيب" aria-label="تأخير في الترتيب">
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void quick(g, { hidden: !g.hidden }, g.hidden ? `أُظهرت «${g.title}» للزوّار.` : `أُخفيت «${g.title}» عن الزوّار.`)}
                      disabled={busy}
                      aria-pressed={!!g.hidden}
                      className={iconBtn + (g.hidden ? ' bg-[color:var(--coral)]/15 text-[color:var(--coral)]' : ' bg-[color:var(--surface-2)] text-[color:var(--teal)]')}
                      title={g.hidden ? 'إظهار للزوّار' : 'إخفاء عن الزوّار'}
                      aria-label={g.hidden ? 'إظهار للزوّار' : 'إخفاء عن الزوّار'}
                    >
                      {g.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <button type="button" onClick={() => startEdit(g)} disabled={busy} className={iconBtn + ' bg-[color:var(--surface-2)] text-[color:var(--maroon)]'} title="تعديل" aria-label="تعديل">
                      <Pencil className="h-4 w-4" />
                    </button>
                    {isOwner && (seed ? overridden : true) && (
                      confirming === g.slug ? (
                        <>
                          <button type="button" onClick={() => void removeDoc(g)} disabled={busy} className="flex h-8 items-center gap-1 rounded-lg bg-[color:var(--coral)] px-3 text-xs font-bold text-white transition hover:scale-105 disabled:opacity-60">
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : seed ? <RotateCcw className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                            {seed ? 'تأكيد الاستعادة' : 'تأكيد الإزالة'}
                          </button>
                          <button type="button" onClick={() => setConfirming(null)} disabled={busy} className={iconBtn + ' bg-[color:var(--surface-2)]'} title="إلغاء" aria-label="إلغاء">
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setError(''); setConfirming(g.slug); }}
                          disabled={busy}
                          className={iconBtn + ' bg-[color:var(--coral)]/15 text-[color:var(--coral)]'}
                          title={seed ? 'استعادة البيانات الأصلية المضمّنة' : 'إزالة اللعبة من القسم (ملفاتها لا تُمسّ)'}
                          aria-label={seed ? 'استعادة البيانات الأصلية' : 'إزالة اللعبة'}
                        >
                          {seed ? <RotateCcw className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {games.length === 0 && (
        <p className="explorer-empty text-sm text-muted-foreground">لا توجد ألعاب بعد — أضف أول لعبة بعد نشر مجلدها في public/.</p>
      )}
    </div>
  );
}
