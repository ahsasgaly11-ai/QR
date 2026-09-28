import type { Activity, Subject } from '@/lib/types';

// ---------------------------------------------------------------------------
// وضع العرض المحلي (Local preview store)
//
// عند عدم إعداد Firebase، تُحفَظ الأنشطة المرفوعة داخل متصفّح المستخدم:
//   • ملف الـ HTML نفسه في IndexedDB (يتحمّل ملفات بحجم عدة ميجابايت)
//   • بنية المناهج المعدّلة (وحدات/دروس جديدة) في localStorage
// هذا يجعل النشاط قابلًا للتشغيل والتحميل فورًا بعد الرفع — لكنه يبقى
// داخل هذا المتصفّح فقط إلى أن يُفعَّل Firebase للمشاركة مع الزوّار.
// ---------------------------------------------------------------------------

const DB_NAME = 'qa-curriculum';
const STORE = 'activities';
const PREVIEW_STORE = 'previews';
const DB_VERSION = 2;
const STRUCTURE_KEY = 'qa-local-structure-v1';

export interface LocalRecord {
  id: string;
  activity: Activity;
  html: string;
  savedAt: number;
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
      return resolve(null);
    }
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(PREVIEW_STORE)) {
          db.createObjectStore(PREVIEW_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
  storeName: string = STORE
): Promise<T | null> {
  return new Promise(async (resolve) => {
    const db = await openDb();
    if (!db) return resolve(null);
    try {
      const t = db.transaction(storeName, mode);
      const req = run(t.objectStore(storeName));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** يحفظ نشاطًا مرفوعًا مع محتوى ملف الـ HTML داخل المتصفّح. */
export async function saveLocalActivity(
  activity: Activity,
  html: string
): Promise<boolean> {
  const rec: LocalRecord = { id: activity.id, activity, html, savedAt: Date.now() };
  const res = await tx('readwrite', (s) => s.put(rec) as IDBRequest<IDBValidKey>);
  return res !== null;
}

export async function getLocalRecord(id: string): Promise<LocalRecord | null> {
  const res = await tx<LocalRecord>('readonly', (s) => s.get(id));
  return res ?? null;
}

export async function listLocalActivities(): Promise<Activity[]> {
  const res = await tx<LocalRecord[]>('readonly', (s) => s.getAll());
  if (!res) return [];
  return res
    .filter((r) => r && r.activity)
    .sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0))
    .map((r) => ({ ...r.activity, local: true }));
}

export async function deleteLocalActivity(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id) as unknown as IDBRequest<undefined>);
}

/** ينشئ رابط Blob لتشغيل/تحميل النشاط المخزّن محليًا. */
export function htmlToBlobUrl(html: string): string {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  return URL.createObjectURL(blob);
}

// ---------------------------------------------------------------------------
// عزل الألعاب المرفوعة.
//
// رابط Blob يرث أصل (origin) الموقع نفسه، فلو شُغِّل داخل iframe بصلاحية
// allow-same-origin لاستطاع كود اللعبة الوصول إلى جلسة دخول المشرف وبيانات
// الموقع. لذا تُشغَّل بلا هذه الصلاحية (أصل معزول)، وهنا يرمي المتصفح خطأً
// عند لمس localStorage/sessionStorage — فتُحقن بديلة في الذاكرة حتى لا
// تتعطّل الألعاب التي تحفظ تقدّمها أو إعداداتها.
// ---------------------------------------------------------------------------

/** صلاحيات iframe للألعاب المرفوعة (بلا allow-same-origin عمدًا). */
export const GAME_SANDBOX =
  'allow-scripts allow-popups allow-downloads allow-forms allow-modals';

const STORAGE_SHIM = `<script>(function(){function mk(){var d={};return{getItem:function(k){k=String(k);return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null},setItem:function(k,v){d[String(k)]=String(v)},removeItem:function(k){delete d[String(k)]},clear:function(){d={}},key:function(i){var ks=Object.keys(d);return i<ks.length?ks[i]:null},get length(){return Object.keys(d).length}}}['localStorage','sessionStorage'].forEach(function(n){try{window[n].length}catch(e){try{Object.defineProperty(window,n,{value:mk(),configurable:true})}catch(_){}}})})();</script>`;

// ---------------------------------------------------------------------------
// جسر ملء الشاشة.
//
// كثير من الألعاب فيها زرّ «ملء الشاشة» خاص بها، والموقع له زرّه أيضًا.
// اجتماع الاثنين كان يُنتج ملء شاشة متداخلًا يعلق فيه الزائر بلا طريقة
// للخروج، خصوصًا على iPad. لذا لا يُترك للّعبة ملء شاشة أصلي، بل يُحاكى:
//   • زرّ اللعبة يكبّر العنصر الذي تختاره (مثل مسرح النموذج) ليملأ إطارها،
//     ويطلب من الموقع وضع العرض الكامل إن لم يكن مفعّلًا فيملأ الإطار الشاشة.
//   • fullscreenElement يعكس تكبير اللعبة وحده، فلا تظنّ اللعبة أنها في ملء
//     الشاشة لمجرّد أن الموقع فعّل وضعه (وإلا صار ضغط زرّها «خروجًا»).
//   • الخروج من اللعبة يُعيد العنصر، ولا يُغلق وضع الموقع إلا إن كانت اللعبة
//     هي من فتحته. وزرّ «خروج» الموقع يُنهي الاثنين معًا.
// ---------------------------------------------------------------------------

/** مفاتيح رسائل جسر ملء الشاشة بين اللعبة والموقع. */
export const FS_REQUEST_KEY = '__qaFs';
export const FS_STATE_KEY = '__qaFsState';

const FULLSCREEN_SHIM_JS = `(function(){
var P=window.parent;if(!P||P===window)return;
var D=document,el=null,siteOn=false,A='data-qa-fs';
function send(a){try{P.postMessage({${FS_REQUEST_KEY}:a},'*')}catch(e){}}
function def(o,n,d){try{Object.defineProperty(o,n,d)}catch(e){}}
function css(){if(D.getElementById('qa-fs-style'))return;var s=D.createElement('style');s.id='qa-fs-style';
s.textContent='['+A+']{position:fixed!important;inset:0!important;left:0!important;top:0!important;right:0!important;bottom:0!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;margin:0!important;border-radius:0!important;transform:none!important;z-index:2147483646!important;box-sizing:border-box!important}';
(D.head||D.documentElement).appendChild(s)}
function changed(t){try{(t&&t.isConnected?t:D).dispatchEvent(new Event('fullscreenchange',{bubbles:true}));(t&&t.isConnected?t:D).dispatchEvent(new Event('webkitfullscreenchange',{bubbles:true}))}catch(e){}
setTimeout(function(){try{window.dispatchEvent(new Event('resize'))}catch(e){}},60)}
function set(t){var old=el;if(old===t)return;if(old)old.removeAttribute(A);el=t;
if(t&&t!==D.documentElement&&t!==D.body){css();t.setAttribute(A,'')}changed(t||old)}
function req(){var t=this instanceof Element?this:D.documentElement;set(t);send('enter');return Promise.resolve()}
function ext(){if(!el)return Promise.resolve();set(null);send('exit');return Promise.resolve()}
['requestFullscreen','webkitRequestFullscreen','webkitRequestFullScreen','mozRequestFullScreen','msRequestFullscreen'].forEach(function(n){def(Element.prototype,n,{value:req,configurable:true,writable:true})});
['exitFullscreen','webkitExitFullscreen','webkitCancelFullScreen','mozCancelFullScreen','msExitFullscreen'].forEach(function(n){def(Document.prototype,n,{value:ext,configurable:true,writable:true})});
['fullscreenElement','webkitFullscreenElement','webkitCurrentFullScreenElement','mozFullScreenElement','msFullscreenElement'].forEach(function(n){def(Document.prototype,n,{get:function(){return el},configurable:true})});
['fullscreenEnabled','webkitFullscreenEnabled','mozFullScreenEnabled','msFullscreenEnabled'].forEach(function(n){def(Document.prototype,n,{get:function(){return true},configurable:true})});
['fullscreen','webkitIsFullScreen','mozFullScreen'].forEach(function(n){def(Document.prototype,n,{get:function(){return !!el},configurable:true})});
window.addEventListener('message',function(e){if(e.source!==P)return;var d=e.data;if(!d||typeof d.${FS_STATE_KEY}!=='boolean')return;
siteOn=d.${FS_STATE_KEY};if(!siteOn&&el)set(null)});
window.addEventListener('keydown',function(e){if(e.key!=='Escape')return;if(el)ext();else if(siteOn)send('escape')},true);
})();`;

const FULLSCREEN_SHIM = `<script>${FULLSCREEN_SHIM_JS}</script>`;

/** يحقن بديل التخزين وجسر ملء الشاشة في بداية المستند قبل أي سكربت للعبة. */
export function withStorageShim(html: string): string {
  const shims = STORAGE_SHIM + FULLSCREEN_SHIM;
  const m = /<head[^>]*>/i.exec(html);
  if (m) return html.slice(0, m.index + m[0].length) + shims + html.slice(m.index + m[0].length);
  return shims + html;
}

/** رابط Blob مُعدّ للتشغيل داخل iframe معزول (GAME_SANDBOX). */
export function htmlToFrameUrl(html: string): string {
  return htmlToBlobUrl(withStorageShim(html));
}

// --- بنية المناهج المحلّية (وحدات/دروس أُنشئت في وضع العرض) ----------------

export function getLocalStructure(): Subject[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STRUCTURE_KEY);
    return raw ? (JSON.parse(raw) as Subject[]) : null;
  } catch {
    return null;
  }
}

