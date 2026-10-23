// ---------------------------------------------------------------------------
// محرّك التفاعل: يوحّد ثلاثة مصادر للمؤشرات في منطق واحد:
//   • يد الطالب على السبورة (من الكاميرا): «اللمس بالبقاء» — تبقى اليد على
//     الهدف مدة قصيرة فتمتلئ حلقة حولها ثم يُنفَّذ الفعل. الكاميرا لا تعرف هل
//     لامست اليد السبورة أم اقتربت منها، فالبقاء هو ما يميّز النية عن المرور.
//   • لمس شاشة الجهاز أو الماوس: فوري (ضغط، سحب، إفلات).
//   • محاكاة اليد بالماوس (للتجربة دون كاميرا): الماوس يتصرف كيد بالضبط.
//
// السن «المركون»: إن اختفت اليد الحاملة لسنّ (حجبها جسم الطفل أو صغرت عن
// الكاميرا) لا يعود السن فورًا؛ يبقى مكانه بضع ثوانٍ مع دائرة نابضة، وأول يد
// تظهر قربه تلتقطه وتكمل السحب.
//
// اللعبة تعرّف «الأهداف» (بطاقات، أزرار، خانات)، والمحرّك يقرر أي هدف تحت كل
// مؤشر ومتى يُنفَّذ، ثم يستدعي game.press / game.drop / game.cancel.
// ---------------------------------------------------------------------------
import { TRACK_TTL_MS } from './tracker.js';

const NS = 'http://www.w3.org/2000/svg';
const RING_R = 30;
const RING_LEN = 2 * Math.PI * RING_R;
const HAND_COLORS = ['#8a1538', '#1d4ed8', '#047857', '#b45309', '#7c3aed', '#be185d'];
/** بعد هذه المدة بلا رؤية يُعدّ السن المحمول «مركونًا». */
const PARK_AFTER_MS = 250;
/** أقصى مدة يبقى فيها السن مركونًا قبل أن يعود إلى بطاقته. */
export const PARK_MS = 4000;
/** نطاق التقاط السن المركون (بوحدات المسرح u)، ويتّسع مع الوقت. */
const ADOPT_R0 = 150;
const ADOPT_R1 = 330;

function svgEl(tag, attrs = {}) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}

export class Interaction {
  /**
   * @param {{stage: HTMLElement, game: any, getDwellMs: ()=>number, getShowHands: ()=>boolean}} o
   */
  constructor({ stage, game, getDwellMs, getShowHands }) {
    this.stage = stage;
    this.game = game;
    this.getDwellMs = getDwellMs;
    this.getShowHands = getShowHands;
    /** @type {Map<string, any>} */
    this.cursors = new Map();
    this.layer = null;
    this.hovered = new Set();
    this.sim = false; // محاكاة اليد بالماوس
    this.simPos = null;
    this._colorIdx = 0;
    this._bindPointer();
  }

  /** يُستدعى بعد كل إعادة رسم للعبة: طبقة المؤشرات فوق كل شيء. */
  attachLayer(layer) {
    this.layer = layer;
    for (const c of this.cursors.values()) c.g = null;
  }

  // ---------------------------------------------------------------- الأيدي
  /**
   * @param {{id:number,x:number,y:number}[]} hands إحداثيات مطبّعة على نافذة الصفحة كلها
   * (المعايرة تُرسم على النافذة، والمسرح قد يصغر عنها بحواف الشاشة الآمنة في الهواتف).
   */
  updateHands(hands, t) {
    const { VW, VH } = this.game;
    const r = this.stage.getBoundingClientRect();
    for (const h of hands) {
      const key = `h${h.id}`;
      let c = this.cursors.get(key);
      if (!c) {
        c = this._newCursor(key, 'hand');
        this.cursors.set(key, c);
      }
      // يُحصر المؤشر داخل المسرح: كف عند الحافة الطرفية يبقى فوق البطاقة الطرفية
      const x = Math.max(0, Math.min(VW, ((h.x * innerWidth - r.left) / r.width) * VW));
      const y = Math.max(0, Math.min(VH, ((h.y * innerHeight - r.top) / r.height) * VH));
      // أول ظهور (أو عودة بعد غياب): قفزة مباشرة؛ وإلا هدف ينزلق إليه المؤشر كل إطار شاشة
      const gap = t - c.seen;
      if (c.tx === undefined || gap > 400) {
        c.x = x;
        c.y = y;
      }
      c.tx = x;
      c.ty = y;
      c.seen = t;
      if (c.parked) c.parked = false;
    }
  }

