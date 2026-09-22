'use client';

import { useMemo, useRef, useState } from 'react';
import { Search, X, MapPin, GraduationCap, Check } from 'lucide-react';
import {
  searchSchools,
  MUNICIPALITY_BY_ID,
  STAGE_LABEL,
  GENDER_LABEL,
  type QatarSchool,
} from '@/data/qatar-schools';
import { cn } from '@/lib/utils';

/**
 * شريط بحث لاختيار المدرسة: يبحث بالاسم أو البلدية أو بالكتابة الحرّة،
 * ويجمّع النتائج تحت اسم بلديتها. عند الاختيار يُستدعى onSelect.
 */
export function SchoolPicker({
  onSelect,
  selectedId,
  autoFocus = true,
}: {
  onSelect: (school: QatarSchool) => void;
  selectedId?: string | null;
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const results = useMemo(() => searchSchools(q, 60), [q]);

  // تجميع النتائج حسب البلدية مع الحفاظ على ترتيب الظهور.
  const groups = useMemo(() => {
    const map = new Map<string, QatarSchool[]>();
    for (const s of results) {
      const arr = map.get(s.municipalityId) ?? [];
      arr.push(s);
      map.set(s.municipalityId, arr);
    }
    return [...map.entries()];
  }, [results]);

  return (
    <div className="mx-auto w-full max-w-xl">
      {/* شريط البحث */}
      <div className="relative">
        <Search className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="اكتب اسم مدرستك أو بلديتك…"
          aria-label="ابحث عن مدرستك"
          className="w-full rounded-2xl border border-[color:var(--hairline-strong)] bg-[color:var(--surface)] py-3.5 pr-12 pl-11 text-base font-bold text-foreground shadow-[var(--shadow-sm)] outline-none transition focus:border-[color:var(--maroon)] focus:ring-4 focus:ring-[color:var(--maroon)]/15"
        />
        {q && (
          <button
            onClick={() => {
              setQ('');
              inputRef.current?.focus();
            }}
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-[color:var(--maroon)]"
            aria-label="مسح"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* قائمة النتائج */}
      <div className="mt-3 max-h-[46vh] overflow-y-auto rounded-2xl border border-[color:var(--hairline)] bg-[color:var(--surface)]">
        {groups.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm font-bold text-muted-foreground">
            لا توجد مدرسة مطابقة — جرّب كلمة أخرى أو اسم البلدية.
          </p>
        ) : (
          groups.map(([munId, schools]) => {
            const mun = MUNICIPALITY_BY_ID[munId as keyof typeof MUNICIPALITY_BY_ID];
            return (
              <div key={munId}>
                <div className="sticky top-0 z-10 flex items-center gap-1.5 border-b border-[color:var(--hairline)] bg-[color:var(--surface-2)] px-4 py-1.5 text-xs font-black text-[color:var(--maroon)]">
                  <MapPin className="h-3.5 w-3.5 text-[color:var(--gold)]" />
                  {mun?.name}
                  <span className="text-muted-foreground">({schools.length})</span>
                </div>
                <ul>
                  {schools.map((s) => {
                    const active = s.id === selectedId;
                    return (
                      <li key={s.id}>
                        <button
                          onClick={() => onSelect(s)}
                          className={cn(
                            'flex w-full items-center gap-3 px-4 py-2.5 text-right transition hover:bg-[color:var(--surface-2)]',
                            active && 'bg-[color:var(--maroon)]/5'
                          )}
                        >
                          <GraduationCap className="h-4 w-4 shrink-0 text-[color:var(--maroon)]" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold text-foreground">
                              {s.name}
                            </span>
                            <span className="block text-xs font-medium text-muted-foreground">
                              {STAGE_LABEL[s.stage]} · {GENDER_LABEL[s.gender]}
                            </span>
                          </span>
                          {active && (
                            <Check className="h-4 w-4 shrink-0 text-[color:var(--maroon)]" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
