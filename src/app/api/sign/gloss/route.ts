import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import {
  GLOSS_SYSTEM_PROMPT,
  GLOSS_VERSION,
  GlossSchema,
  buildGlossUserMessage,
  glossCacheKey,
  sanitizeGloss,
  type Gloss,
} from '@/lib/sign-gloss';

// ---------------------------------------------------------------------------
// POST /api/sign/gloss  { text }  →  { gloss, cached: 'memory'|'static'|'firestore'|false }
//
// يترجم نصّ النشاط إلى غلوس إشاري مقيّد بمفردات القاموس عبر Claude، ويخزّن
// النتيجة (ذاكرة الخادم + Firestore إن وُجد) فلا تُستدعى الواجهة مرّتين للنصّ
// نفسه. بلا ANTHROPIC_API_KEY يعيد 503 فيتراجع المشغّل إلى الوضع الحرفي.
//
// حماية التكلفة: النصّ حتى 600 حرف، وسقف يومي لاستدعاءات النموذج لكل خادم،
// وكل الأنشطة المعروفة تُحسب مسبقًا في public/sign/gloss-cache.json.
// ---------------------------------------------------------------------------

export const runtime = 'nodejs';
export const maxDuration = 60;

const MODEL = 'claude-opus-5-5';
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

const WORD_RE = /[\p{L}\p{M}\p{N}]+/gu;

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

  if (!process.env.ANTHROPIC_API_KEY) {
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
  const words = text.match(WORD_RE) ?? [];
  const client = new Anthropic();
  try {
    const res = await client.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: 'medium', format: zodOutputFormat(GlossSchema) },
      system: [{ type: 'text', text: GLOSS_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: buildGlossUserMessage(text, keys, words) }],
    });
    if (res.stop_reason === 'refusal' || !res.parsed_output) {
      return NextResponse.json({ error: 'تعذّر توليد الغلوس' }, { status: 502 });
    }
    const gloss = sanitizeGloss(res.parsed_output, set, words.length);
    memory.set(key, gloss);
    if (db) {
      setDoc(doc(db, 'signGloss', key), {
        text,
        gloss,
        version: GLOSS_VERSION,
        model: MODEL,
        createdAt: serverTimestamp(),
      }).catch(() => {});
    }
    return NextResponse.json({ gloss, cached: false });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: 'النموذج مشغول، حاول لاحقًا' }, { status: 429 });
    }
    if (e instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `خطأ من النموذج (${e.status})` }, { status: 502 });
    }
    return NextResponse.json({ error: 'خطأ غير متوقّع' }, { status: 500 });
  }
}
