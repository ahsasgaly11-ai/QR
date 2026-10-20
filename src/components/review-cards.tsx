'use client';

import { useEffect, useState } from 'react';
import type { Activity } from '@/lib/types';
import { ActivityCard } from '@/components/activity-card';
import { isFirebaseConfigured, isOwnerUid, watchAdmin } from '@/lib/auth';

/**
 * كل مراجعات الوحدات ببطاقات بمعاينة حيّة كبطاقات أنشطة الدروس، مع أدوات
 * التعديل والحذف للمشرف المسجَّل دخوله.
 */
export function ReviewCards({ initialReviews }: { initialReviews: Activity[] }) {
  const [reviews, setReviews] = useState(initialReviews);
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
    setReviews((current) =>
      patch === null
        ? current.filter((a) => a.id !== id)
        : current.map((a) => (a.id === id ? { ...a, ...patch } : a))
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {reviews.map((a, i) => (
        <ActivityCard key={a.id} activity={a} index={i} isOwner={isOwner} onChanged={handleChanged} />
      ))}
    </div>
  );
}
