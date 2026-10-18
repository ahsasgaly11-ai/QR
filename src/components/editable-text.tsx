import { HighlightText } from '@/components/highlight-text';

/**
 * نصّ من نصوص الموقع القابلة للتحرير. يُعلَّم بمفتاحه (data-tk) فيستطيع
 * المشرف تعديله مباشرة من الصفحة بزر «تحرير النصوص» (InlineTextEditor) —
 * وللزائر هو نصّ عادي تمامًا. يعمل في مكوّنات الخادم والمتصفّح معًا.
 */
export function T({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return <span data-tk={k}>{highlight ? <HighlightText text={v} /> : v}</span>;
}
