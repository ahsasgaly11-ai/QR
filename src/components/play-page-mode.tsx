'use client';

import { useEffect } from 'react';

/**
 * يعلّم الصفحة بأنها صفحة تشغيل نشاط (data-play على <html>) ما دامت معروضة،
 * فتُطبَّق عليها أنماط الجوال الطولي: مسرح بعرض الشاشة، وإخفاء الأزرار
 * العائمة التي كانت تغطّي اللعبة وشريط أدواتها.
 */
export function PlayPageMode() {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-play', '1');
    return () => root.removeAttribute('data-play');
  }, []);
  return null;
}
