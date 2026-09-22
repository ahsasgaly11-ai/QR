'use client';

import { useEffect, useState } from 'react';
import { GraduationCap, MapPin, Pencil } from 'lucide-react';
import {
  getSelectedSchool,
  setSelectedSchool,
  onSchoolChange,
  type StoredSchool,
} from '@/lib/school-store';
import { MUNICIPALITY_BY_ID } from '@/data/qatar-schools';
import { SchoolPicker } from './school-picker';
import { OryxMascot } from './oryx-mascot';

/**
 * بوّابة إلزامية: يجب على المستخدم اختيار مدرسته قبل تشغيل اللعبة أو تحميلها.
 * قبل الاختيار تُعرض بطاقة الاختيار؛ بعده يُعرض المحتوى (المشغّل) مع شريط صغير
 * يبيّن المدرسة المختارة ويتيح تغييرها.
 */
export function SchoolGate({ children }: { children: React.ReactNode }) {
  const [school, setSchool] = useState<StoredSchool | null>(null);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setSchool(getSelectedSchool());
    setReady(true);
    return onSchoolChange(() => setSchool(getSelectedSchool()));
  }, []);

  // قبل معرفة الحالة (تفادي وميض): مساحة محجوزة بسيطة.
  if (!ready) {
    return <div className="min-h-[40vh]" aria-hidden />;
  }

  // لا مدرسة مختارة → بوّابة الاختيار.
  if (!school) {
    return (
      <div className="card-premium mx-auto max-w-2xl rounded-3xl p-6 text-center sm:p-9">
        <OryxMascot className="mx-auto h-24 w-auto float-mid" />
        <h2 className="mt-4 font-calli text-2xl font-bold text-[color:var(--maroon)] sm:text-3xl">
          اختر مدرستك أولًا
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          قبل تشغيل اللعبة أو تحميلها، اختر اسم مدرستك من القائمة — يساعدنا هذا
          على رسم خريطة حرارية لانتشار المستخدمين في مناطق قطر.
        </p>
        <div className="mt-6">
          <SchoolPicker onSelect={(s) => setSelectedSchool(s)} />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          لا نطلب أي بيانات شخصية — اسم المدرسة فقط لأغراض إحصائية.
        </p>
      </div>
    );
  }

  const munName =
    MUNICIPALITY_BY_ID[school.municipalityId as keyof typeof MUNICIPALITY_BY_ID]
      ?.name;

  // مدرسة مختارة، ووضع التغيير مفعّل.
  if (editing) {
    return (
      <div className="card-premium mx-auto max-w-2xl rounded-3xl p-6 text-center sm:p-9">
        <h2 className="font-calli text-2xl font-bold text-[color:var(--maroon)]">
          غيّر مدرستك
        </h2>
        <div className="mt-5">
          <SchoolPicker
            selectedId={school.id}
            onSelect={(s) => {
              setSelectedSchool(s);
              setEditing(false);
            }}
          />
        </div>
        <button
          onClick={() => setEditing(false)}
          className="btn-ghost mt-4 px-6"
        >
          إلغاء
        </button>
      </div>
    );
  }

  // مدرسة مختارة → شريط صغير + المحتوى.
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--gold)]/35 bg-[color:var(--gold)]/10 px-4 py-2.5">
        <span className="flex min-w-0 items-center gap-2 text-sm font-bold text-foreground">
          <GraduationCap className="h-4 w-4 shrink-0 text-[color:var(--maroon)]" />
          <span className="truncate">{school.name}</span>
          {munName && (
            <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 text-[color:var(--gold)]" />
              {munName}
            </span>
          )}
        </span>
        <button
          onClick={() => setEditing(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-[color:var(--gold)]/40 bg-[color:var(--surface)]/70 px-3 py-1.5 text-xs font-bold text-[color:var(--maroon)] transition hover:bg-[color:var(--gold)]/10"
        >
          <Pencil className="h-3.5 w-3.5" /> تغيير المدرسة
        </button>
      </div>
      {children}
    </div>
  );
}
