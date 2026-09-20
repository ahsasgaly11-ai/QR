// ---------------------------------------------------------------------------
// أوضاع اليد (Handshapes) — بيانات تحرّك الشخصية الافتراضية.
//
// بوّابة الاعتماد (مهمّة): لا يُعرَض أي وضع حرف للطلبة إلا إذا كان verified=true.
// أوضاع الحروف هنا **مسودّات غير معتمدة** (تقريبية) للعرض في «وضع المراجعة» فقط،
// كي يراجعها مترجم لغة إشارة معتمد ويصحّحها ثم يعتمدها. هذا يمنع وصول إشارة
// خاطئة إلى الطالب الأصمّ، ويجعل الشخصية «تؤدّي» الإشارة من بيانات لا من تلفيق.
//
// الإيماءات العامّة (GESTURES) ليست حروفًا — هي تعبيرات (كفّ مفتوح، إشارة،
// قبضة) يؤدّيها المرشد للترحيب/التوجيه، فتُعرَض دائمًا.
// ---------------------------------------------------------------------------

export interface HandPose {
  /** انبساط الأصابع الأربعة: سبّابة، وسطى، بنصر، خنصر (0 مطويّ .. 1 ممدود). */
  fingers: [number, number, number, number];
  /** الإبهام: 0 مطويّ .. 1 ممدود جانبًا. */
  thumb?: number;
  /** دوران الكفّ بالدرجات. */
  rot?: number;
  /** انعكاس أفقي (كفّ لليد الأخرى/اتّجاه آخر). */
  flip?: boolean;
  /** تسمية للقارئ الآلي. */
  label?: string;
}

export interface HandshapeEntry {
  pose: HandPose;
  /** بوّابة الاعتماد: true فقط بعد مراجعة مترجم معتمد. */
  verified: boolean;
  /** ملاحظة للمترجم أثناء المراجعة. */
  note?: string;
}

// إيماءات عامّة (ليست حروفًا) — يؤدّيها المرشد دائمًا.
export const GESTURES: Record<string, HandPose> = {
  open: { fingers: [1, 1, 1, 1], thumb: 1, label: 'كفّ مفتوح' },
  point: { fingers: [1, 0, 0, 0], thumb: 0, label: 'إشارة' },
  fist: { fingers: [0, 0, 0, 0], thumb: 0, label: 'قبضة' },
  thumbUp: { fingers: [0, 0, 0, 0], thumb: 1, rot: -8, label: 'إبهام لأعلى' },
};

// ---------------------------------------------------------------------------
// قاموس أوضاع الحروف — كلّها مسودّات غير معتمدة (verified:false).
// ⚠️ هذه أشكال تقريبية للعرض في وضع المراجعة فقط، ليست لغة إشارة صحيحة بعد.
// المترجم المعتمد يصحّح الأرقام ويضبط verified:true لكلٍّ بعد اعتماده — عندها
// فقط يراها الطلبة. تُضاف بقيّة الحروف بالبنية نفسها.
// ---------------------------------------------------------------------------
const DRAFT = 'مسودّة غير معتمدة — بحاجة لمراجعة مترجم معتمد قبل الاعتماد';

export const LETTERS: Record<string, HandshapeEntry> = {
  ا: { pose: { fingers: [0, 0, 0, 0], thumb: 1, label: 'ألف' }, verified: false, note: DRAFT },
  ب: { pose: { fingers: [1, 0, 0, 0], thumb: 0, label: 'باء' }, verified: false, note: DRAFT },
  ت: { pose: { fingers: [1, 1, 0, 0], thumb: 0, label: 'تاء' }, verified: false, note: DRAFT },
  ث: { pose: { fingers: [1, 1, 1, 0], thumb: 0, label: 'ثاء' }, verified: false, note: DRAFT },
  ل: { pose: { fingers: [1, 0, 0, 0], thumb: 1, label: 'لام' }, verified: false, note: DRAFT },
  و: { pose: { fingers: [0, 0, 0, 1], thumb: 1, label: 'واو' }, verified: false, note: DRAFT },
};

/** هل «وضع المراجعة» مُفعَّل؟ (للمترجم فقط — يكشف المسودّات غير المعتمدة). */
export function isSignReviewMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const q = new URLSearchParams(window.location.search).get('sign-review');
    if (q === '1') {
      localStorage.setItem('qa-sign-review', '1');
      return true;
    }
    if (q === '0') {
      localStorage.removeItem('qa-sign-review');
      return false;
    }
    return localStorage.getItem('qa-sign-review') === '1';
  } catch {
    return false;
  }
}

/**
 * يعيد وضع اليد لحرف إن وُجد — الموثّق فقط للطلبة، أو المسودّات أيضًا في وضع
 * المراجعة. يعيد null فيتراجع المُشغّل بلطف إلى عرض الحرف نصًّا.
 */
export function getLetterHandshape(
  letter: string,
  includeUnverified: boolean
): HandshapeEntry | null {
  const e = LETTERS[letter];
  if (!e) return null;
  if (e.verified || includeUnverified) return e;
  return null;
}
