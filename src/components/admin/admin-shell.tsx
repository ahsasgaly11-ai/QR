'use client';

import { useState } from 'react';
import { UploadCloud, ListChecks, Layers, LogOut } from 'lucide-react';
import type { Subject, Activity } from '@/lib/types';
import { AuthGate } from './auth-gate';
import { AdminUploader } from '@/components/admin-uploader';
import { ActivitiesManager } from './activities-manager';
import { ContentManager } from './content-manager';
import { signOutAdmin, isFirebaseConfigured } from '@/lib/auth';
import { cn } from '@/lib/utils';

type Tab = 'upload' | 'activities' | 'content';

export function AdminShell({
  subjects,
  structure,
  activities,
  uploadedIds,
  labels,
}: {
  subjects: Subject[];
  structure: Subject[];
  activities: Activity[];
  uploadedIds: string[];
  labels: Record<string, string>;
}) {
  const [tab, setTab] = useState<Tab>('upload');

  const tabs: { id: Tab; label: string; icon: typeof UploadCloud }[] = [
    { id: 'upload', label: 'رفع نشاط', icon: UploadCloud },
    { id: 'activities', label: 'إدارة الأنشطة', icon: ListChecks },
    { id: 'content', label: 'إدارة المناهج', icon: Layers },
  ];

  return (
    <AuthGate>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-2xl border border-[color:var(--hairline)] bg-[color:var(--surface)] p-1 shadow-[var(--shadow-sm)]">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition',
                tab === t.id
                  ? 'bg-[color:var(--maroon)] text-white shadow-[var(--shadow-sm)]'
                  : 'text-foreground/70 hover:text-[color:var(--maroon)]'
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>
        {isFirebaseConfigured && (
          <button
            onClick={() => signOutAdmin()}
            className="btn-ghost px-4 py-2 text-sm"
          >
            <LogOut className="h-4 w-4" /> خروج
          </button>
        )}
      </div>

      {tab === 'upload' && <AdminUploader subjects={subjects} />}
      {tab === 'activities' && (
        <ActivitiesManager
          activities={activities}
          uploadedIds={uploadedIds}
          labels={labels}
        />
      )}
      {tab === 'content' && <ContentManager initial={structure} />}
    </AuthGate>
  );
}
