# دمج لعبة جديدة في الموقع (مولَّد 2026-10-23)
خطوات إضافة لعبة إلى قسم «ألعاب السبورة الذكية» `/board-games` في منصة مناهج قطر (Next.js):

1. **مجلد اللعبة:** `public/<slug>/` (`index.html`، `js/main.js`، `js/game.js`، `js/content.js`، `css/game.css`،
   و`cover.jpg` لقطة 1280×800 من اللعبة أثناء اللعب).
2. **التحويل (اختياري):** للرابط القصير فقط، في `next.config.ts` داخل `redirects()`:
   `{ source: '/<slug>', destination: '/<slug>/index.html', permanent: false }` والسطر نفسه مع `'/<slug>/'`.
   الموقع يفتح `/<slug>/index.html` مباشرة ولا يحتاج التحويل.
3. **الظهور في القسم:** بعد نشر المجلد، من لوحة الإدارة `/admin` ← «ألعاب السبورة» ← «إضافة لعبة»: اسم المجلد
   (تتحقّق اللوحة من `index.html` و`cover.jpg`)، والعنوان والوصف ونواتج التعلّم وأوضاع اللعب والدرس المرتبط من
   شجرة المنهج. تُحفظ في Firestore (`boardGames/{slug}`) وتظهر فورًا في `/board-games` وداخل درسها في صفحة المادة.
   لا تعديل في الكود. (بديل: كائن في `BOARD_GAME_SEEDS` في `src/data/board-games.ts` كبذرة مضمّنة؛ الحقول موثّقة في
   `src/lib/types.ts` تحت `BoardGame`، والدمج في `src/lib/board-games.ts`.)
4. **التجربة:** `/<slug>/index.html?sim` (الماوس يتصرف كيد)، ثم شاشة هاتف أفقية، ثم الجهاز الحقيقي في الصف.
5. **لا تكرّر** `vendor/` ولا `models/` ولا ملفات المحرّك داخل مجلد اللعبة: كلها في `/board-kit/`.

الملفات الحالية للمرجع:

> **مستوى الرسوميات لكل لعبة يحدّده الملف 10** (تقنية «دانة الصف» و«مختبر العدسة المكبّرة»): three.js الكلاسيكي (`three.module.min.js` مع `three/addons/`)، وإضاءة بيئية PMREM، ومواد فيزيائية، وعالم بالمظلِّلات، و`EffectComposer` للتوهّج والتدرّج اللوني. أي عبارة هنا تقدّم WebGPU على أنه المسار الأساسي، أو تمنع `ShaderMaterial` و`EffectComposer`، يحلّ محلّها الملف 10. مثال مطبَّق: `public/germ-hunters/`.

## `src/data/board-games.ts`

