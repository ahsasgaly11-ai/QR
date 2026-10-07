'use client';

import { useState } from 'react';
import { UploadCloud, ListChecks, Layers, LogOut, Megaphone, Download, Gamepad2, ClipboardCheck } from 'lucide-react';
import type { Subject, Activity } from '@/lib/types';
import { AuthGate } from './auth-gate';
import { AdminUploader } from '@/components/admin-uploader';
import { ActivitiesManager } from './activities-manager';
import { ContentManager } from './content-manager';
import { TickerManager } from './ticker-manager';
import { DownloadsManager } from './downloads-manager';
import { signOutAdmin, isFirebaseConfigured } from '@/lib/auth';
import { cn } from '@/lib/utils';

type Tab = 'upload' | 'activities' | 'smart-games' | 'reviews' | 'content' | 'ticker' | 'downloads';

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
    { id: 'smart-games', label: 'ألعاب التعزيز', icon: Gamepad2 },
    { id: 'reviews', label: 'مراجعات الوحدات', icon: ClipboardCheck },
    { id: 'content', label: 'إدارة المناهج', icon: Layers },
    { id: 'ticker', label: 'الشريط المتحرّك', icon: Megaphone },
    { id: 'downloads', label: 'التنزيل', icon: Download },
  ];

  return (
    <AuthGate>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex w-full flex-wrap gap-1 rounded-2xl border border-[color:var(--hairline)] bg-[color:var(--surface)] p-1 shadow-[var(--shadow-sm)] sm:w-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-bold transition sm:flex-none sm:px-4',
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
            className="btn-ghost btn-sm px-4 py-2 text-sm"
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
          structure={structure}
          excludeSmartReinforcement
        />
      )}
      {tab === 'smart-games' && (
        <div className="space-y-10">
          <div>
            <div className="mb-4">
              <h2 className="font-display text-xl font-black text-[color:var(--maroon)]">
                رفع لعبة تعزيز ذكية
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                ارفع ملف HTML واكتب عنوان اللعبة ووصفها. ستظهر في القسم المستقل فقط.
              </p>
            </div>
            <AdminUploader subjects={subjects} smartOnly />
          </div>
          <div>
            <div className="mb-4">
              <h2 className="font-display text-xl font-black text-[color:var(--maroon)]">
                إدارة ألعاب التعزيز
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                عدّل الألعاب المرفوعة أو احذفها من القسم.
              </p>
            </div>
            <ActivitiesManager
              activities={activities}
              uploadedIds={uploadedIds}
              labels={labels}
              structure={structure}
              onlySmartReinforcement
            />
          </div>
        </div>
      )}
      {tab === 'reviews' && (
        <div className="space-y-10">
          <div>
            <div className="mb-4">
              <h2 className="font-display text-xl font-black text-[color:var(--maroon)]">
                رفع مراجعة وحدة
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                ارفع ملف HTML للعبة المراجعة واختر المادة والمستوى والوحدة. تظهر
                المراجعة أعلى الصفحة الرئيسية ليراها الزوّار فور دخولهم.
              </p>
            </div>
            <AdminUploader subjects={subjects} reviewOnly />
          </div>
          <div>
            <div className="mb-4">
              <h2 className="font-display text-xl font-black text-[color:var(--maroon)]">
                إدارة المراجعات
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                عدّل المراجعات المرفوعة أو احذفها — الحذف يُخفيها من الصفحة الرئيسية.
              </p>
            </div>
            <ActivitiesManager
              activities={activities}
              uploadedIds={uploadedIds}
              labels={labels}
              structure={structure}
              onlyUnitReview
            />
          </div>
        </div>
      )}
      {tab === 'content' && <ContentManager initial={structure} activities={activities} />}
      {tab === 'ticker' && <TickerManager />}
      {tab === 'downloads' && <DownloadsManager structure={structure} />}
    </AuthGate>
  );
}