  /**
   * انزلاق المؤشر نحو هدفه بمعدل الشاشة (٦٠ إطارًا/ث) بين إطارات الكاميرا (١٥–٣٠/ث):
   * حركة ناعمة بلا قفزات، وثابت زمن قصير (٣٥ م.ث) فلا يُضاف تأخير يُذكر.
   */
  _glide(c, now) {
    if (c.tx === undefined || c.parked) return;
    const dt = Math.min(100, now - (c.glideAt || now));
    c.glideAt = now;
    const k = 1 - Math.exp(-dt / 35);
    c.x += (c.tx - c.x) * k;
    c.y += (c.ty - c.y) * k;
  }

  _newCursor(key, source) {
    return {
      key,
      source,
      x: 0,
      y: 0,
      seen: performance.now(),
      holding: null,
      team: null, // فريق السن المحمول: لا يوضع إلا في فك فريقه
      born: performance.now(),
      parked: false,
      dwellId: null,
      dwellStart: 0,
      consumed: null, // آخر هدف نُفّذ عليه فعل؛ لا يتكرر حتى تغادره اليد
      progress: 0,
      color: HAND_COLORS[this._colorIdx++ % HAND_COLORS.length],
      g: null,
    };
  }

  // ---------------------------------------------------------------- الأهداف
  /** المسافة إلى الهدف (0 داخل المستطيل)، أو Infinity خارجه. `grow` يوسّع الهدف (لليد ولثبات البقاء). */
  _hit(t, x, y, grow = 0) {
    if (t.rect) {
      const { x: rx, y: ry, w, h } = t.rect;
      const pad = (t.pad ?? 12) + grow;
      const dx = Math.max(rx - pad - x, 0, x - (rx + w + pad));
      const dy = Math.max(ry - pad - y, 0, y - (ry + h + pad));
      return dx === 0 && dy === 0 ? 0 : Infinity;
    }
    const d = Math.hypot(t.x - x, t.y - y);
    return d <= t.r * (1 + grow / 60) ? d : Infinity;
  }

  /**
   * هل يقبل الهدف ما تحمله اليد؟ للخانة أن تعرّف accepts(c) بنفسها، وإلا فخانة لها
   * فريق (team) لا تقبل إلا ما التُقط من بطاقات الفريق نفسه.
   */
  _accepts(c, t) {
    if (t.kind !== 'slot') return true;
    if (typeof t.accepts === 'function') return t.accepts(c);
    return !c.team || c.team === 'all' || !t.team || t.team === 'all' || t.team === c.team;
  }

  /** أقرب هدف مناسب لحالة المؤشر. */
  targetFor(c) {
    const targets = this.game.targets();
    const hand = c.source !== 'pointer';
    // ثبات البقاء: يبقى الهدف الحالي ما دامت اليد قريبة منه، وإن صارت خانة مجاورة أقرب قليلًا
    if (hand && c.dwellId) {
      const cur = targets.find((t) => t.id === c.dwellId && t.enabled !== false);
      if (cur && this._accepts(c, cur) && this._hit(cur, c.x, c.y, 22) < Infinity) return cur;
    }
    let best = null;
    let bestD = Infinity;
    const kinds = c.holding ? ['slot', 'card'] : ['card', 'button'];
    for (const kind of kinds) {
      for (const t of targets) {
        if (t.kind !== kind || t.enabled === false || !this._accepts(c, t)) continue;
        const d = this._hit(t, c.x, c.y, hand ? 10 : 0);
        if (d < bestD) {
          bestD = d;
          best = t;
        }
      }
      if (best) return best; // الخانات أولًا حين تحمل اليد سنًّا
    }
    return null;
  }

