'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { Activity } from '@/lib/types';
import { ActivityCard } from '@/components/activity-card';
import { Reveal } from '@/components/reveal';
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
    <>
      {isOwner && (
        <div className="mb-6 flex items-center gap-2 rounded-2xl border border-[color:var(--teal)]/30 bg-[color:var(--teal)]/10 px-4 py-3 text-sm font-bold text-[color:var(--teal)]">
          <ShieldCheck className="h-5 w-5" />
          وضع المشرف مفعّل — يمكنك تعديل الألعاب أو حذفها مباشرة من البطاقات.
        </div>
      )}

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
    </>
  );
}
