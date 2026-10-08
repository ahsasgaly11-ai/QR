// ---------------------------------------------------------------------------
// «لآلئي»: مكافأة بسيطة من تراث الغوص. يحصل الطالب على لؤلؤة عن كل نشاط
// يجرّبه دقيقة كاملة (مرّة واحدة لكل نشاط)، وترتفع رتبته من «غيص مبتدئ» إلى
// «طوّاش اللؤلؤ». تُحفظ في هذا المتصفّح وحده: لا حساب ولا بيانات شخصية.
// ---------------------------------------------------------------------------

const KEY = 'qa-pearls-v1';
export const PEARL_EVENT = 'qa-pearls';
/** كم ثانية من التجربة الفعلية (والصفحة ظاهرة) تمنح اللؤلؤة. */
export const PEARL_SECONDS = 60;

export const RANKS = [
  { min: 0, title: 'بحّار جديد', hint: 'جرّب نشاطًا دقيقة كاملة لتحصل على أول لؤلؤة' },
  { min: 1, title: 'غيص مبتدئ', hint: 'أول لؤلؤة في الصندوق!' },
  { min: 5, title: 'غيص ماهر', hint: 'تغوص أعمق في كل درس' },
  { min: 12, title: 'نوخذة', hint: 'قائد السفينة يعرف طريقه' },
  { min: 25, title: 'طوّاش اللؤلؤ', hint: 'خبير يعرف قيمة كل لؤلؤة' },
] as const;

type Store = { earned: Record<string, number> };

function read(): Store {
  if (typeof window === 'undefined') return { earned: {} };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Store;
      if (s && typeof s.earned === 'object') return s;
    }
  } catch {
    /* ignore */
  }
  return { earned: {} };
}

export function pearlCount(): number {
  return Object.keys(read().earned).length;
}

export function hasPearl(activityId: string): boolean {
  return activityId in read().earned;
}

export function rankFor(n: number) {
  let i = 0;
  for (let k = 0; k < RANKS.length; k++) if (n >= RANKS[k].min) i = k;
  return { ...RANKS[i], index: i, next: RANKS[i + 1] ?? null };
}

/** يمنح لؤلؤة عن النشاط إن لم تُمنح من قبل. يُعيد true عند منح لؤلؤة جديدة. */
export function awardPearl(activityId: string, title: string): boolean {
  const s = read();
  if (activityId in s.earned) return false;
  const before = rankFor(Object.keys(s.earned).length);
  s.earned[activityId] = Date.now();
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    return false;
  }
  const total = Object.keys(s.earned).length;
  const after = rankFor(total);
  window.dispatchEvent(
    new CustomEvent(PEARL_EVENT, {
      detail: { total, title, rankUp: after.index > before.index ? after.title : null },
    })
  );
  return true;
}

export function onPearls(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb();
  };
  window.addEventListener(PEARL_EVENT, cb);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(PEARL_EVENT, cb);
    window.removeEventListener('storage', onStorage);
  };
}