  // ---------------------------------------------------------------- كل إطار
  frame(now) {
    const dwell = this.getDwellMs();
    if (this.sim && this.simPos) this.updateHands([{ id: 0, ...this.simPos }], now);
    this.hovered.clear();
    for (const [key, c] of this.cursors) {
      if (c.source === 'pointer') {
        if (c.holding) {
          const t = this.targetFor(c);
          if (t?.kind === 'slot') this.hovered.add(t.id);
        }
        continue;
      }
      const lost = now - c.seen;
      if (c.holding) {
        // اختفت اليد الحاملة: يُركن السن مكانه، ويعود إلى بطاقته إن طال الغياب
        if (lost > PARK_MS) {
          this.game.cancel(c);
          c.g?.remove();
          this.cursors.delete(key);
          continue;
        }
        if (lost > PARK_AFTER_MS) {
          c.parked = true;
          c.dwellId = null;
          c.progress = 0;
          continue;
        }
      } else if (lost > TRACK_TTL_MS) {
        c.g?.remove();
        this.cursors.delete(key);
        continue;
      }
      this._glide(c, now);
      if (!c.holding) this._adopt(c, now);
      const t = this.targetFor(c);
      const id = t?.id ?? null;
      if (c.consumed && c.consumed !== id) c.consumed = null;
      if (id && c.consumed !== id) this.hovered.add(id);
      if (!id || c.consumed === id) {
        c.dwellId = null;
        c.progress = 0;
        continue;
      }
      if (c.dwellId !== id) {
        c.dwellId = id;
        c.dwellStart = now;
      }
      // الإفلات على خانة أسرع قليلًا من الالتقاط: اليد تكون قد استقرت بعد الحركة
      const need = c.holding && t.kind === 'slot' ? dwell * 0.85 : dwell;
      c.progress = Math.min(1, (now - c.dwellStart) / need);
      if (c.progress >= 1) {
        c.progress = 0;
        c.dwellId = null;
        c.consumed = id;
        this._fire(c, t);
      }
    }
    this.game.setHovered(this.hovered);
    this._draw(now);
  }

  /** يد ظهرت قرب سن مركون تلتقطه (غالبًا اليد نفسها بعد حجب، بهوية جديدة). */
  _adopt(c, now) {
    let best = null;
    let bestD = Infinity;
    for (const p of this.cursors.values()) {
      if (!p.parked || !p.holding || p === c) continue;
      if (c.born < p.seen) continue; // يد كانت ظاهرة قبل الركن ليست اليد المفقودة
      const r = ADOPT_R0 + (ADOPT_R1 - ADOPT_R0) * Math.min(1, (now - p.seen) / 2000);
      const d = Math.hypot(p.x - c.x, p.y - c.y);
      if (d < r && d < bestD) {
        best = p;
        bestD = d;
      }
    }
    if (!best) return;
    c.holding = best.holding;
    c.team = best.team;
    c.consumed = null;
    c.dwellId = null;
    c.dwellStart = now;
    best.holding = null;
    best.g?.remove();
    this.cursors.delete(best.key);
  }

  _fire(c, t) {
    if (c.holding) {
      if (t.kind === 'slot') this.game.drop(c, t);
      else if (t.kind === 'card') this.game.press(c, t); // تبديل السن أو إعادته
    } else {
      this.game.press(c, t);
    }
  }

