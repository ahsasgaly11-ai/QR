'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2 } from 'lucide-react';
import type { Activity } from '@/lib/types';
import { activityLabel, opensStandalone } from '@/lib/types';
import { ActivityPlayer } from './activity-player';
import { HeritageIcon, activityIcon } from './heritage-icons';
import { useLocalActivity } from './local-play';

/** يعلّم الصفحة بأنها مستقلة فتُخفى عنها واجهة الموقع (انظر globals.css). */
function StandaloneMode() {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-standalone', '1');
    root.setAttribute('data-play', '1');
    return () => {
      root.removeAttribute('data-standalone');
      root.removeAttribute('data-play');
    };
  }, []);
  return null;
}

function Shell({ activity, localHtml }: { activity: Activity; localHtml?: string }) {
  const meta = activityLabel(activity);
  return (
    <div className="mx-auto max-w-[1800px] px-3 py-3 sm:px-5">
      <StandaloneMode />
      <div className="mb-3 flex items-center gap-3">
        <span className="block w-9 shrink-0" aria-hidden>
          <HeritageIcon kind={activityIcon(activity)} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-lg font-bold text-foreground">{activity.title}</h1>
          <p className="text-xs font-semibold" style={{ color: `color-mix(in srgb, ${meta.color} 60%, var(--ink))` }}>
            {activity.unitReview ? 'مراجعة الوحدة' : meta.label}
          </p>
        </div>
        <Link href={`/play/${activity.id}`} className="btn-ghost btn-sm shrink-0 whitespace-nowrap px-4 py-2 text-sm">
          <ArrowRight className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">صفحة النشاط في الموقع</span>
          <span className="sm:hidden">الموقع</span>
        </Link>
      </div>
      <ActivityPlayer activity={activity} localHtml={localHtml} standalone />
    </div>
  );
}

/** نشاط لا يعرفه الخادم: يُقرأ من مخزن المتصفّح أو من Firestore مباشرة. */
function LocalStandalone({ activityId }: { activityId: string }) {
  const router = useRouter();
  const { state, source, activity, html } = useLocalActivity(activityId);
  const eligible = activity ? opensStandalone(activity) : false;

  useEffect(() => {
    if (state === 'found' && !eligible) router.replace(`/play/${activityId}`);
    if (state === 'missing') router.replace(`/play/${activityId}`);
  }, [state, eligible, activityId, router]);

  if (state !== 'found' || !activity || !eligible) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <StandaloneMode />
        <Loader2 className="h-10 w-10 animate-spin text-[color:var(--maroon)]" />
      </div>
    );
  }
  return <Shell activity={activity} localHtml={source === 'local' ? html : undefined} />;
}

export function StandaloneView({ activity, activityId }: { activity: Activity | null; activityId: string }) {
  return activity ? <Shell activity={activity} /> : <LocalStandalone activityId={activityId} />;
}
