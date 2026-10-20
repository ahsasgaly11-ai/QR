// ---------------------------------------------------------------------------
// محرّك التفاعل: يوحّد ثلاثة مصادر للمؤشرات في منطق واحد:
//   • يد الطالب على السبورة (من الكاميرا): «اللمس بالبقاء» — تبقى اليد على
//     الهدف مدة قصيرة فتمتلئ حلقة حولها ثم يُنفَّذ الفعل. الكاميرا لا تعرف هل
//     لامست اليد السبورة أم اقتربت منها، فالبقاء هو ما يميّز النية عن المرور.
//   • لمس شاشة الآيباد أو الماوس: فوري (ضغط، سحب، إفلات).
//   • محاكاة اليد بالماوس (للتجربة دون كاميرا): الماوس يتصرف كيد بالضبط.
//
// اللعبة تعرّف «الأهداف» (بطاقات، أزرار، خانات)، والمحرّك يقرر أي هدف تحت كل
// مؤشر ومتى يُنفَّذ، ثم يستدعي game.press / game.drop / game.cancel.
// ---------------------------------------------------------------------------
import { TRACK_TTL_MS } from './tracker.js';

const NS = 'http://www.w3.org/2000/svg';
const RING_R = 30;
const RING_LEN = 2 * Math.PI * RING_R;
const HAND_COLORS = ['#8a1538', '#1d4ed8', '#047857', '#b45309', '#7c3aed', '#be185d'];

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
  /** @param {{id:number,x:number,y:number}[]} hands إحداثيات شاشة مطبّعة */
  updateHands(hands, t) {
    const { VW, VH } = this.game;
    for (const h of hands) {
      const key = `h${h.id}`;
      let c = this.cursors.get(key);
      if (!c) {
        c = this._newCursor(key, 'hand');
        this.cursors.set(key, c);
      }
      c.x = h.x * VW;
      c.y = h.y * VH;
      c.seen = t;
    }
  }

  _newCursor(key, source) {
    return {
      key,
      source,
      x: 0,
      y: 0,
      seen: performance.now(),
      holding: null,
      dwellId: null,
      dwellStart: 0,
      consumed: null, // آخر هدف نُفّذ عليه فعل؛ لا يتكرر حتى تغادره اليد
      progress: 0,
      color: HAND_COLORS[this._colorIdx++ % HAND_COLORS.length],
      g: null,
    };
  }

  // ---------------------------------------------------------------- الأهداف
  _hit(t, x, y) {
    if (t.rect) {
      const { x: rx, y: ry, w, h } = t.rect;
      const pad = t.pad ?? 12;
      const dx = Math.max(rx - pad - x, 0, x - (rx + w + pad));
      const dy = Math.max(ry - pad - y, 0, y - (ry + h + pad));
      return dx === 0 && dy === 0 ? 0 : Infinity;
    }
    const d = Math.hypot(t.x - x, t.y - y);
    return d <= t.r ? d : Infinity;
  }

  /** أقرب هدف مناسب لحالة المؤشر. */
  targetFor(c) {
    const targets = this.game.targets();
    let best = null;
    let bestD = Infinity;
    const kinds = c.holding ? ['slot', 'card'] : ['card', 'button'];
    for (const kind of kinds) {
      for (const t of targets) {
        if (t.kind !== kind || t.enabled === false) continue;
        const d = this._hit(t, c.x, c.y);
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
      // اختفت اليد: أعِد السن الذي تحمله إلى مكانه
      if (now - c.seen > TRACK_TTL_MS) {
        if (c.holding) this.game.cancel(c);
        c.g?.remove();
        this.cursors.delete(key);
        continue;
      }
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
        if (c.holding) c.held.appendChild(this.game.heldIcon(c.holding));
        c.heldType = c.holding;
      }
      const stale = c.source === 'hand' && now - c.seen > 160;
      c.g.setAttribute('transform', `translate(${c.x.toFixed(1)} ${c.y.toFixed(1)})`);
      c.g.style.opacity = c.source === 'pointer' ? (c.holding ? '1' : '0') : stale ? '0.35' : '1';
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
        const r = stage.getBoundingClientRect();
        this.simPos = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
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
      c.consumed = null;
      c.dwellId = null;
      c.g?.remove();
      c.g = null;
    }
    for (const [k, c] of this.cursors) if (c.source === 'pointer') this.cursors.delete(k);
  }
}
