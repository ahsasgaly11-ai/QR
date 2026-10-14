// ---------------------------------------------------------------------------
// اختيار نموذج Gemini تلقائيًّا (خادم فقط)
//
// Google تُوقف نماذج Flash القديمة للمفاتيح الجديدة دوريًّا (مثل gemini-2.0-flash
// ثم gemini-2.5-flash)، فتثبيت اسم نموذج في الكود يكسر الميزة بصمت. هنا:
//   1) إن ضُبط GEMINI_MODEL يُستخدم كما هو.
//   2) وإلا تُسأل واجهة ListModels بالمفتاح نفسه، ويُختار أحدث نموذج «flash»
//      يدعم generateContent (مع تفضيل غير lite وغير التجريبي/المعاينة).
//   3) تُخزَّن النتيجة في الذاكرة، وتُعاد الاكتشاف إن أعاد النموذج 404 لاحقًا.
// ---------------------------------------------------------------------------

const API = 'https://generativelanguage.googleapis.com/v1beta';

let cached: string | null = null;
let inflight: Promise<string> | null = null;

interface ModelInfo {
  name?: string; // "models/gemini-x.y-flash"
  supportedGenerationMethods?: string[];
}

/** رقم الإصدار من اسم النموذج (gemini-3.8-flash ← 3.8) للترتيب. */
function versionOf(id: string): number {
  const m = /gemini-(\d+(?:\.\d+)?)/.exec(id);
  return m ? Number(m[1]) : 0;
}

/** درجة التفضيل: flash ثابت أعلى من lite/preview/exp. */
function rank(id: string): number {
  let r = versionOf(id) * 10;
  if (/lite/.test(id)) r -= 3;
  if (/preview|exp|experimental/.test(id)) r -= 2;
  if (/-\d{3}$|-\d{2}-\d{4}$/.test(id)) r -= 0.5; // لقطات مؤرّخة: الاسم المستقرّ أولى
  return r;
}

async function discover(key: string): Promise<string> {
  const found: string[] = [];
  let pageToken = '';
  for (let page = 0; page < 5; page++) {
    const url = `${API}/models?pageSize=200${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const res = await fetch(url, { headers: { 'x-goog-api-key': key } });
    if (!res.ok) break;
    const j = (await res.json()) as { models?: ModelInfo[]; nextPageToken?: string };
    for (const m of j.models ?? []) {
      const id = (m.name ?? '').replace(/^models\//, '');
      if (
        /^gemini-[\d.]+-flash/.test(id) &&
        !/image|audio|tts|live|thinking|embedding/.test(id) &&
        (m.supportedGenerationMethods ?? []).includes('generateContent')
      ) {
        found.push(id);
      }
    }
    if (!j.nextPageToken) break;
    pageToken = j.nextPageToken;
  }
  if (!found.length) return 'gemini-flash-latest'; // اسم مستعار تحافظ عليه Google لأحدث Flash
  found.sort((a, b) => rank(b) - rank(a));
  return found[0];
}

/** يعيد اسم النموذج المناسب لهذا المفتاح. */
export async function resolveGeminiModel(key: string): Promise<string> {
  const pinned = process.env.GEMINI_MODEL?.trim();
  if (pinned) return pinned;
  if (cached) return cached;
  if (!inflight) {
    inflight = discover(key)
      .then((m) => (cached = m))
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** يُستدعى عند 404 من النموذج المختار: يمسح الاختيار ليُعاد الاكتشاف. */
export function forgetGeminiModel(): void {
  cached = null;
}

/** اسم النموذج المعروف حاليًّا (للعرض فقط؛ قد يكون فارغًا قبل أول استدعاء). */
export function currentGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || cached || 'auto';
}
