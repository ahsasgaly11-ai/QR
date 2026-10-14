import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import { GLOSS_VERSION, GlossSchema, glossCacheKey, type Gloss } from '@/lib/sign-gloss';
import { GlossError, generateGloss, glossModelName, glossProvider } from '@/lib/sign-gloss-server';

// ---------------------------------------------------------------------------
// POST /api/sign/gloss  { text }  →  { gloss, cached: 'memory'|'static'|'firestore'|false }
//
// يترجم نصّ النشاط إلى غلوس إشاري مقيّد بمفردات القاموس عبر المزوّد المتاح
// (Claude بمفتاح ANTHROPIC_API_KEY، أو Gemini بمفتاح GEMINI_API_KEY المجاني)،
// ويخزّن النتيجة (ذاكرة الخادم + Firestore إن وُجد) فلا يُستدعى النموذج مرّتين
// للنصّ نفسه. بلا مفتاح يعيد 503 فيتراجع المشغّل إلى الوضع الحرفي.
//
// حماية التكلفة والحصّة: النصّ حتى 600 حرف، وسقف يومي لاستدعاءات النموذج لكل
// خادم، وكل الأنشطة المعروفة تُحسب مسبقًا في public/sign/gloss-cache.json.
// ---------------------------------------------------------------------------

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_CHARS = 600;
const DAILY_CAP = Number(process.env.SIGN_GLOSS_DAILY_CAP || 300);

const memory = new Map<string, Gloss>();
let dayStamp = '';
let dayCalls = 0;

let vocabCache: { keys: string[]; set: Set<string> } | null = null;
async function loadVocab() {
  if (vocabCache) return vocabCache;
  const raw = await readFile(path.join(process.cwd(), 'public', 'sign', 'manifest.json'), 'utf8');
  const m = JSON.parse(raw) as { words?: Record<string, unknown> };
  const keys = Object.keys(m.words ?? {}).sort();
  vocabCache = { keys, set: new Set(keys) };
  return vocabCache;
}

let staticCache: Record<string, Gloss> | null = null;
async function loadStatic() {
  if (staticCache) return staticCache;
  try {
    const raw = await readFile(path.join(process.cwd(), 'public', 'sign', 'gloss-cache.json'), 'utf8');
    const j = JSON.parse(raw) as { version?: number; items?: Record<string, Gloss> };
    staticCache = j.version === GLOSS_VERSION ? (j.items ?? {}) : {};
  } catch {
    staticCache = {};
  }
  return staticCache;
}

/** GET: حالة النموذج (للتشخيص من المتصفّح دون استهلاك الحصّة). */
export async function GET() {
  const provider = glossProvider();
  return NextResponse.json({
    enabled: !!provider,
    provider,
    model: glossModelName() || null,
    dailyCap: DAILY_CAP,
    usedToday: dayStamp === new Date().toISOString().slice(0, 10) ? dayCalls : 0,
  });
}

export async function POST(req: Request) {
  let body: { text?: string };
  try {
    body = (await req.json()) as { text?: string };
  } catch {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 });
  }
  const text = (body.text ?? '').trim();
  if (!text) return NextResponse.json({ error: 'النصّ فارغ' }, { status: 400 });
  if (text.length > MAX_CHARS) {
    return NextResponse.json({ error: `النصّ أطول من ${MAX_CHARS} حرفًا` }, { status: 413 });
  }

  const key = glossCacheKey(text);
  const mem = memory.get(key);
  if (mem) return NextResponse.json({ gloss: mem, cached: 'memory' });

  const stat = await loadStatic();
  if (stat[key]) {
    memory.set(key, stat[key]);
    return NextResponse.json({ gloss: stat[key], cached: 'static' });
  }

  const db = getDb();
  if (db) {
    try {
      const snap = await getDoc(doc(db, 'signGloss', key));
      if (snap.exists()) {
        const g = GlossSchema.safeParse(snap.data()?.gloss);
        if (g.success) {
          memory.set(key, g.data);
          return NextResponse.json({ gloss: g.data, cached: 'firestore' });
        }
      }
    } catch {
      /* Firestore غير متاح — نتابع */
    }
  }

  if (!glossProvider()) {
    return NextResponse.json({ error: 'نموذج الغلوس غير مفعّل على الخادم' }, { status: 503 });
  }
  const today = new Date().toISOString().slice(0, 10);
  if (today !== dayStamp) {
    dayStamp = today;
    dayCalls = 0;
  }
  if (dayCalls >= DAILY_CAP) {
    return NextResponse.json({ error: 'بلغ نموذج الغلوس سقفه اليومي' }, { status: 429 });
  }
  dayCalls++;

  const { keys, set } = await loadVocab();
  try {
    const gloss = await generateGloss(text, keys, set);
    memory.set(key, gloss);
    if (db) {
      setDoc(doc(db, 'signGloss', key), {
        text,
        gloss,
        version: GLOSS_VERSION,
        model: glossModelName(),
        createdAt: serverTimestamp(),
      }).catch(() => {});
    }
    return NextResponse.json({ gloss, cached: false });
  } catch (e) {
    if (e instanceof GlossError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: 'خطأ غير متوقّع' }, { status: 500 });
  }
}
