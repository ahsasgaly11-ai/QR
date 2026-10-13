'use client';

import { useEffect, useState } from 'react';
import { MessageSquareQuote, Quote } from 'lucide-react';
import { IMPACT_ROLES, subscribeImpact, type ImpactSettings } from '@/lib/impact';

/**
 * آراء المعلّمين والطلبة في قسم «أثر التعلّم». تصل من الخادم مضمَّنة في
 * الصفحة (initial) فتظهر فورًا، ثم تتابع أي تعديل ينشره المشرف من لوحة
 * الإدارة في اللحظة نفسها. لا يظهر شيء ما لم يُنشر رأي واحد على الأقل.
 */
export function ImpactVoices({ initial }: { initial: ImpactSettings }) {
  const [s, setS] = useState(initial);
  useEffect(() => subscribeImpact(setS), []);

  if (!s.enabled || s.items.length === 0) return null;

  return (
    <div className="impact-voices">
      <h3 className="impact-voices-head">
        <MessageSquareQuote className="h-5 w-5 text-[color:var(--maroon)]" aria-hidden />
        بكلماتهم: ماذا قال من جرّب المنصّة؟
      </h3>
      <ul className="impact-quotes">
        {s.items.map((t, i) => (
          <li key={i} className="impact-quote" data-role={t.role}>
            <Quote className="impact-quote-mark" aria-hidden />
            <blockquote>
              <p>{t.quote}</p>
            </blockquote>
            <footer>
              <span className="impact-role">{IMPACT_ROLES[t.role]}</span>
              {t.name && <span className="impact-name">{t.name}</span>}
              {t.school && <span>{t.school}</span>}
            </footer>
          </li>
        ))}
      </ul>
    </div>
  );
}