  // ---------------------------------------------------------------- الرسم
  _draw(now) {
    if (!this.layer) return;
    const show = this.getShowHands();
    for (const c of this.cursors.values()) {
      if (!c.g) {
        c.g = svgEl('g', { class: `cursor ${c.source}` });
        c.held = svgEl('g', { class: 'held' });
        c.ringBg = svgEl('circle', { r: RING_R, class: 'ring-bg' });
        c.ring = svgEl('circle', {
          r: RING_R,
          class: 'ring',
          'stroke-dasharray': `0 ${RING_LEN}`,
          transform: 'rotate(-90)',
        });
        c.dot = svgEl('circle', { r: 9, class: 'dot' });
        c.ring.style.stroke = c.color;
        c.dot.style.fill = c.color;
        c.g.append(c.held, c.ringBg, c.ring, c.dot);
        this.layer.appendChild(c.g);
        c.heldType = null;
      }
      if (c.heldType !== c.holding) {
        c.held.replaceChildren();
        if (c.holding) c.held.appendChild(this.game.heldIcon(c.holding, c.team));
        c.heldType = c.holding;
      }
      c.g.classList.toggle('parked', !!c.parked);
      const stale = c.source === 'hand' && now - c.seen > 160;
      c.g.setAttribute('transform', `translate(${c.x.toFixed(1)} ${c.y.toFixed(1)})`);
      c.g.style.opacity = c.source === 'pointer' ? (c.holding ? '1' : '0') : c.parked ? '0.8' : stale ? '0.35' : '1';
      const ringVisible = c.source !== 'pointer' && (show || c.holding);
      c.ringBg.style.display = ringVisible ? '' : 'none';
      c.ring.style.display = ringVisible ? '' : 'none';
      c.dot.style.display = c.source !== 'pointer' && show ? '' : 'none';
      c.ring.setAttribute('stroke-dasharray', `${(c.progress * RING_LEN).toFixed(1)} ${RING_LEN}`);
    }
  }

  // ---------------------------------------------------------------- اللمس والماوس
  _toView(e) {
    const r = this.stage.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * this.game.VW,
      y: ((e.clientY - r.top) / r.height) * this.game.VH,
    };
  }

  _bindPointer() {
    const stage = this.stage;
    stage.addEventListener('pointerdown', (e) => {
      if (this.sim && e.pointerType === 'mouse') return;
      const p = this._toView(e);
      const key = `p${e.pointerId}`;
      const c = this._newCursor(key, 'pointer');
      Object.assign(c, p);
      this.cursors.set(key, c);
      const t = this.targetFor(c);
      if (t) this.game.press(c, t);
      if (c.holding) stage.setPointerCapture?.(e.pointerId);
      else this.cursors.delete(key);
      e.preventDefault();
    });
    stage.addEventListener('pointermove', (e) => {
      if (this.sim && e.pointerType === 'mouse') {
        this.simPos = { x: e.clientX / innerWidth, y: e.clientY / innerHeight };
        return;
      }
      const c = this.cursors.get(`p${e.pointerId}`);
      if (!c) return;
      Object.assign(c, this._toView(e));
    });
    const end = (e, cancelled) => {
      const key = `p${e.pointerId}`;
      const c = this.cursors.get(key);
      if (!c) return;
      if (c.holding) {
        const t = cancelled ? null : this.targetFor(c);
        if (t?.kind === 'slot') this.game.drop(c, t);
        else this.game.cancel(c);
      }
      c.g?.remove();
      this.cursors.delete(key);
    };
    stage.addEventListener('pointerleave', (e) => {
      if (this.sim && e.pointerType === 'mouse') this.simPos = null;
    });
    stage.addEventListener('pointerup', (e) => end(e, false));
    stage.addEventListener('pointercancel', (e) => end(e, true));
  }

  setSim(on) {
    this.sim = !!on;
    if (!on) this.simPos = null;
  }

  /** يُستدعى عند تغيير الشاشة: تُلغى كل الأسنان المحمولة. */
  reset() {
    for (const c of this.cursors.values()) {
      c.holding = null;
      c.team = null;
      c.consumed = null;
      c.dwellId = null;
      c.g?.remove();
      c.g = null;
    }
    for (const [k, c] of this.cursors) if (c.source === 'pointer' || c.parked) this.cursors.delete(k);
  }
}
