'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Home, ChevronLeft, HardDrive } from 'lucide-react';
import type { Activity } from '@/lib/types';
import { getLocalRecord } from '@/lib/local-store';
import { ActivityPlayer } from './activity-player';
import { OryxMascot } from './oryx-mascot';

/**
 * يُستخدم عندما لا يجد الخادم النشاط: قد يكون نشاطًا مرفوعًا في «وضع العرض»
 * ومحفوظًا داخل متصفّح هذا المستخدم فقط.
 */
export function LocalPlay({ activityId }: { activityId: string }) {
  const [state, setState] = useState<'loading' | 'found' | 'missing'>('loading');
  const [activity, setActivity] = useState<Activity | null>(null);
  const [html, setHtml] = useState<string>('');

  useEffect(() => {
    let alive = true;
    // جرّب المعرّف كما ورد، ثم بصيغته المفكوكة (قد يصل مُرمَّزًا من الرابط)
    const candidates = [activityId];
    try {
      const decoded = decodeURIComponent(activityId);
      if (decoded !== activityId) candidates.push(decoded);
    } catch {
      /* تجاهل */
    }

    (async () => {
      for (const id of candidates) {
        const rec = await getLocalRecord(id);
        if (!alive) return;
        if (rec?.activity && rec.html) {
          setActivity(rec.activity);
          setHtml(rec.html);
          setState('found');
          return;
        }
      }
      if (alive) setState('missing');
    })();

    return () => {
      alive = false;
    };
  }, [activityId]);

  if (state === 'loading') {
    return (
      <div className="grid place-items-center py-32">
        <Loader2 className="h-10 w-10 animate-spin text-[color:var(--maroon)]" />
      </div>
    );
  }

  if (state === 'missing' || !activity) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center px-6 py-24 text-center">
        <OryxMascot className="h-36 w-auto float-mid" />
        <h1 className="mt-6 font-calli text-3xl font-bold text-[color:var(--maroon)]">
          لم نجد هذا النشاط
        </h1>
        <p className="mt-3 text-muted-foreground">
          قد يكون النشاط مرفوعًا في «وضع العرض» على متصفّح آخر، أو حُذف. جرّب
          رفعه من جديد أو تصفّح المناهج.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/browse" className="btn-primary px-6">
            تصفّح المناهج
          </Link>
          <Link href="/admin" className="btn-ghost px-6">
            رفع نشاط
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <nav className="mb-5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link href="/" className="flex items-center gap-1 hover:text-[color:var(--maroon)]">
          <Home className="h-4 w-4" /> الرئيسية
        </Link>
        <ChevronLeft className="h-4 w-4" />
        <Link href={`/subject/${activity.subjectId}`} className="hover:text-[color:var(--maroon)]">
          المادة
        </Link>
        <ChevronLeft className="h-4 w-4" />
        <span className="font-bold text-foreground">{activity.title}</span>
      </nav>

      <h1 className="mb-1 font-calli text-3xl font-bold text-[color:var(--maroon)] sm:text-4xl">
        {activity.title}
      </h1>
      {activity.description && (
        <p className="mb-4 max-w-3xl text-muted-foreground">{activity.description}</p>
      )}

      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-[color:var(--gold)]/35 bg-[color:var(--gold)]/10 p-4 text-sm">
        <HardDrive className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--gold)]" />
        <p>
          <b>وضع العرض:</b> هذا النشاط محفوظ في متصفّحك فقط. فعّل Firebase ليظهر
          لجميع الزوّار وتُجمَع إحصاءاته.
        </p>
      </div>

      <ActivityPlayer activity={activity} localHtml={html} />
    </div>
  );
}
