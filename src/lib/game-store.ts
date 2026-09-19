import { getDb } from '@/lib/firebase';

// ---------------------------------------------------------------------------
// تخزين ملفات الألعاب داخل Firestore (بلا Firebase Storage)
//
// منذ فبراير 2026 صار Firebase Storage يتطلّب ربط بطاقة بنكية (خطة Blaze)
// حتى للاستخدام الصفري. Firestore يبقى مجانيًا تمامًا على خطة Spark، لذا
// نُخزّن ملف الـ HTML نفسه فيه.
//
// حدّ حجم الوثيقة الواحدة في Firestore ≈ 1 ميجابايت، فنقسّم الملف إلى أجزاء
// تحت مجموعة فرعية:  activities/{id}/chunks/{0..n-1}
// ويحمل كل جزء الحقل `s` (نص). عند التشغيل تُقرأ الأجزاء بطلب واحد وتُجمَع
// بالترتيب فيعود الملف كما كان بايتًا ببايت.
// ---------------------------------------------------------------------------

/** أقصى عدد بايتات في الجزء الواحد — دون حدّ الوثيقة (1 م.ب) بهامش أمان. */
const MAX_CHUNK_BYTES = 800_000;

/** أقصى حجم ملف مقبول (قبل التقسيم). */
export const MAX_GAME_BYTES = 30 * 1024 * 1024;

const encoder = new TextEncoder();

function byteLength(s: string): number {
  return encoder.encode(s).length;
}

/**
 * يقسّم النص إلى أجزاء لا يتجاوز أيٌّ منها `maxBytes` بعد ترميز UTF-8،
 * دون قطع زوج بديل (surrogate pair) في المنتصف فيفسد الحرف.
 */
export function chunkByBytes(text: string, maxBytes = MAX_CHUNK_BYTES): string[] {
  const out: string[] = [];
  let i = 0;

  while (i < text.length) {
    // أكبر تخمين ممكن: بايت واحد لكل حرف. ثم نُقلّص حتى يتّسع فعلًا.
    let len = Math.min(text.length - i, maxBytes);
    let piece = text.slice(i, i + len);

    while (len > 1 && byteLength(piece) > maxBytes) {
      len = Math.max(1, Math.floor(len * 0.72));
      piece = text.slice(i, i + len);
    }

    // لا تقطع بين النصفين الأعلى والأدنى لحرف خارج المستوى الأساسي
    if (i + len < text.length) {
      const last = piece.charCodeAt(piece.length - 1);
      if (last >= 0xd800 && last <= 0xdbff && len > 1) {
        len -= 1;
        piece = text.slice(i, i + len);
      }
    }

    out.push(piece);
    i += len;
  }

  return out;
}

export interface SaveProgress {
  /** عدد الأجزاء المكتوبة حتى الآن. */
  done: number;
  /** إجمالي الأجزاء. */
  total: number;
}

/**
 * يحفظ محتوى ملف اللعبة مقسّمًا تحت activities/{id}/chunks.
 * يعيد عدد الأجزاء ليُسجَّل في وثيقة النشاط.
 */
export async function saveGameHtml(
  id: string,
  html: string,
  onProgress?: (p: SaveProgress) => void
): Promise<number> {
  const db = getDb();
  if (!db) throw new Error('تعذّر الاتصال بقاعدة البيانات.');

  const size = byteLength(html);
  if (size > MAX_GAME_BYTES) {
    throw new Error(
      `حجم الملف ${(size / 1048576).toFixed(1)} م.ب ويتجاوز الحدّ المسموح (${
        MAX_GAME_BYTES / 1048576
      } م.ب).`
    );
  }

  const { doc, writeBatch, collection } = await import('firebase/firestore');
  const parts = chunkByBytes(html);
  const chunksCol = collection(db, 'activities', id, 'chunks');

  // Firestore يسمح بـ 500 عملية في الدفعة الواحدة؛ ونُبقي الدفعات صغيرة
  // أيضًا حتى لا يتضخّم حجم الطلب الواحد على شبكة الجوال.
  const PER_BATCH = 4;
  for (let start = 0; start < parts.length; start += PER_BATCH) {
    const batch = writeBatch(db);
    const slice = parts.slice(start, start + PER_BATCH);
    slice.forEach((s, k) => {
      batch.set(doc(chunksCol, String(start + k)), { s });
    });
    await batch.commit();
    onProgress?.({ done: Math.min(start + PER_BATCH, parts.length), total: parts.length });
  }

  return parts.length;
}

/** يقرأ أجزاء اللعبة ويعيد ملف الـ HTML كاملًا. */
export async function loadGameHtml(id: string): Promise<string | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const { collection, getDocs } = await import('firebase/firestore');
    const snap = await getDocs(collection(db, 'activities', id, 'chunks'));
    if (snap.empty) return null;

    const parts: string[] = [];
    snap.forEach((d) => {
      const n = Number(d.id);
      if (Number.isFinite(n)) parts[n] = (d.data() as { s?: string }).s ?? '';
    });

    // لو سقط جزء لسبب ما، لا نُرجع ملفًا ناقصًا يظهر مكسورًا للطالب
    if (parts.length === 0 || parts.some((p) => p === undefined)) return null;
    return parts.join('');
  } catch {
    return null;
  }
}

// --- نسخة المعاينة الخفيفة (وثيقة واحدة) ----------------------------------

/**
 * يحفظ نسخة المعاينة في وثيقة واحدة تحت activities/{id}/preview/doc،
 * فتُقرأ بقراءة واحدة سريعة بدل تحميل الملف الكامل داخل بطاقة الدرس.
 */
export async function savePreviewHtml(id: string, html: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const { makePreviewHtml, PREVIEW_VERSION } = await import('@/lib/preview-html');
  const light = makePreviewHtml(html);
  if (!light) return false;
  try {
    const { doc, setDoc } = await import('firebase/firestore');
    await setDoc(doc(db, 'activities', id, 'preview', 'doc'), {
      s: light,
      v: PREVIEW_VERSION,
    });
    return true;
  } catch {
    return false;
  }
}

export async function loadPreviewHtml(id: string): Promise<string | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const { doc, getDoc } = await import('firebase/firestore');
    const snap = await getDoc(doc(db, 'activities', id, 'preview', 'doc'));
    if (!snap.exists()) return null;
    return (snap.data() as { s?: string }).s ?? null;
  } catch {
    return null;
  }
}

/** يحذف كل أجزاء اللعبة (يُستدعى قبل حذف وثيقة النشاط). */
export async function deleteGameChunks(id: string): Promise<void> {
  const db = getDb();
  if (!db) return;

  const { collection, getDocs, writeBatch, doc, deleteDoc } = await import(
    'firebase/firestore'
  );

  // وثيقة المعاينة أيضًا — وإلا بقيت بلا صاحب تستهلك المساحة
  try {
    await deleteDoc(doc(db, 'activities', id, 'preview', 'doc'));
  } catch {
    /* قد لا تكون موجودة */
  }

  const snap = await getDocs(collection(db, 'activities', id, 'chunks'));
  if (snap.empty) return;

  const ids = snap.docs.map((d) => d.id);
  const PER_BATCH = 200;
  for (let start = 0; start < ids.length; start += PER_BATCH) {
    const batch = writeBatch(db);
    for (const cid of ids.slice(start, start + PER_BATCH)) {
      batch.delete(doc(db, 'activities', id, 'chunks', cid));
    }
    await batch.commit();
  }
}
