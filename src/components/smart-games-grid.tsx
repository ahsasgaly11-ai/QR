'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { Activity } from '@/lib/types';
import { ActivityCard } from '@/components/activity-card';
import { Reveal } from '@/components/reveal';
import { SchoolGate } from '@/components/school-gate';
import { QursFeaturedCard } from '@/components/qurs-featured-card';
import { SectionHead } from '@/components/home/section-head';
import { HeritageIcon } from '@/components/heritage-icons';
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
      <QursFeaturedCard />

      <SectionHead
        kicker="مكتبة الألعاب"
        title="اختر لعبة وابدأ"
        lead={games.length > 0 ? `${games.length} ${games.length === 1 ? 'لعبة' : games.length <= 10 ? 'ألعاب' : 'لعبة'} للتعزيز، تعمل مباشرة في المتصفّح.` : undefined}
      />

      {isOwner && (
        <div className="owner-note mb-6">
          <ShieldCheck className="h-5 w-5" />
          وضع المشرف مفعّل — يمكنك تعديل عنوان اللعبة ووصفها أو حذفها مباشرة.
        </div>
      )}

      {games.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
          <div className="explorer-empty">
            <HeritageIcon kind="oyster" className="mx-auto h-20 w-20" />
            <h3 className="mt-3 font-calli text-2xl text-foreground">لا توجد ألعاب مضافة بعد</h3>
            <p className="mx-auto mt-1 max-w-xl text-sm leading-7 text-muted-foreground">
              ستظهر ألعاب التعزيز هنا تلقائيًا عند إضافتها من لوحة الإدارة.
            </p>
          </div>
        </Reveal>
      )}
    </SchoolGate>
  );
}
