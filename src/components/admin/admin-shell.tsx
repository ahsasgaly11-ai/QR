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
      <div className="admin-layout">
        {/* شريط جانبي على الحاسوب، وشريط أفقي قابل للتمرير على الجوال */}
        <nav className="admin-rail" aria-label="أقسام لوحة الإدارة">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={cn('admin-tab', tab === t.id && 'is-on')}
            >
              <t.icon className="h-[1.1rem] w-[1.1rem] shrink-0" />
              {t.label}
            </button>
          ))}
          {isFirebaseConfigured && (
            <button type="button" onClick={() => signOutAdmin()} className="admin-tab admin-tab--out">
              <LogOut className="h-[1.1rem] w-[1.1rem] shrink-0" /> خروج
            </button>
          )}
        </nav>

        <div className="min-w-0">
          <h2 className="admin-section-title">{tabs.find((t) => t.id === tab)?.label}</h2>
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
              <h2 className="font-display text-xl font-semibold text-foreground">
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
              <h2 className="font-display text-xl font-semibold text-foreground">
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
              <h2 className="font-display text-xl font-semibold text-foreground">
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
              <h2 className="font-display text-xl font-semibold text-foreground">
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
        </div>
      </div>
    </AuthGate>
  );
}
