// ---------------------------------------------------------------------------
// إعدادات الجهاز: تُحفظ في متصفّح الجهاز (localStorage) وتشترك فيها كل ألعاب
// السبورة على الموقع نفسه — فالمعايرة تُجرى مرة واحدة للصف وتصلح لكل لعبة ما
// دام الحامل في مكانه. كل قراءة وكتابة محميّة لأن التخزين قد يكون معطّلًا
// (التصفّح الخاص)؛ عندها تعمل اللعبة بالقيم الافتراضية.
// ---------------------------------------------------------------------------

const KEY = 'board-kit.settings.v1';
/** مفاتيح ألعاب قديمة كانت تحفظ إعداداتها وحدها: تُنقل مرة واحدة. */
const LEGACY_KEYS = ['asnan.settings.v1'];

export const DEFAULTS = {
  dwellMs: 700, // مدة إبقاء اليد لالتقاط عنصر أو إسقاطه
  handPoint: 'palm', // palm = منتصف الكف، finger = طرف السبابة
  reachTop: 0, // نسبة أعلى الشاشة المحجوزة للعناوين فقط (0..0.45) حين لا يصل الطلاب للأعلى
  sideInset: 0, // هامش جانبي (0..0.2 من العرض) يُبعد البطاقات عن طرفي الصورة
  trackQuality: 'max', // normal | high | max: تكبير منطقة السبورة لأيدي الأطفال الصغيرة (تنخفض تلقائيًا للأجهزة البطيئة)
  sound: true,
  speech: true,
  showHands: true, // إظهار مؤشر اليد على الجدار
  cameraId: '', // آخر كاميرا اختيرت
  calibration: null, // { cam: [{x,y}×4] مطبّعة, screen: [{x,y}×4] مطبّعة, H, at, error }
};

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function loadSettings() {
  let saved = read(KEY);
  if (!saved) {
    for (const k of LEGACY_KEYS) {
      saved = read(k);
      if (saved) break;
    }
  }
  return { ...DEFAULTS, ...(saved || {}) };
}

export function saveSettings(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* التخزين غير متاح: تبقى الإعدادات لهذه الجلسة فقط */
  }
}
