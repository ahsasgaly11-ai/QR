// ---------------------------------------------------------------------------
// «الفأرة اليدوية»: تحويل حركة الأيدي على السبورة إلى نقرات وسحب لأي لعبة HTML
// لا تعرف شيئًا عن الكاميرا. دوال صافية بلا DOM (تُختبر بـ node --test).
//
// الكاميرا لا تعرف هل لامست اليد السبورة، فالنيّة تُستدلّ من «البقاء»:
//   • تحوم اليد ← حركة مؤشر (hover) فتضيء اللعبة ما تحتها إن كانت تدعم ذلك.
//   • تبقى اليد ثابتة مدة البقاء ← ضغطة.
//     - وضع «نقر»: ضغط ثم رفع ثم نقرة فورًا (يناسب ألعاب الاختيار والنقر).
//     - وضع «نقر وسحب»: ضغط ويبقى مضغوطًا؛ إن تحرّكت اليد فهو سحب، وحين تثبت
//       ثانيةً مدةً أقصر يُرفع (إفلات). إن لم تتحرّك إطلاقًا فهي نقرة.
//   • بعد النقرة لا تتكرّر حتى تغادر اليد الموضع (consumed).
//   • اختفت اليد وهي ضاغطة ← رفع في آخر موضع (إلغاء آمن).
//
// الإحداثيات بالبكسل داخل إطار اللعبة؛ والأحداث الناتجة يرسلها hand-mouse.js
// إلى جسر داخل اللعبة (HAND_SHIM في local-store.ts) يبثّها أحداث مؤشر حقيقية.
// ---------------------------------------------------------------------------

/** نصف قطر «الثبات» بالبكسل: حركة أقل منه لا تُعدّ حركة (ارتجاف اليد). */
export const STILL_PX = 22;
/** حركة أبعد من هذا أثناء الضغط = سحب لا نقرة. */
export const DRAG_PX = 34;

export class HandGestures {
  /**
   * @param {{dwellMs:()=>number, mode:()=>'tap'|'drag', lostMs?:number}} o
   */
  constructor({ dwellMs, mode, lostMs = 900 }) {
    this.dwellMs = dwellMs;
    this.mode = mode;
    this.lostMs = lostMs;
    /** @type {Map<number, any>} */
    this.hands = new Map();
  }

  /**
   * تحديث من المتتبّع: مواضع الأيدي الحالية (بالبكسل داخل الإطار؛ null = خارج الإطار).
   * @param {{id:number, x:number, y:number, inside:boolean}[]} hands
   * @param {number} now
   * @returns {{type:'move'|'down'|'up'|'click', id:number, x:number, y:number}[]} الأحداث المطلوب بثّها بالترتيب
   */
  update(hands, now) {
    const out = [];
    const seen = new Set();
    for (const h of hands) {
      seen.add(h.id);
      let s = this.hands.get(h.id);
      if (!s) {
        s = { id: h.id, x: h.x, y: h.y, ax: h.x, ay: h.y, anchorT: now, seen: now, down: false, downX: 0, downY: 0, moved: false, consumed: false, progress: 0, inside: h.inside };
        this.hands.set(h.id, s);
      }
      s.seen = now;
      s.x = h.x;
      s.y = h.y;
      s.inside = h.inside;
      const d = Math.hypot(h.x - s.ax, h.y - s.ay);
      if (d > STILL_PX) {
        // تحرّكت: مرساة جديدة، ولا نقرة حتى تثبت من جديد
        s.ax = h.x;
        s.ay = h.y;
        s.anchorT = now;
        s.consumed = false;
        if (s.down) s.moved = s.moved || Math.hypot(h.x - s.downX, h.y - s.downY) > DRAG_PX;
      }
      if (!h.inside) {
        // خارج الإطار: لا بقاء، وإن كانت ضاغطة تبقى ضاغطة حتى تعود أو تُفقد
        s.progress = 0;
        if (s.down) out.push({ type: 'move', id: s.id, x: h.x, y: h.y });
        continue;
      }
      out.push({ type: 'move', id: s.id, x: h.x, y: h.y });
      const still = now - s.anchorT;
      if (!s.down) {
        if (s.consumed) {
          s.progress = 0;
          continue;
        }
        const need = this.dwellMs();
        s.progress = Math.min(1, still / need);
        if (still >= need) {
          s.progress = 0;
          s.consumed = true;
          s.down = true;
          s.downX = h.x;
          s.downY = h.y;
          s.moved = false;
          out.push({ type: 'down', id: s.id, x: h.x, y: h.y });
          if (this.mode() === 'tap') {
            s.down = false;
            out.push({ type: 'up', id: s.id, x: h.x, y: h.y }, { type: 'click', id: s.id, x: h.x, y: h.y });
          }
        }
      } else {
        // ضاغطة (وضع السحب): الثبات القصير بعد الحركة = إفلات؛ وبلا حركة إطلاقًا = نقرة
        const need = Math.max(250, this.dwellMs() * 0.7);
        s.progress = s.moved ? Math.min(1, still / need) : 0;
        if (s.moved && still >= need) {
          s.down = false;
          s.progress = 0;
          s.consumed = true;
          out.push({ type: 'up', id: s.id, x: h.x, y: h.y });
        } else if (!s.moved && still >= this.dwellMs() * 1.6) {
          // بقيت ثابتة طويلًا بعد الضغط ولم تسحب: نقرة في مكانها
          s.down = false;
          s.progress = 0;
          s.consumed = true;
          out.push({ type: 'up', id: s.id, x: h.x, y: h.y }, { type: 'click', id: s.id, x: h.x, y: h.y });
        }
      }
    }
    // الأيدي المفقودة
    for (const [id, s] of this.hands) {
      if (seen.has(id)) continue;
      if (now - s.seen > this.lostMs) {
        if (s.down) out.push({ type: 'up', id, x: s.x, y: s.y });
        out.push({ type: 'leave', id, x: s.x, y: s.y });
        this.hands.delete(id);
      }
    }
    return out;
  }

  /** حالة الرسم لكل يد: الموضع ونسبة امتلاء الحلقة وهل هي ضاغطة. */
  cursors() {
    return [...this.hands.values()].map((s) => ({ id: s.id, x: s.x, y: s.y, progress: s.progress, down: s.down, inside: s.inside }));
  }

  reset() {
    const out = [];
    for (const [id, s] of this.hands) if (s.down) out.push({ type: 'up', id, x: s.x, y: s.y });
    this.hands.clear();
    return out;
  }
}
