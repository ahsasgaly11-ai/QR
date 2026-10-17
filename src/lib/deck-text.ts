// ---------------------------------------------------------------------------
// نصّ العرض التقديمي كما يقرؤه الطالب — لاستخراج الأهداف والأسئلة منه.
//
// العروض المحوَّلة من البوربوينت ملف HTML واحد بحجم 10–20 م.ب، أغلبه صور
// وأصوات ومكتبات 3D. نصّ الشرائح نفسه (الأهداف، الأسئلة وإجاباتها، الشرح)
// مكتوب نصوصًا داخل كود الشرائح وداخل HTML، ولا يتجاوز عادةً بضعة عشرات
// الآلاف من الحروف. نستخرجه هنا في المتصفّح فلا يُرسَل إلى الخادم إلا هو.
// ---------------------------------------------------------------------------

const ARABIC = /[؀-ۿ]/;
const ARABIC_ALL = /[؀-ۿ]/g;

/** أقصى طول للنصّ المُرسَل للتحليل (العروض المعتادة دون ربع هذا). */
export const MAX_DECK_TEXT = 60_000;

/** مستندات HTML كاملة محفوظة نصوصًا (ألعاب مضمَّنة) — لها أسئلتها الخاصة. */
const EMBEDDED_DOC_RE = /(["'])(?:<!DOCTYPE|<html)(?:[^"'\\]|\\[\s\S]|(?!\1)["'])*\1/gi;
const DATA_URI_RE = /data:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi;
const STRING_RE = /"((?:[^"\\\n]|\\.){2,2000})"|'((?:[^'\\\n]|\\.){2,2000})'|`((?:[^`\\]|\\.){2,4000})`/g;

/** يفكّ تهريب نصّ JavaScript (\n و\" و\uXXXX) دون تنفيذ أي شيء. */
function unescapeJs(s: string): string {
  return s.replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)/g, (_m, e: string) => {
    if (e[0] === 'u' && e.length === 5) return String.fromCharCode(parseInt(e.slice(1), 16));
    if (e[0] === 'x' && e.length === 3) return String.fromCharCode(parseInt(e.slice(1), 16));
    return e === 'n' || e === 'r' || e === 't' ? ' ' : e;
  });
}

function cleanLine(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** نصّ برمجي لا نصّ شريحة: قوالب ${…} أو كود يغلب فيه غير العربي. */
function looksLikeCode(s: string): boolean {
  if (s.includes('${')) return true;
  if (!/[{};]|=>|\)\s*\{/.test(s)) return false;
  const arabic = s.match(ARABIC_ALL)?.length ?? 0;
  return arabic / s.length < 0.5;
}

/**
 * نصوص العرض العربية بترتيب ورودها في الملف، بلا تكرار. يُستبعد ما في الألعاب
 * المضمَّنة والوسائط والكود. يعيد سطرًا لكل نصّ.
 */
export function extractDeckText(html: string, maxChars = MAX_DECK_TEXT): string {
  const src = html
    .replace(EMBEDDED_DOC_RE, (m, q: string) => (m.length > 20_000 ? `${q}${q}` : m))
    .replace(DATA_URI_RE, '');

  const seen = new Set<string>();
  const lines: string[] = [];
  let size = 0;
  const push = (raw: string) => {
    const t = cleanLine(raw);
    if (t.length < 2 || !ARABIC.test(t) || seen.has(t) || looksLikeCode(t)) return;
    seen.add(t);
    lines.push(t);
    size += t.length + 1;
  };

  // نصوص الشرائح المكتوبة داخل الكود
  for (const m of src.matchAll(STRING_RE)) {
    if (size >= maxChars) break;
    const s = m[1] ?? m[2] ?? m[3] ?? '';
    if (ARABIC.test(s)) push(unescapeJs(s));
  }
  // والنصّ الظاهر في HTML خارج السكربتات والأنماط
  const body = src.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ');
  for (const m of body.matchAll(/>([^<>]+)</g)) {
    if (size >= maxChars) break;
    push(m[1]);
  }

  return lines.join('\n').slice(0, maxChars);
}
