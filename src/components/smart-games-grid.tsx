'use client';

import { useEffect, useState } from 'react';
import { Gamepad2, ShieldCheck } from 'lucide-react';
import type { Activity } from '@/lib/types';
import { ActivityCard } from '@/components/activity-card';
import { Reveal } from '@/components/reveal';
import { SchoolGate } from '@/components/school-gate';
import {
  isFirebaseConfigured,
  isOwnerUid,
  watchAdmin,
} from '@/lib/auth';

export function SmartGamesGrid({ initialGames }: { initialGames: Activity[] }) {
  const [games, setGames] = useState(initialGames);
  const [isOwner, setIsOwner] = useState(false);

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

  function handleChanged(id: string, patch: Partial<Activity> | null) {
    if (patch === null) {
      setGames((current) => current.filter((game) => game.id !== id));
      return;
    }
    setGames((current) =>
      current.map((game) => (game.id === id ? { ...game, ...patch } : game))
    );
  }

  return (
    <SchoolGate>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-[color:var(--gold)]">
            مكتبة الألعاب
          </p>
          <h2 className="mt-1 font-calli text-3xl font-bold text-[color:var(--maroon)]">
            اختر لعبة وابدأ
          </h2>
        </div>
        <div className="inline-flex items-center gap-2 rounded-2xl border border-[color:var(--gold)]/25 bg-[color:var(--surface)] px-4 py-2 text-sm font-black text-[color:var(--maroon)] shadow-sm">
          <Gamepad2 className="h-4 w-4" />
          {games.length} {games.length === 1 ? 'لعبة' : 'ألعاب'}
        </div>
      </div>

      {isOwner && (
        <div className="mb-6 flex items-center gap-2 rounded-2xl border border-[color:var(--teal)]/30 bg-[color:var(--teal)]/10 px-4 py-3 text-sm font-bold text-[color:var(--teal)]">
          <ShieldCheck className="h-5 w-5" />
          وضع المشرف مفعّل — يمكنك تعديل عنوان اللعبة ووصفها أو حذفها مباشرة.
        </div>
      )}

      {games.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {games.map((game, i) => (
            <Reveal key={game.id} delay={i * 70}>
              <ActivityCard
                activity={game}
                index={i}
                isOwner={isOwner}
                onChanged={handleChanged}
              />
            </Reveal>
          ))}
        </div>
      ) : (
        <Reveal>
          <div className="rounded-3xl border border-dashed border-[color:var(--gold)]/45 bg-[color:var(--surface)] p-10 text-center shadow-sm">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[color:var(--gold)]/12 text-[color:var(--maroon)]">
              <Gamepad2 className="h-8 w-8" />
            </div>
            <h2 className="mt-4 font-display text-2xl font-black text-[color:var(--maroon)]">
              لا توجد ألعاب مضافة بعد
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-muted-foreground">
              ستظهر ألعاب التعزيز هنا تلقائيًا عند إضافتها من لوحة الإدارة.
            </p>
          </div>
        </Reveal>
      )}
    </SchoolGate>
  );
}
