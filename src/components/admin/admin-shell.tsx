'use client';

import { useEffect, useState } from 'react';
import { UploadCloud, ListChecks, Layers, LogOut, Megaphone, Download, Gamepad2, ClipboardCheck, Presentation, HeartHandshake, SpellCheck2, Heading, Users, Hand } from 'lucide-react';
import type { Subject, Activity, BoardGame } from '@/lib/types';
import { AuthGate, useAdminIdentity } from './auth-gate';
import { RolesManager } from './roles-manager';
import type { AdminRole } from '@/lib/roles';
import { AdminUploader } from '@/components/admin-uploader';
import { ActivitiesManager } from './activities-manager';
import { BoardGamesManager } from './board-games-manager';
import { ContentManager } from './content-manager';
import { TickerManager } from './ticker-manager';
import { TextsManager } from './texts-manager';
import { ImpactManager } from './impact-manager';
import { DownloadsManager } from './downloads-manager';
import { ContentAudit } from './content-audit';
import { PedagogyPackApply } from './pedagogy-pack-apply';
import { PedagogyExtractAudit } from './pedagogy-extract-audit';
import { signOutAdmin, isFirebaseConfigured } from '@/lib/auth';
import { cn } from '@/lib/utils';

type Tab = 'upload' | 'activities' | 'smart-games' | 'board-games' | 'presentations' | 'reviews' | 'content' | 'audit' | 'texts' | 'ticker' | 'impact' | 'downloads' | 'roles';

type ShellProps = {
  subjects: Subject[];
  structure: Subject[];
  activities: Activity[];
  uploadedIds: string[];
  labels: Record<string, string>;
  /** ألعاب السبورة الذكية كاملة (بما فيها المخفيّة) مدمجةً من البذرة وFirestore */
  boardGames: BoardGame[];
};

/** التبويبات المتاحة لكل صلاحية — المالك يرى الكل. */
const ROLE_TABS: Record<Exclude<AdminRole, 'owner'>, Tab[]> = {
  texts: ['texts'],
  uploader: ['upload', 'activities', 'smart-games', 'board-games', 'presentations', 'reviews'],
};

export function AdminShell(props: ShellProps) {
  return (
    <AuthGate>
      <AdminPanel {...props} />
    </AuthGate>
  );
}

function AdminPanel({ subjects, structure, activities, uploadedIds, labels, boardGames }: ShellProps) {
  const { role } = useAdminIdentity();
  const [tab, setTab] = useState<Tab>(role === 'texts' ? 'texts' : 'upload');

  const tabs = ([
    { id: 'upload', label: 'رفع نشاط', icon: UploadCloud },
    { id: 'activities', label: 'إدارة الأنشطة', icon: ListChecks },
    { id: 'smart-games', label: 'ألعاب التعزيز', icon: Gamepad2 },
    { id: 'board-games', label: 'ألعاب السبورة', icon: Hand },
    { id: 'presentations', label: 'العروض الذكية', icon: Presentation },
    { id: 'reviews', label: 'مراجعات الوحدات', icon: ClipboardCheck },
    { id: 'content', label: 'إدارة المناهج', icon: Layers },
    { id: 'audit', label: 'تدقيق المحتوى', icon: SpellCheck2 },
    { id: 'texts', label: 'عناوين الأقسام', icon: Heading },
    { id: 'ticker', label: 'الشريط المتحرّك', icon: Megaphone },
    { id: 'impact', label: 'أثر التعلّم', icon: HeartHandshake },
    { id: 'downloads', label: 'التنزيل', icon: Download },
    { id: 'roles', label: 'المشرفون والصلاحيات', icon: Users },
  ] as { id: Tab; label: string; icon: typeof UploadCloud }[]).filter((t) => role === 'owner' || ROLE_TABS[role].includes(t.id));

  // لا يبقى تبويب غير مسموح مفتوحًا إن تغيّرت الصلاحية
  useEffect(() => {
    if (!tabs.some((t) => t.id === tab)) setTab(tabs[0].id);
  }, [tabs, tab]);

  return (
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
      {tab === 'board-games' && <BoardGamesManager initial={boardGames} structure={structure} />}
      {tab === 'presentations' && (
        <div className="space-y-10">
          <div>
            <div className="mb-4">
              <h2 className="font-display text-xl font-semibold text-foreground">
                رفع عرض تقديمي ذكي <span className="beta-pill align-middle">تجريبي</span>
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                ارفع ملف HTML يحاكي شرائح الدرس بتجارب ومحاكاة ومؤثّرات، واختر درسه.
                يظهر في قسم «العروض التقديمية الذكية» وزرًّا «عرض الدرس» داخل الدرس.
              </p>
            </div>
            <AdminUploader subjects={subjects} presentationOnly />
          </div>
          <div>
            <div className="mb-4">
              <h2 className="font-display text-xl font-semibold text-foreground">
                إدارة العروض
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                عدّل العروض المرفوعة أو انقلها إلى درس آخر أو استبدل ملفها أو احذفها.
              </p>
            </div>
            <ActivitiesManager
              activities={activities}
              uploadedIds={uploadedIds}
              labels={labels}
              structure={structure}
              onlyPresentation
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
                في صفحة «مراجعات الوحدات» التي يفتحها الزرّ الذهبي في الواجهة الأولى.
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
                عدّل المراجعات المرفوعة أو احذفها — الحذف يُخفيها من الموقع.
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
      {tab === 'audit' && (
        <div className="space-y-6">
          <PedagogyExtractAudit activities={activities} structure={structure} />
          <PedagogyPackApply activities={activities} structure={structure} />
          <ContentAudit activities={activities} structure={structure} />
        </div>
      )}
      {tab === 'texts' && <TextsManager subjects={subjects} />}
      {tab === 'roles' && <RolesManager />}
      {tab === 'ticker' && <TickerManager />}
      {tab === 'impact' && <ImpactManager />}
      {tab === 'downloads' && <DownloadsManager structure={structure} />}
        </div>
      </div>
  );
}
