/**
 * يعرض نصًّا يكتبه المشرف ويلوّن ما بين نجمتين *هكذا* باللون العنّابي —
 * فيتحكّم المشرف بالكلمة المميّزة في العنوان دون لمس الشيفرة.
 */
export function HighlightText({ text }: { text: string }) {
  return (
    <>
      {text.split('*').map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="text-[color:var(--maroon)]">
            {part}
          </span>
        ) : (
          part
        )
      )}
    </>
  );
}
