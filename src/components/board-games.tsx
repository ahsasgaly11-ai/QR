'use client';

import { useState } from 'react';
import { Check, ChevronLeft, Clock, Eye, EyeOff, Loader2, MousePointerClick, Pencil, Users, X } from 'lucide-react';
import type { BoardGame } from '@/lib/types';
import { boardGameHref, boardGameTryHref } from '@/lib/board-games';

/**
 * بطاقة لعبة سبورة. اللعبة تطبيق ويب ثابت يُفتح في صفحة كاملة (لا داخل إطار
 * معزول: الكاميرا وملء الشاشة لا يعملان فيه)، لذا الروابط <a> عادية.
 *
 * للمالك المسجَّل دخوله تظهر أدوات التعديل المباشر (العنوان والوصف والملاحظة
 * ونواتج التعلّم) وزرّ الإخفاء — كما في بطاقات العروض التقديمية.
 */
export function BoardGameCard({
  game,
  context,
  isOwner = false,
  onChanged,
}: {
  game: BoardGame;
  /** المادة • المستوى • الدرس (من شجرة المنهج) — يظهر فوق البطاقة */
  context?: string;
  isOwner?: boolean;
  onChanged?: (slug: string, patch: Partial<BoardGame>) => void;
}) {
  const href = boardGameHref(game);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [title, setTitle] = useState(game.title);
  const [summary, setSummary] = useState(game.summary);
  const [note, setNote] = useState(game.context ?? '');
  const [objectives, setObjectives] = useState(game.objectives.join('\n'));

  function reset() {
    setTitle(game.title);
    setSummary(game.summary);
    setNote(game.context ?? '');
    setObjectives(game.objectives.join('\n'));
    setError('');
    setEditing(false);
  }

  async function persist(patch: Partial<BoardGame>, remove: (keyof Omit<BoardGame, 'slug'>)[] = []) {
    setBusy(true);
    setError('');
    try {
      const [{ saveBoardGame }, { revalidateContent }] = await Promise.all([
        import('@/lib/board-games'),
        import('@/lib/revalidate'),
      ]);
      await saveBoardGame(game.slug, patch, remove);
      void revalidateContent({ subjectId: game.subjectId });
      onChanged?.(game.slug, patch);
      return true;
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'تعذّر الحفظ. تحقّق من اتصالك ثم أعد المحاولة.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const nextTitle = title.trim();
    if (!nextTitle) return;
    const nextObjectives = objectives.split('\n').map((x) => x.trim()).filter(Boolean);
    const nextNote = note.trim();
    const patch: Partial<BoardGame> = {
      title: nextTitle,
      summary: summary.trim(),
      objectives: nextObjectives,
      ...(nextNote ? { context: nextNote } : {}),
    };
    if (await persist(patch, nextNote ? [] : ['context'])) {
      if (!nextNote) onChanged?.(game.slug, { context: undefined });
      setEditing(false);
    }
  }

  return (
    <article
      className={`bg-card${game.hidden ? ' is-hidden' : ''}`}
      style={{ '--bg-color': game.color } as React.CSSProperties}
      aria-label={game.title}
    >
      {context && <p className="bg-crumb">{context}</p>}
      <a href={href} className="bg-cover" aria-label={`افتح لعبة ${game.title} على السبورة`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={game.cover} alt={`لقطة من لعبة ${game.title}`} width={640} height={400} loading="lazy" />
        {game.subject && <span className="bg-subject">{game.subject}</span>}
        {game.hidden && <span className="bg-hidden-badge">مخفيّة عن الزوّار</span>}
      </a>

      {/* أدوات المالك — لا تظهر للزوّار إطلاقًا */}
      {isOwner && !editing && (
        <div className="bg-owner" aria-label="أدوات المشرف">
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={busy}
            className="act-owner-btn text-[color:var(--maroon)]"
            title="تعديل بيانات اللعبة"
            aria-label="تعديل بيانات اللعبة"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => void persist({ hidden: !game.hidden })}
            disabled={busy}
            className="act-owner-btn text-[color:var(--ink-2)]"
            title={game.hidden ? 'إظهار اللعبة للزوّار' : 'إخفاء اللعبة عن الزوّار'}
            aria-pressed={!!game.hidden}
            aria-label={game.hidden ? 'إظهار اللعبة للزوّار' : 'إخفاء اللعبة عن الزوّار'}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : game.hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
        </div>
      )}

      <div className="bg-body">
        {editing ? (
          <div className="bg-edit">
            <label>
              <span>العنوان</span>
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && reset()}
                placeholder="عنوان اللعبة"
              />
            </label>
            <label>
              <span>ملاحظة قصيرة (اختياري)</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثال: النشاط 1" />
            </label>
            <label>
              <span>الوصف</span>
              <textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="وصف اللعبة في سطرين" />
            </label>
            <label>
              <span>نواتج التعلّم (كل ناتج في سطر)</span>
              <textarea rows={4} value={objectives} onChange={(e) => setObjectives(e.target.value)} placeholder="يميّز… / يذكر… / يستنتج…" />
            </label>
            {error && <p className="bg-edit-error" role="alert">{error}</p>}
            <div className="bg-edit-actions">
              <button type="button" onClick={() => void save()} disabled={busy || !title.trim()} className="bg-edit-save">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} حفظ
              </button>
              <button type="button" onClick={reset} disabled={busy} className="bg-edit-cancel">
                <X className="h-4 w-4" /> إلغاء
              </button>
            </div>
          </div>
        ) : (
          <>
            <h3 className="bg-title">{game.title}</h3>
            {game.context && <p className="bg-context">{game.context}</p>}
            {game.summary && <p className="bg-summary">{game.summary}</p>}
            {game.objectives.length > 0 && (
              <ul className="bg-objectives" aria-label="نواتج التعلّم">
                {game.objectives.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            )}
            {error && <p className="bg-edit-error" role="alert">{error}</p>}
          </>
        )}
        <div className="bg-meta">
          {game.minutes > 0 && (
            <span>
              <Clock className="h-4 w-4" aria-hidden /> {game.minutes.toLocaleString('ar-EG')} دقائق للجولة
            </span>
          )}
          {game.players && (
            <span>
              <Users className="h-4 w-4" aria-hidden /> {game.players}
            </span>
          )}
        </div>
        {game.modes.length > 0 && (
          <div className="bg-modes" aria-label="أوضاع اللعب">
            {game.modes.map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
        )}
        <div className="bg-actions">
          <a href={href} className="bg-go">
            افتح على السبورة
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </a>
          <a href={boardGameTryHref(game)} className="bg-try" title="الماوس يتصرف كيد الطالب: أبقِه على الهدف لحظة">
            <MousePointerClick className="h-4 w-4" aria-hidden /> جرّبها بالماوس
          </a>
        </div>
      </div>
    </article>
  );
}

/** رسم من أعلى للصف: أين يوضع الجهاز (زاوية جانبية) وأين لا يوضع (خلف الطلاب). */
export function ClassroomSetupDiagram() {
  return (
    <svg viewBox="0 0 460 340" role="img" aria-labelledby="bg-diagram-t" className="bg-diagram-svg">
      <title id="bg-diagram-t">
        مخطط الصف من أعلى: السبورة وجهاز العرض فوقها، والطلاب أمامها، والجهاز على حامل في الزاوية الجانبية يرى السبورة ويعكس شاشته
        على جهاز العرض لاسلكيًا.
      </title>
      {/* السبورة وجهاز العرض */}
      <rect x="70" y="22" width="320" height="18" rx="4" className="d-board" />
      <text x="230" y="35" textAnchor="middle" className="d-label-sm">السبورة (الصورة المعروضة)</text>
      <rect x="205" y="6" width="50" height="12" rx="3" className="d-device" />
      <text x="262" y="15" className="d-label-xs">جهاز العرض</text>
      {/* انعكاس الشاشة لاسلكيًا من الجهاز إلى جهاز العرض مباشرة (أو عبر Apple TV أو كابل HDMI) */}
      <text x="456" y="62" textAnchor="end" className="d-label-xs">انعكاس الشاشة</text>
      {/* الطلاب أمام السبورة */}
      {[150, 215, 285].map((x) => (
        <g key={x}>
          <circle cx={x} cy={78} r={15} className="d-kid" />
          <path d={`M${x} 63 v-18`} className="d-arm" />
        </g>
      ))}
      <text x="218" y="114" textAnchor="middle" className="d-label-sm">الطلاب يلمسون السبورة بأيديهم</text>
      {/* الجهاز الصحيح: زاوية جانبية */}
      <path d="M420 120 L392 40 L70 40 Z" className="d-fov" />
      <g transform="rotate(-62 420 128)">
        <rect x="402" y="118" width="36" height="22" rx="4" className="d-ok" />
      </g>
      <text x="420" y="168" textAnchor="middle" className="d-ok-t">✓ هنا</text>
      <text x="456" y="186" textAnchor="end" className="d-label-xs">حامل في الزاوية، ١–١٫٥ م</text>
      <path d="M432 108 Q 440 30 262 13" className="d-wave" />
      {/* الخطأ: طاولة خلف الطلاب */}
      <rect x="170" y="250" width="120" height="44" rx="6" className="d-desk" />
      <rect x="214" y="238" width="32" height="20" rx="4" className="d-bad" />
      <path d="M230 236 L230 100" className="d-blocked" />
      <text x="230" y="316" textAnchor="middle" className="d-bad-t">✗ لا: على طاولة خلف الطلاب</text>
      <text x="230" y="333" textAnchor="middle" className="d-label-xs">أجسامهم تحجب أيديهم، والبُعد يُصغّرها</text>
    </svg>
  );
}
