// ---------------------------------------------------------------------------
// الإعدادات والمعايرة: تُحفظ في متصفّح الآيباد نفسه (localStorage)، فتبقى
// المعايرة صالحة ما دام الحامل في مكانه. كل قراءة وكتابة محميّة لأن التخزين قد
// يكون معطّلًا (التصفّح الخاص) — عندها تعمل اللعبة بالقيم الافتراضية.
// ---------------------------------------------------------------------------

const KEY = 'asnan.settings.v1';

export const DEFAULTS = {
  dwellMs: 700, // مدة إبقاء اليد لالتقاط سن أو إسقاطه
  handPoint: 'palm', // palm = منتصف الكف، finger = طرف السبابة
  reachTop: 0, // نسبة أعلى الشاشة المحجوزة للعناوين فقط (0..0.45) حين لا يصل الطلاب للأعلى
  sound: true,
  speech: true,
  showHands: true, // إظهار مؤشر اليد على الجدار
  cameraId: '', // آخر كاميرا اختيرت
  calibration: null, // { cam: [{x,y}×4] مطبّعة, screen: [{x,y}×4] مطبّعة, H, at, error }
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const saved = JSON.parse(raw);
    return { ...DEFAULTS, ...saved };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* التخزين غير متاح: تبقى الإعدادات لهذه الجلسة فقط */
  }
}