```ts
// ---------------------------------------------------------------------------
// القائمة المضمّنة (البذرة) لـ«ألعاب السبورة الذكية»: ألعاب تُلعب بلمس
// السبورة باليد، يعرضها جهاز (هاتف أو آيباد) على جهاز العرض بانعكاس الشاشة —
// Screen Mirroring أو تطبيق Epson iProjection أو Apple TV أو كابل HDMI — ويرى
// أيدي الطلاب بكاميرته.
//
// كل لعبة تطبيق ويب ثابت في public/<slug>/ مبني على المحرّك المشترك
// public/board-kit/ (راجع board-kit/README_AR.md).
//
// هذه القائمة احتياط فقط: ما يحفظه المشرف في Firestore (boardGames/{slug})
// يغلب عليها، ويمكنه من لوحة الإدارة تعديل أي لعبة هنا أو إخفاؤها أو ربطها
// بدرسها، وإضافة لعبة جديدة بمجرّد وجود مجلدها في public/ — بلا تعديل هنا.
// الدمج والقراءة في src/lib/board-games.ts.
// ---------------------------------------------------------------------------

import type { BoardGame } from '@/lib/types';

export type { BoardGame };

export const BOARD_GAME_SEEDS: BoardGame[] = [
  {
    slug: 'cold-week',
    title: 'أسبوع الزكام',
    summary:
      'يرى الطلاب كيف تُمرض عطسة واحدة الزملاء القريبين يومًا بعد يوم، ثم يحمون صفّهم ثلاثي الأبعاد طوال الأسبوع بوضع الحل الصحيح لكل موقف.',
    subject: 'العلوم',
    context: 'لماذا نُصاب أنا وزملائي بالمرض في أوقات متقاربة؟ (النشاط 1)',
    objectives: [
      'يفسّر أن الجراثيم تنتقل مع رذاذ العطس والسعال إلى القريبين فيمرضون في أوقات متقاربة',
      'يذكر أن الجراثيم تدخل أجسامنا غالبًا من الفم أو الأنف عندما نتنفّس',
      'يختار التغطية بالمرفق لمنع انتشار الرذاذ إن لم يكن معه منديل',
      'يميّز ما يقطع العدوى: المنديل ثم السلة، وغسل اليدين، ومسح الأسطح، والقنينة الخاصة',
    ],
    modes: ['طالب واحد', 'سباق طالبين'],
    players: 'طالب واحد أو الصف كله، أو طالبان في طرفَي السبورة',
    minutes: 8,
    cover: '/cold-week/cover.jpg',
    color: '#1f5f8b',
    added: '2026-10-21',
  },
  {
    slug: 'germ-hunters',
    title: 'صيّادو الجراثيم',
    summary:
      'يكشف الطلاب بالضوء البنفسجي جراثيم خفية، ويصنّفون الأسطح الخشنة والناعمة وما ينشر الجراثيم وما يمنعها بلمس السبورة.',
    subject: 'العلوم',
    context: 'الدرس 3.2: أين توجد الجراثيم؟',
    objectives: [
      'يصف أن الجراثيم قد توجد على أجسامنا وعلى أشياء لا تبدو متّسخة',
      'يوضّح أن الجراثيم لا تُرى بالعين المجرّدة لكنها تتوهّج تحت الأشعة فوق البنفسجية',
      'يستنتج أن الجراثيم تعلق على السطح الخشن كجلدنا أكثر من الناعم',
      'يميّز ما ينشر الجراثيم (العطاس، السعال، الأيدي غير المغسولة) مما يمنع انتشارها',
    ],
    modes: ['سباق فريقين', 'الصف كله'],
    players: 'طالب أو أكثر، أو فريقان في طرفَي السبورة',
    minutes: 8,
    cover: '/germ-hunters/cover.jpg',
    color: '#5b21b6',
    added: '2026-10-21',
  },
  {
    slug: 'under-the-lens',
    title: 'عالَمٌ تحت العدسة',
    summary:
      'يكبّر الطلاب عيّنات غامضة بعدسة مكبّرة ومجهر ثلاثيَّي الأبعاد بلمس السبورة، فتتّضح التفاصيل ويكتشفون ما هي.',
    subject: 'العلوم',
    context: 'ما فائدة العدسة المكبّرة في رؤية الأشياء؟ (العدسة المكبّرة والمجهر)',
    objectives: [
      'يوضّح أن تكبير الشيء يساعدنا على رؤيته بوضوح أكبر',
      'يسمّي أداتَي التكبير: العدسة المكبّرة والمجهر',
      'يتعرّف أشياء مألوفة من صورها المكبّرة',
      'يستنتج أن المجهر يكبّر أكثر من العدسة للأشياء الصغيرة جدًا',
    ],
    modes: ['سباق طالبين', 'الصف كله'],
    players: 'طالبان في طرفَي السبورة أو الصف كله',
    minutes: 7,
    cover: '/under-the-lens/cover.jpg',
    color: '#0f5f5a',
    added: '2026-10-21',
  },
  {
    slug: 'asnan',
    title: 'ركّب الأسنان',
    summary:
      'يركّب الطلاب القواطع والأنياب والضواحك والطواحن في فكّين مجسّمين ثلاثيَّي الأبعاد بلمس السبورة بأيديهم، ويتعرّفون وظيفة كل نوع.',
    subject: 'العلوم',
    context: 'الأسنان وأنواعها ووظائفها',
    objectives: [
      'يميّز أنواع الأسنان الأربعة من شكلها',
      'يحدّد موقع كل نوع في الفكّين وعدده',
      'يربط شكل السن بوظيفته (قطع، تمزيق، سحق، طحن)',
    ],
    modes: ['ركّب الأسنان', 'تعرّف على السن', 'سباق فريقين'],
    players: 'الصف كله أو فريقان',
    minutes: 8,
    cover: '/asnan/cover.jpg',
    color: '#8a1538',
    added: '2026-10-20',
    subjectId: 'science',
    gradeId: 'g3',
    unitId: 'u1',
    lessonId: 'u1-l1',
  },
];
```