export function saveLocalStructure(subjects: Subject[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STRUCTURE_KEY, JSON.stringify(subjects));
  } catch {
    /* تجاهل (قد تمتلئ المساحة) */
  }
}

/**
 * يدمج الأنشطة المحلية (وبنية محلية إن وُجدت) في شجرة مادة قادمة من الخادم،
 * ويعيد نسخة جديدة دون المساس بالأصل.
 */
export function mergeLocalIntoSubject(
  subject: Subject,
  localStructure: Subject[] | null,
  localActivities: Activity[]
): Subject {
  const base =
    localStructure?.find((s) => s.id === subject.id) ?? subject;
  const merged = JSON.parse(JSON.stringify(base)) as Subject;

  for (const a of localActivities) {
    if (a.subjectId !== merged.id) continue;
    const grade = merged.grades.find((g) => g.id === a.gradeId);
    const unit = grade?.units.find((u) => u.id === a.unitId);
    const lesson = unit?.lessons.find((l) => l.id === a.lessonId);
    if (lesson && !lesson.activities.some((x) => x.id === a.id)) {
      lesson.activities.push(a);
    }
  }
  return merged;
}

// --- ذاكرة معاينات البطاقات ------------------------------------------------
//
// نسخة المعاينة لا تتغيّر بعد إنشائها، فلا داعي لتحميلها من الشبكة في كل
// زيارة. تُحفَظ هنا فتُفتح صفحة الدرس في المرّات التالية بلا انتظار.

interface CachedPreview {
  id: string;
  html: string;
  at: number;
  /** نسخة مولّد المعاينة — تُبطِل الذاكرة تلقائيًا عند تحسين المولّد */
  v?: number;
}

export async function getCachedPreview(
  id: string,
  version?: number
): Promise<string | null> {
  const rec = await tx<CachedPreview>(
    'readonly',
    (s) => s.get(id),
    PREVIEW_STORE
  );
  if (!rec) return null;
  // معاينة بُنيت بنسخة أقدم: تجاهلها وأعد تحميلها من الخادم
  if (version !== undefined && rec.v !== version) return null;
  return rec.html ?? null;
}

export async function putCachedPreview(
  id: string,
  html: string,
  version?: number
): Promise<void> {
  await tx(
    'readwrite',
    (s) =>
      s.put({ id, html, at: Date.now(), v: version }) as IDBRequest<IDBValidKey>,
    PREVIEW_STORE
  );
}

/** تُستدعى عند تعديل نشاط أو حذفه حتى لا تبقى معاينة قديمة. */
export async function dropCachedPreview(id: string): Promise<void> {
  await tx(
    'readwrite',
    (s) => s.delete(id) as unknown as IDBRequest<undefined>,
    PREVIEW_STORE
  );
}
