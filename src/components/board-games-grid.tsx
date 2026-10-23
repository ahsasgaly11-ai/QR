'use client';

import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { BoardGame } from '@/lib/types';
import { BoardGameCard } from '@/components/board-games';
import { Reveal } from '@/components/reveal';
import { SchoolGate } from '@/components/school-gate';
import { HeritageIcon } from '@/components/heritage-icons';
import { isFirebaseConfigured, isOwnerUid, watchAdmin } from '@/lib/auth';
import { cn } from '@/lib/utils';

export type BoardGameRow = {
  game: BoardGame;
  subjectId: string;
  subjectTitle: string;
  /** المستوى والدرس كما يظهران فوق البطاقة */
  context: string;
};

const ALL = '__all__';

/**
 * شبكة ألعاب السبورة في صفحة القسم: تبويب لكل مادة فيها ألعاب، وللمالك
 * المسجَّل دخوله تعديل مباشر على البطاقات وإظهار المخفيّ منها — على نسق
 * شبكة العروض التقديمية.
 */
export function BoardGamesGrid({ initialRows }: { initialRows: BoardGameRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [isOwner, setIsOwner] = useState(false);
  const [subjectId, setSubjectId] = useState(ALL);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let alive = true;
    const unsub = watchAdmin((user) => {
      if (!user) {
        if (alive) setIsOwner(false);
        return;
      }
      isOwnerUid(user.uid).then((ok) => {
        if (alive) setIsOwner(ok);
      });
    });
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  function handleChanged(slug: string, patch: Partial<BoardGame>) {
    setRows((current) => current.map((r) => (r.game.slug === slug ? { ...r, game: { ...r.game, ...patch } } : r)));
  }

  // الزائر لا يرى المخفيّ؛ المالك يراه معلَّمًا ليستطيع إظهاره من هنا
  const visible = useMemo(() => (isOwner ? rows : rows.filter((r) => !r.game.hidden)), [rows, isOwner]);

  // تبويب لكل مادة فيها ألعاب فقط، بترتيب ظهورها
  const subjects = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of visible) if (!seen.has(r.subjectId)) seen.set(r.subjectId, r.subjectTitle || 'أخرى');
    return [...seen.entries()];
  }, [visible]);
  const shown = subjectId === ALL ? visible : visible.filter((r) => r.subjectId === subjectId);

  return (
    <>
      {isOwner && (
        <div className="owner-note mb-6">
          <ShieldCheck className="h-5 w-5" />
          وضع المشرف مفعّل — عدّل عنوان اللعبة ووصفها ونواتجها مباشرة، أو أخفِها عن الزوّار. ربط الدرس وإضافة لعبة جديدة من
          لوحة الإدارة ← «ألعاب السبورة».
        </div>
      )}

      {subjects.length > 1 && (
        <div className="mb-7 flex flex-wrap gap-2" role="tablist" aria-label="المواد">
          {[[ALL, 'الكل'] as const, ...subjects].map(([id, title]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={subjectId === id}
              onClick={() => setSubjectId(id)}
              className={cn('level-tab', subjectId === id && 'is-on')}
            >
              {title}
            </button>
          ))}
        </div>
      )}

      <SchoolGate>
        {shown.length > 0 ? (
          <div className="bg-grid">
            {shown.map((r, i) => (
              <Reveal key={r.game.slug} delay={i * 70} className="min-w-0">
                <BoardGameCard
                  game={r.game}
                  context={[r.subjectTitle, r.context].filter(Boolean).join(' • ')}
                  isOwner={isOwner}
                  onChanged={handleChanged}
                />
              </Reveal>
            ))}
          </div>
        ) : (
          <Reveal>
            <div className="explorer-empty">
              <HeritageIcon kind="screen" className="mx-auto h-20 w-20" />
              <h3 className="mt-3 font-calli text-2xl text-foreground">لا توجد ألعاب سبورة مضافة بعد</h3>
              <p className="mx-auto mt-1 max-w-xl text-sm leading-7 text-muted-foreground">
                ستظهر الألعاب هنا تلقائيًا عند إضافتها من لوحة الإدارة ← «ألعاب السبورة».
              </p>
            </div>
          </Reveal>
        )}
      </SchoolGate>
    </>
  );
}