## `src/lib/board-games.ts`

```ts
import { BOARD_GAME_SEEDS } from '@/data/board-games';
import type { BoardGame, Subject } from '@/lib/types';
import { BOARD_GAME_META, boardGameLinked } from '@/lib/types';
import { getDb, isFirebaseConfigured } from '@/lib/firebase';

// ---------------------------------------------------------------------------
// خدمة «ألعاب السبورة الذكية» — تعمل في الخادم والمتصفّح معًا.
//
// المصدر مصدران يُدمجان: القائمة المضمّنة (البذرة) في src/data/board-games.ts،
// ووثائق Firestore في المجموعة boardGames/{slug}. وثيقة بمعرّف لعبة مضمّنة
// تُعدّل حقولها (أو تخفيها)، ووثيقة بمعرّف جديد تضيف لعبة لم تكن في الكود —
// بشرط أن يكون مجلدها public/<slug>/ موجودًا في النشر.
//
// الحذف في Firestore يعني: للعبة مضمّنة «استعادة الافتراضي»، وللعبة مضافة
// إزالتها من الموقع. ملفات اللعبة نفسها لا تُمسّ.
// ---------------------------------------------------------------------------

const COLLECTION = 'boardGames';

/** ما يُحفظ في وثيقة اللعبة: كل الحقول اختيارية فوق البذرة (المعرّف هو اسم الوثيقة). */
export type BoardGameDoc = Partial<Omit<BoardGame, 'slug'>>;

/** معرّفات الألعاب المضمّنة في الكود (لا تُحذف، بل تُستعاد). */
export const SEED_BOARD_GAME_SLUGS = new Set(BOARD_GAME_SEEDS.map((g) => g.slug));

/** اسم مجلد صالح: أحرف لاتينية صغيرة وأرقام وشرطات، يبدأ بحرف أو رقم. */
export const BOARD_GAME_SLUG_RE = /^[a-z0-9][a-z0-9-]{1,40}$/;

/** مجلدات في public/ ليست ألعاب سبورة — لا يُقبل أي منها معرّفًا للعبة. */
const RESERVED_SLUGS = new Set(['board-kit', 'games', 'fonts', 'images', 'videos', 'sign', 'naseej', 'qurs', 'sneeze-lab']);
export const isReservedBoardGameSlug = (slug: string) => RESERVED_SLUGS.has(slug);

/** رابط فتح اللعبة (صفحة كاملة، لا داخل إطار: الكاميرا لا تعمل في إطار معزول). */
export const boardGameHref = (g: Pick<BoardGame, 'slug'>) => `/${g.slug}/index.html`;
/** رابط التجربة بالماوس: الماوس يتصرف كيد الطالب. */
export const boardGameTryHref = (g: Pick<BoardGame, 'slug'>) => `${boardGameHref(g)}?sim`;

/** وثائق Firestore كما هي الآن: معرّف ← حقول. فارغة بلا Firebase أو عند أي خطأ. */
export async function fetchBoardGameDocs(): Promise<Record<string, BoardGameDoc>> {
  if (!isFirebaseConfigured) return {};
  const db = getDb();
  if (!db) return {};
  try {
    const { collection, getDocs } = await import('firebase/firestore');
    const snap = await getDocs(collection(db, COLLECTION));
    const out: Record<string, BoardGameDoc> = {};
    for (const d of snap.docs) out[d.id] = d.data() as BoardGameDoc;
    return out;
  } catch {
    return {};
  }
}

/** ترتيب العرض: ما حدّد له المشرف ترتيبًا أولًا (الأصغر أولًا)، ثم الأحدث إضافةً. */
export function sortBoardGames(list: BoardGame[]): BoardGame[] {
  return [...list].sort((a, b) => {
    const ao = a.order ?? Number.POSITIVE_INFINITY;
    const bo = b.order ?? Number.POSITIVE_INFINITY;
    if (ao !== bo) return ao - bo;
    return (b.added || '').localeCompare(a.added || '');
  });
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** تنظيف قيم قادمة من Firestore أو من نموذج الإدارة. */
function lines(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];
}

/**
 * الدمج: البذرة أولًا، ثم وثيقة Firestore بالمعرّف نفسه تغلب حقلًا بحقل
 * (المصفوفات تُستبدل كاملة)، ثم الوثائق التي لا بذرة لها تُضاف كألعاب جديدة
 * إن حملت عنوانًا. تعيد القائمة كاملة بما فيها المخفيّ، مرتّبة.
 */
export function mergeBoardGames(docs: Record<string, BoardGameDoc>): BoardGame[] {
  const out: BoardGame[] = [];
  const seen = new Set<string>();
  for (const seed of BOARD_GAME_SEEDS) {
    seen.add(seed.slug);
    const d = docs[seed.slug];
    out.push(d ? normalize({ ...seed, ...stripUndefined(d), slug: seed.slug }) : { ...seed });
  }
  for (const [slug, d] of Object.entries(docs)) {
    if (seen.has(slug) || !BOARD_GAME_SLUG_RE.test(slug) || isReservedBoardGameSlug(slug)) continue;
    if (!d.title?.trim()) continue;
    out.push(normalize({ slug, ...stripUndefined(d) }));
  }
  return sortBoardGames(out);
}

function stripUndefined<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

/** يملأ الحقول الناقصة بقيم آمنة فلا تنكسر البطاقة بوثيقة ناقصة. */
function normalize(g: Partial<BoardGame> & { slug: string }): BoardGame {
  return {
    slug: g.slug,
    title: String(g.title ?? '').trim() || g.slug,
    summary: String(g.summary ?? '').trim(),
    subject: String(g.subject ?? '').trim(),
    context: g.context ? String(g.context).trim() : undefined,
    objectives: lines(g.objectives),
    modes: lines(g.modes),
    players: String(g.players ?? '').trim(),
    minutes: Number.isFinite(Number(g.minutes)) ? Math.max(0, Math.round(Number(g.minutes))) : 0,
    cover: String(g.cover ?? '').trim() || `/${g.slug}/cover.jpg`,
    color: String(g.color ?? '').trim() || BOARD_GAME_META.color,
    added: String(g.added ?? '').trim() || (g.updatedAt ? new Date(g.updatedAt).toISOString().slice(0, 10) : todayKey()),
    subjectId: g.subjectId || undefined,
    gradeId: g.gradeId || undefined,
    unitId: g.unitId || undefined,
    lessonId: g.lessonId || undefined,
    hidden: Boolean(g.hidden),
    order: typeof g.order === 'number' && Number.isFinite(g.order) ? g.order : undefined,
    updatedAt: typeof g.updatedAt === 'number' ? g.updatedAt : undefined,
  };
}

/** كل الألعاب (بما فيها المخفيّة) مدمجةً ومرتّبة — للإدارة وللمالك. */
export async function getBoardGames(): Promise<BoardGame[]> {
  return mergeBoardGames(await fetchBoardGameDocs());
}

/** الألعاب الظاهرة للزوّار فقط. */
export const visibleBoardGames = (list: BoardGame[]) => list.filter((g) => !g.hidden);

/** الألعاب الظاهرة للزوّار، مدمجةً ومرتّبة. */
export async function getVisibleBoardGames(): Promise<BoardGame[]> {
  return visibleBoardGames(await getBoardGames());
}

/** هل لهذه اللعبة المضمّنة تعديلات محفوظة في Firestore؟ */
export function isOverridden(slug: string, docs: Record<string, BoardGameDoc>): boolean {
  return SEED_BOARD_GAME_SLUGS.has(slug) && slug in docs;
}

// --- الكتابة (المالك ورافع الأنشطة؛ الحماية في firestore.rules) ------------

export async function saveBoardGame(
  slug: string,
  patch: BoardGameDoc,
  /** حقول تُحذف من الوثيقة (مثل ربط الدرس حين يُفكّ). */
  remove: (keyof BoardGameDoc)[] = []
): Promise<void> {
  const db = getDb();
  if (!db) throw new Error('Firebase غير مُعدّ.');
  if (!BOARD_GAME_SLUG_RE.test(slug) || isReservedBoardGameSlug(slug)) throw new Error('معرّف اللعبة غير صالح.');
  // Firestore يرفض أي حقل قيمته undefined فيفشل الحفظ كلّه — أزِلها أولًا
  const clean: Record<string, unknown> = Object.fromEntries(
    Object.entries(patch).filter(([k, v]) => v !== undefined && k !== 'slug')
  );
  const { doc, setDoc, deleteField } = await import('firebase/firestore');
  for (const k of remove) clean[k] = deleteField();
  clean.updatedAt = Date.now();
  await setDoc(doc(db, COLLECTION, slug), clean, { merge: true });
}

/** للعبة مضمّنة: استعادة الافتراضي. للعبة مضافة: إزالتها من الموقع. */
export async function deleteBoardGameDoc(slug: string): Promise<void> {
  const db = getDb();
  if (!db) throw new Error('Firebase غير مُعدّ.');
  const { doc, deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(db, COLLECTION, slug));
}

/** يحفظ ترتيبًا يدويًا للقائمة كاملة (الموضع في المصفوفة = الترتيب). */
export async function saveBoardGamesOrder(slugs: string[]): Promise<void> {
  const db = getDb();
  if (!db) throw new Error('Firebase غير مُعدّ.');
  const { doc, writeBatch } = await import('firebase/firestore');
  const batch = writeBatch(db);
  const now = Date.now();
  slugs.forEach((slug, i) => batch.set(doc(db, COLLECTION, slug), { order: i, updatedAt: now }, { merge: true }));
  await batch.commit();
}

/**
 * يتحقّق (من المتصفّح) أن مجلد اللعبة منشور فعلًا: الملف الرئيسي والغلاف.
 * يعيد أسماء ما لم يُعثر عليه.
 */
export async function checkBoardGameFiles(slug: string, cover?: string): Promise<string[]> {
  const missing: string[] = [];
  const probe = async (url: string, label: string) => {
    try {
      const r = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      if (!r.ok) missing.push(label);
    } catch {
      missing.push(label);
    }
  };
  await Promise.all([
    probe(boardGameHref({ slug }), `/${slug}/index.html`),
    probe(cover || `/${slug}/cover.jpg`, cover || `/${slug}/cover.jpg`),
  ]);
  return missing;
}

// --- موقع اللعبة في شجرة المنهج ----------------------------------------------

export function locateBoardGame(subjects: Subject[], g: BoardGame) {
  if (!boardGameLinked(g)) return { subject: undefined, grade: undefined, unit: undefined, lesson: undefined };
  const subject = subjects.find((s) => s.id === g.subjectId);
  const grade = subject?.grades.find((x) => x.id === g.gradeId);
  const unit = grade?.units.find((x) => x.id === g.unitId);
  const lesson = unit?.lessons.find((x) => x.id === g.lessonId);
  return { subject, grade, unit, lesson };
}

/** سطر السياق فوق البطاقة: المادة • المستوى • الدرس (من الشجرة)، وإلا اسم المادة المكتوب. */
export function boardGameContext(subjects: Subject[], g: BoardGame): { subjectId: string; subjectTitle: string; context: string } {
  const { subject, grade, lesson } = locateBoardGame(subjects, g);
  // لعبة غير مرتبطة بدرس: تُنسب إلى المادة التي يطابق عنوانها اسمها المكتوب،
  // فلا يتكرّر تبويب «العلوم» مرّتين ولا تُعدّ مادة ثانية.
  const byTitle = subject ?? subjects.find((s) => s.title.trim() === (g.subject || '').trim());
  return {
    subjectId: byTitle?.id ?? `__${g.subject || 'other'}`,
    subjectTitle: byTitle?.title ?? g.subject ?? '',
    context: [grade?.title, lesson?.title].filter(Boolean).join(' • '),
  };
}

/** يُلحق الألعاب الظاهرة المرتبطة بدروسها في شجرة المنهج (lesson.boardGames). */
export function attachBoardGames(subjects: Subject[], games: BoardGame[]): void {
  for (const g of games) {
    if (g.hidden || !boardGameLinked(g)) continue;
    const { lesson } = locateBoardGame(subjects, g);
    if (!lesson) continue;
    const list = (lesson.boardGames ??= []);
    if (!list.some((x) => x.slug === g.slug)) list.push(g);
  }
}
```
