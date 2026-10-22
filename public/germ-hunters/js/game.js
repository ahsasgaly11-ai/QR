// ---------------------------------------------------------------------------
// «صيّادو الجراثيم» — لعبة سبورة لدرس «أين توجد الجراثيم؟».
//
// لكل فريق (أو للصف كله) «حجرة بنفسجية» فيها مصباح أشعة فوق بنفسجية، وسلّتان، وبطاقات.
// يلتقط الطالب بطاقة بيده فيظهر الشيء في الحجرة، ثم يضعها في السلة المناسبة:
//   الجولة ١ «أين تعلق الجراثيم؟»: سطح خشن / سطح ناعم. عند الصواب يُضاء المصباح فتتوهّج
//            جراثيم لم تكن تُرى، ثم تنفخ مروحة الهواء: على الخشن تبقى عالقة، وعن الناعم تطير.
//   منتصف اللعبة «أطفئوا الأنوار!»: يدان تبدوان نظيفتين تتوهّج عليهما الجراثيم.
//   الجولة ٢ «تنشر أم تمنع؟»: ينشر الجراثيم / يمنع انتشارها، وبعد الصواب مشهد قصير يكشف
//            ما يحدث للجراثيم (رذاذ العطاس يتناثر، المنديل يوقفه، الصابون يزيلها…).
//
// يطبّق عقد اللعبة في board-kit (راجع /board-kit/README_AR.md):
//   الأهداف: البطاقات (تُلتقط)، والسلّتان (خانات إفلات مستطيلة)، وأزرار القائمة.
//   في السباق: نصف الشاشة لكل فريق بحجرته وسلّتيه وبطاقاته ولونه، ولا تقبل سلّتاه إلا بطاقاته.
//
// الطبقات: #board (زخرفة SVG للطبقة C) ← .gh-gl (المختبر ثلاثي الأبعاد كاملًا، غير شفاف)
//          ← .gh-scope (أسماء الخزائن ورموز الجولة ٢؛ وفي C الحجرات والإظلام) ← #hud (البطاقات والسلال)
//          ← .gh-px (جسيمات 2D) ← .gh-over (نص منتصف اللعبة) ← .gh-cine (الافتتاح/الختام) ← #fx (الأيدي)
// طبقات الجودة: A/B عبر scene3d.js، وC عبر flat.js — والأهداف نفسها في الثلاث.
// ---------------------------------------------------------------------------
import { sfx, say } from '/board-kit/js/audio.js';
import { fxs, music, setFxSound, Particles } from './fx.js';
import { FlatView } from './flat.js';
import { pickRound } from './content.js';
import { cardKey } from './cards3d.js';

const NS = 'http://www.w3.org/2000/svg';
const TEAMS = {
  a: { name: 'الفريق الأول', short: 'الأول', color: '#8a1538', pan: 0.6 },
  b: { name: 'الفريق الثاني', short: 'الثاني', color: '#0e7490', pan: -0.6 },
  all: { name: 'صيّادو الصف', short: 'الصف', color: '#6d28d9', pan: 0 },
};
const ar = (n) => Number(n).toLocaleString('ar-EG');
const fmtTime = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${ar(Math.floor(s / 60))}:${ar(String(s % 60).padStart(2, '0')).padStart(2, '٠')}`;
};
/** النص يدخل HTML: نهرّبه دائمًا. */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function html(tag, cls, inner) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (inner !== undefined) e.innerHTML = inner;
  return e;
}
function svg(tag, attrs = {}) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
  return e;
}
const reducedMotion = () =>
  document.documentElement.dataset.motion === 'reduce' || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** أيقونات السلال: رسوم بسيطة لا تكشف الإجابة (نسيج خشن/ناعم، رذاذ/درع) */
const BIN_ICON = {
  rough: '<svg viewBox="0 0 120 60"><path d="M4 40 L14 18 L22 36 L32 12 L40 38 L50 16 L58 34 L68 10 L76 36 L86 18 L94 38 L104 14 L116 40" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/><path d="M4 52 H116" stroke="currentColor" stroke-width="5" stroke-linecap="round" opacity=".5"/></svg>',
  smooth: '<svg viewBox="0 0 120 60"><path d="M4 34 C 30 22, 50 22, 60 30 S 92 40, 116 28" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><path d="M4 52 H116" stroke="currentColor" stroke-width="5" stroke-linecap="round" opacity=".5"/></svg>',
  spread: '<svg viewBox="0 0 120 60"><circle cx="22" cy="30" r="12" fill="currentColor"/><g fill="currentColor"><circle cx="52" cy="14" r="5"/><circle cx="60" cy="32" r="6"/><circle cx="50" cy="48" r="5"/><circle cx="78" cy="22" r="5"/><circle cx="84" cy="42" r="6"/><circle cx="104" cy="12" r="4"/><circle cx="108" cy="32" r="5"/><circle cx="102" cy="52" r="4"/></g></svg>',
  stop: '<svg viewBox="0 0 120 60"><path d="M60 4 L92 14 V30 C92 44 78 54 60 58 C42 54 28 44 28 30 V14 Z" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/><path d="M46 31 L56 41 L76 21" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

export class Game {
  constructor({ stage, board, hud, fx }, content) {
    Object.assign(this, { stage, board, hud, fx, content });
    this.VH = 1000;
    this.VW = 1600;
    this.scale = 1;
    this.settings = {};
    this.input = null;
    this.screen = 'menu';
    this.opts = { race: true };
    this.state = null;
    this.L = {};
    this._targets = [];
    this._els = new Map();
    this._hoverOn = new Set();
    this._timers = new Set();
    this.item = Object.fromEntries(content.items.map((i) => [i.id, i]));
    this.round = Object.fromEntries(content.rounds.map((r) => [r.id, r]));
    this.reduced = reducedMotion();

    // طبقات دائمة (لا يمسحها render)
    this.$scope = html('div', 'gh-scope');
    this.$gl = html('canvas', 'gh-gl');
    this.$px = html('canvas', 'gh-px');
    this.$over = html('div', 'gh-over');
    this.$cine = html('div', 'gh-cine');
    stage.insertBefore(this.$gl, hud);
    stage.insertBefore(this.$scope, hud);
    stage.insertBefore(this.$px, fx);
    // نماذج البطاقات الحيّة (A وB): فوق البطاقات واللهب، وتحت مؤشرات الأيدي
    this.$top = html('canvas', 'gh-top');
    stage.insertBefore(this.$top, fx);
    this.cards = null;
    stage.insertBefore(this.$over, fx);
    stage.insertBefore(this.$cine, fx);
    this.particles = new Particles(this.$px);

    // العرض: نبدأ بالطبقة C (تعمل فورًا)، ثم نحمّل الأبعاد الثلاثة إن أمكن
    this.view = new FlatView();
    this.view.onSound = (id, n) => this._snd(id, n);
    this._pending = null;
    this._setTier('C');
    // ?tier=A|B|C يفرض طبقة للتجربة (ولا ينزل منها منظّم الجودة)
    const forced = new URLSearchParams(location.search).get('tier')?.toUpperCase() || null;
    this.forcedTier = ['A', 'B', 'C'].includes(forced) ? forced : null;
    if (!this.reduced && forced !== 'C') this._load3D(this.forcedTier);

    this._lastFrame = performance.now();
    const loop = (now) => {
      this._frame(now);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------------ طبقات الجودة
  _setTier(t) {
    this.tier = t;
    this.stage.dataset.tier = t;
    document.documentElement.dataset.ghTier = t;
  }
  /** يحمّل المشهد ثلاثي الأبعاد (A أو B). إن فشل تبقى اللعبة في الطبقة C. */
  async _load3D(forced) {
    try {
      const { createScene3D } = await import('./scene3d.js');
      const canvas = html('canvas', 'gh-gl');
      const v = await createScene3D(canvas, { forced });
      if (!v) return;
      this._pending = { view: v, canvas };
      this._applyPending();
    } catch (e) {
      console.warn('تعذّر تحميل الأبعاد الثلاثة، الطبقة C', e);
    }
  }
  /** تبديل العرض لا يحدث إلا بلا أهداف نشطة (القائمة، أو أثناء الافتتاح) */
  _applyPending() {
    const p = this._pending;
    if (!p) return;
    if (this.screen === 'play' && this.state && !this.state.cine) return;
    this._pending = null;
    this._swapView(p.view, p.canvas);
  }
  _swapView(v, canvas) {
    this.view?.dispose?.();
    if (canvas) {
      this.$gl.replaceWith(canvas);
      this.$gl = canvas;
    } else {
      const c = html('canvas', 'gh-gl');
      this.$gl.replaceWith(c);
      this.$gl = c;
    }
    this.view = v;
    v.reduced = this.reduced;
    v.onSound = (id, n) => this._snd(id, n);
    v.onFail = () => setTimeout(() => this._gpuFallback(v), 0);
    this._setTier(v.tier);
    this._setupCards(v.tier);
    this.render();
  }

  /** طبقة النماذج الحيّة فوق البطاقات: في A وB فقط (C بالرموز) */
  async _setupCards(tier) {
    const want = tier === 'A' || tier === 'B';
    if (this.cards && (!want || this.cards.tier !== tier)) {
      this.cards.dispose();
      this.cards = null;
      const c = html('canvas', 'gh-top');
      this.$top.replaceWith(c);
      this.$top = c;
    }
    if (!want || this.cards) return;
    try {
      const { Cards3D } = await import('./cards3d.js');
      if (this.view.tier !== tier || this.cards) return;
      this.cards = new Cards3D(this.$top, tier);
      this.cards.reduced = this.reduced;
      this.render();
    } catch (e) {
      console.warn('تعذّر تحميل نماذج البطاقات، تبقى الرموز', e);
      this.cards = null;
    }
  }

  /** يربط كل بطاقة ظاهرة بنموذجها الحيّ */
  _syncCards() {
    if (!this.cards) return;
    const list = [];
    for (const card of this.hud.querySelectorAll('.gh-card[data-target]')) {
      const slot = card.querySelector('.gh-slot');
      const iid = card.dataset.target.split(':')[2];
      const it = this.item[iid];
      const key = it && cardKey(it);
      if (slot && key) list.push({ id: card.dataset.target, key, el: slot, card });
    }
    this.cards.setSlots(list);
  }

  /** تعطّل المشهد (خطأ معالج رسوم أو فقدان سياق): ننزل طبقة فورًا. الأهداف HTML فلا يتأثر اللعب. */
  async _gpuFallback(v) {
    if (this.view !== v) return;
    let next = null;
    let canvas = null;
    if (v.tier === 'A') {
      const { createScene3D } = await import('./scene3d.js');
      canvas = html('canvas', 'gh-gl');
      next = await createScene3D(canvas, { forced: 'B' });
    }
    if (this.view !== v) return next?.dispose();
    this._swapView(next || new FlatView(), next ? canvas : null);
    for (const id of Object.keys(this.state?.teams || {})) {
      const T = this.state.teams[id];
      if (T.booth.uv) this.view.lampOn(id);
    }
  }

  // ------------------------------------------------------------------ عقد اللعبة
  setSettings(s) {
    this.settings = s;
    setFxSound(s.sound !== false);
  }
  targets() {
    const st = this.state;
    if (st?.cine) return [];
    if (this.screen !== 'play' || !st) return this._targets;
    return this._targets.filter((t) => !t.team || !st.teams[t.team] || st.teams[t.team].phase === 'play');
  }
  setHovered(ids) {
    for (const id of this._hoverOn) if (!ids.has(id)) this._els.get(id)?.classList.remove('hover');
    for (const id of ids) if (!this._hoverOn.has(id)) this._els.get(id)?.classList.add('hover');
    this._hoverOn = new Set(ids);
  }
  toMenu() {
    this._clearTimers();
    music.stop();
    this.particles.clear();
    this._cine(null);
    this.screen = 'menu';
    this.state = null;
    this.input?.reset();
    this.view.reset();
    this._applyPending();
    this.render();
  }
  tickClock() {
    const soundOn = this.settings.sound !== false;
    setFxSound(soundOn);
    const st = this.state;
    if (soundOn && st && this.screen === 'play' && !st.cine && !music.on) music.start(Object.values(st.teams).some((t) => t.r > 0));
    if (this.$time && st) this.$time.textContent = `⏱ ${fmtTime((st.end || performance.now()) - st.start)}`;
  }

  later(fn, ms) {
    const t = setTimeout(() => {
      this._timers.delete(t);
      fn();
    }, ms);
    this._timers.add(t);
  }
  _clearTimers() {
    for (const t of this._timers) clearTimeout(t);
    this._timers.clear();
    for (const T of Object.values(this.state?.teams || {})) this._stopShow(T);
  }

  // ------------------------------------------------------------------ عرض العدسة (لا يوقف اللعب)
  /** مؤقت خاص بعرض العدسة الجاري للفريق */
  _showLater(T, fn, ms) {
    const S = T.show;
    if (!S) return;
    const t = setTimeout(() => {
      S.timers.delete(t);
      // العرض ما زال هو نفسه، والفريق من الجولة الحالية (لا من لعبة سابقة)
      if (T.show === S && this.state?.teams[T.id] === T) fn();
    }, ms);
    S.timers.add(t);
  }
  _stopShow(T) {
    if (!T?.show) return;
    for (const t of T.show.timers) clearTimeout(t);
    T.show = null;
  }
  /** يبدأ عرضًا جديدًا في العدسة؛ إن كان عرض سابق جاريًا يُقطع فورًا لصالح البطاقة الأحدث */
  _startShow(T, it) {
    if (T.show) {
      this._stopShow(T);
      (this.view.abortTest || this.view.endTest).call(this.view, T.id);
    }
    T.show = { iid: it.id, timers: new Set() };
  }
  /** انتهى العرض: العدسة تعود لما في أيدي الفريق، أو ينتقل الفريق إن لم تبقَ بطاقات */
  _endShow(T) {
    const id = T.id;
    this._stopShow(T);
    this.view.endTest(id);
    this._setBooth(id, { item: null, uv: false, scene: false });
    if (!this.state || this.screen !== 'play') return;
    if (T.msg?.kind === 'reveal') {
      T.msg = null;
      this._say(id, null);
    }
    if (T.left.length) {
      // التقطوا بطاقة أثناء العرض؟ تظهر الآن في العدسة
      this.later(() => this._syncPreview(id), 380);
      return;
    }
    this._next(T);
  }
  _d(ms) {
    return this.reduced ? Math.round(ms * 0.4) : ms;
  }
  _snd(id, name) {
    fxs[name]?.(this.state?.race ? TEAMS[id]?.pan || 0 : 0);
  }

  // ------------------------------------------------------------------ التخطيط
  _band() {
    const side = Math.round((this.settings.sideInset || 0) * this.VW) + 26;
    return {
      head: 104,
      top: Math.max(104, Math.round((this.settings.reachTop || 0) * this.VH)),
      bottom: this.VH - 14,
      left: side,
      right: this.VW - side,
    };
  }

  /** مواضع كل فريق: الحجرة، وسطر الرسائل، والسلّتان، والبطاقات. */
  _layout() {
    const { head, top, bottom, left, right } = this._band();
    const mid = this.VW / 2;
    const ids = this.state ? Object.keys(this.state.teams) : [];
    this.L = {};
    for (const id of ids) {
      const x0 = id === 'a' ? mid + 14 : left; // الفريق الأول يمينًا (بداية القراءة)
      const x1 = id === 'b' ? mid - 14 : right;
      const w = x1 - x0;
      const barH = 44;
      const cardH = clamp((bottom - top) * 0.19, 150, 172);
      const trayH = cardH + barH + 6;
      const trayTop = bottom - trayH;
      const binH = clamp((bottom - top) * 0.19, 150, 184);
      const binTop = Math.max(top, trayTop - 14 - binH);
      const binW = clamp(w * 0.46, 200, 420);
      const gap = clamp(w * 0.04, 16, 60);
      const cx = (x0 + x1) / 2;
      const promptH = 82;
      const promptTop = binTop - 10 - promptH;
      const boothTop = head + 8;
      const boothH = Math.max(150, promptTop - 10 - boothTop);
      const boothW = Math.min(w, boothH * 2.6, 1150);
      this.L[id] = {
        x0, x1, w, trayTop, trayH, barH, promptTop, promptH,
        booth: { x: cx - boothW / 2, y: boothTop, w: boothW, h: boothH },
        // السلة الأولى يمينًا (بداية القراءة)
        bins: [
          { x: cx + gap / 2, y: binTop, w: Math.min(binW, w / 2 - gap / 2), h: binH },
          { x: cx - gap / 2 - Math.min(binW, w / 2 - gap / 2), y: binTop, w: Math.min(binW, w / 2 - gap / 2), h: binH },
        ],
        zone: { x0, x1, top: head, bottom },
      };
    }
  }

  render() {
    const r = this.stage.getBoundingClientRect();
    this.VW = Math.round((1000 * Math.max(1, r.width)) / Math.max(1, r.height));
    this.scale = Math.max(1, r.height) / 1000;
    this.stage.style.setProperty('--u', `${this.scale}px`);
    for (const s of [this.board, this.fx]) s.setAttribute('viewBox', `0 0 ${this.VW} ${this.VH}`);
    this._els.clear();
    this._hoverOn.clear();
    this.board.replaceChildren();
    this.hud.replaceChildren();
    this.fx.replaceChildren();
    this.$scope.replaceChildren();
    this.$over.replaceChildren();
    this.$teams = {};
    this.stage.dataset.screen = this.screen;
    this.particles.resize(r.width, r.height, this.scale);
    this._decorate();
    if (this.screen === 'menu') this._renderMenu();
    else if (this.screen === 'play') this._renderPlay();
    else this._renderDone();
    const spec = {};
    if (this.screen === 'play' && this.state) for (const [id, L] of Object.entries(this.L)) spec[id] = { booth: L.booth, zone: L.zone };
    this.view.layout(r.width, r.height, this.VW, this.VH);
    this.view.setTeams(spec);
    // لحظة القائمة في الطبقتين A وB: يد تتوهّج عليها الجراثيم بين صف الخطوات والأزرار
    this.view.hero?.(this.screen === 'menu' ? { x: this.VW / 2, y: 565, h: 160 } : null);
    if (this.screen === 'play' && this.state) for (const id of Object.keys(this.state.teams)) this._syncPreview(id);
    this.$top.style.display = this.cards ? '' : 'none';
    if (this.cards) {
      this.cards.layout(r.width, r.height, this.scale);
      this._syncCards();
    }
    const layer = svg('g', { class: 'cursors' });
    this.fx.appendChild(layer);
    this.input?.attachLayer(layer);
    this._collectTargets();
  }

  /** خلفية «مختبر النظافة»: بلاط فاتح ونقاط ضوء بنفسجية خفيفة */
  _decorate() {
    const b = this.board;
    const defs = svg('defs');
    const pat = svg('pattern', { id: 'ghtile', width: 56, height: 56, patternUnits: 'userSpaceOnUse' });
    pat.appendChild(svg('path', { d: 'M56 0H0V56', fill: 'none', stroke: '#6d28d9', 'stroke-opacity': '0.06', 'stroke-width': 3 }));
    defs.appendChild(pat);
    b.appendChild(defs);
    b.appendChild(svg('rect', { width: this.VW, height: this.VH, fill: 'url(#ghtile)' }));
    for (const [fx, fy, rr] of [[0.06, 0.22, 26], [0.94, 0.18, 20], [0.5, 0.07, 16], [0.17, 0.66, 14], [0.85, 0.6, 18], [0.3, 0.12, 10], [0.7, 0.3, 12]]) {
      const g = svg('g', { class: 'gh-deco', transform: `translate(${fx * this.VW} ${fy * this.VH})` });
      g.appendChild(svg('circle', { r: rr }));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.appendChild(svg('circle', { cx: Math.cos(a) * rr * 1.35, cy: Math.sin(a) * rr * 1.35, r: rr * 0.22 }));
      }
      b.appendChild(g);
    }
    if (this.screen === 'play' && this.state?.race) {
      const { head } = this._band();
      b.appendChild(svg('line', { x1: this.VW / 2, y1: head, x2: this.VW / 2, y2: this.VH - 10, class: 'gh-divider' }));
    }
  }

  // ------------------------------------------------------------------ القائمة
  _renderMenu() {
    const { left, right } = this._band();
    const head = html('header', 'hud-header menu-head');
    head.append(html('h1', 'title gh-title', `🔦 ${esc(this.content.title)}`), html('p', 'lead', esc(this.content.lead)));
    this.hud.appendChild(head);
    const how = html('div', 'gh-how');
    how.innerHTML = `
      <span><i>🃏</i>التقط بطاقة</span><b>←</b>
      <span><i>🧺</i>ضعها في سلّتها</span><b>←</b>
      <span><i>🔦</i>نضيء الضوء البنفسجي</span><b>←</b>
      <span><i>🔬</i>نكبّر بالعدسة!</span>`;
    this.hud.appendChild(how);
    const panel = html('div', 'menu-panel');
    Object.assign(panel.style, { left: `calc(var(--u) * ${left + 20})`, right: `calc(var(--u) * ${this.VW - right + 20})` });
    const row = html('div', 'menu-row');
    const race = html('div', `opt${this.opts.race ? ' on' : ''}`, '<b>سباق فريقين</b><small>طالبان أو فريقان، كلٌّ في طرف</small>');
    race.dataset.target = 'opt:race';
    const solo = html('div', `opt${this.opts.race ? '' : ' on'}`, '<b>الصف كله</b><small>طالب أو أكثر معًا</small>');
    solo.dataset.target = 'opt:solo';
    row.append(race, solo);
    const row2 = html('div', 'menu-row');
    const start = html('div', 'opt start', '<b>ابدأ</b><small>المس وأبقِ يدك</small>');
    start.dataset.target = 'start';
    row2.appendChild(start);
    panel.append(row, row2);
    this.hud.appendChild(panel);
  }

  // ------------------------------------------------------------------ جولة جديدة
  newGame() {
    this.reduced = reducedMotion();
    this.view.reduced = this.reduced;
    this.particles.reduced = this.reduced;
    const teamIds = this.opts.race ? ['a', 'b'] : ['all'];
    // البطاقات نفسها للفريقين (عدالة) بترتيب مختلف
    const sets = this.content.rounds.map((r) => pickRound(this.content, r.id));
    const teams = {};
    for (const id of teamIds) {
      teams[id] = {
        id, r: 0, phase: 'play', rounds: sets.map((s) => [...s].sort(() => Math.random() - 0.5)), left: null,
        placed: 0, mistakes: 0, byItem: {}, wrong: {}, end: 0, msg: null, lastPick: null, booth: { item: null, uv: false },
      };
      teams[id].left = [...teams[id].rounds[0]];
    }
    this.state = { race: this.opts.race, teams, start: performance.now(), end: 0, winner: null, cine: true };
    this.screen = 'play';
    this.input?.reset();
    this._clearTimers();
    this.view.reset();
    this._applyPending();
    this.render();
    this._intro();
  }

  get total() {
    return this.content.rounds.reduce((s, r) => s + this.content.perRound[r.id], 0);
  }
  get mistakes() {
    return this.state ? Object.values(this.state.teams).reduce((s, t) => s + t.mistakes, 0) : 0;
  }

  /** الافتتاح السينمائي (٢٫٤ ث): أشرطة، سطر تمهيدي، عنوان يتّسع مع ومضة، والمصباح يكشف جراثيم. لا أهداف أثناءه. */
  _intro() {
    const st = this.state;
    this._cine(`
      <div class="cine-bar top"></div><div class="cine-bar bottom"></div>
      <div class="cine-pre">مهمّتكم يا صيّادي الجراثيم: اكشفوا الجراثيم الخفية… وأوقفوا انتشارها!</div>
      <div class="cine-title">🔦 ${esc(this.content.title)}</div>
      <div class="cine-flash"></div>`, 'intro');
    this.view.startMeasure();
    this.view.intro();
    this.view.warmUp?.();
    for (const id of Object.keys(st.teams)) this._setBooth(id, { uv: true });
    this.later(() => {
      for (const id of Object.keys(st.teams)) this._setBooth(id, { uv: false });
    }, this._d(1700));
    fxs.whoosh(0.9);
    this.later(() => fxs.boom(), this._d(900));
    this.later(() => this._afterIntro(), this._d(2400));
  }

  /** منظّم الجودة: إن كان الرسم بطيئًا أثناء الافتتاح ننزل طبقة قبل أن تظهر الأهداف */
  async _afterIntro() {
    const st = this.state;
    if (!st || this.screen !== 'play') return;
    const avg = this.view.stopMeasure();
    if (avg > 45 && this.view.tier !== 'C' && !this.forcedTier) {
      console.info(`منظّم الجودة: ${avg.toFixed(0)} م.ث/إطار ← نزول من الطبقة ${this.view.tier}`);
      if (this.view.tier === 'A') {
        const { createScene3D } = await import('./scene3d.js');
        const canvas = html('canvas', 'gh-gl');
        const v = await createScene3D(canvas, { forced: 'B' });
        if (this.state !== st) return v?.dispose();
        if (v) this._swapView(v, canvas);
        else this._swapView(new FlatView(), null);
      } else {
        this._swapView(new FlatView(), null);
      }
    }
    this._cine(null);
    st.cine = false;
    music.start();
    for (const id of Object.keys(st.teams)) this._fillTeam(id);
    this._collectTargets();
  }

  _cine(inner, kind = '') {
    if (!inner) {
      this.$cine.className = 'gh-cine';
      this.$cine.replaceChildren();
      return;
    }
    this.$cine.innerHTML = inner;
    this.$cine.className = `gh-cine show ${kind}${this.reduced ? ' reduced' : ''}`;
  }

  // ------------------------------------------------------------------ اللعب
  _renderPlay() {
    const st = this.state;
    this._layout();
    const head = html('header', 'hud-header');
    head.appendChild(html('h1', 'title small gh-title', `🔦 ${esc(this.content.title)}`));
    const chips = html('div', 'chips');
    this.$time = html('span', 'chip time');
    chips.appendChild(this.$time);
    if (!st.race) {
      this.$progress = html('span', 'chip');
      this.$mist = html('span', 'chip warn');
      chips.append(this.$progress, this.$mist);
    } else {
      this.$progress = null;
      this.$mist = null;
    }
    head.appendChild(chips);
    this.hud.appendChild(head);
    for (const id of Object.keys(st.teams)) this._renderTeam(id);
    this._updateHud();
  }

  _renderTeam(id) {
    const st = this.state;
    const T = st.teams[id];
    const L = this.L[id];
    const team = TEAMS[id];
    const ui = (this.$teams[id] = {});
    // الحجرة البنفسجية (تحت الأبعاد الثلاثة)
    const b = L.booth;
    const booth = this._place(html('div', 'gh-booth'), b.x, b.y, b.w, b.h);
    booth.style.setProperty('--team', team.color);
    booth.innerHTML = `
      <div class="gh-lamp"><i></i></div>
      <div class="gh-booth-tag">الحجرة البنفسجية</div>
      <div class="gh-booth-q">؟</div>
      <div class="gh-booth-item"><span class="gh-booth-emoji"></span><b class="gh-booth-name"></b></div>`;
    this.$scope.appendChild(booth);
    ui.booth = booth;
    // درجة التكبير وشريط المقياس تحت العدسة (A وB، أثناء الغوص المجهري)
    ui.scale = html('div', 'gh-scale', '<b class="gh-mag"></b><span class="gh-bar"><i></i><em></em></span>');
    this.$scope.appendChild(ui.scale);
    // الإظلام في منتصف اللعبة (تحت الأبعاد الثلاثة) ونصّه (فوق البطاقات)
    ui.dark = this._place(html('div', 'gh-dark', '<span class="gh-dark-hands">👐</span>'), L.x0 - 8, L.zone.top - 4, L.w + 16, L.zone.bottom - L.zone.top + 14);
    this.$scope.appendChild(ui.dark);
    ui.over = this._place(html('div', 'gh-midtext', T.midHtml || ''), L.x0, L.zone.top + 6, L.w, (L.zone.bottom - L.zone.top) * 0.3);
    this.$over.appendChild(ui.over);
    // سطر التعليمات والرسائل
    ui.prompt = this._place(html('div', 'gh-prompt'), L.x0, L.promptTop, L.w, L.promptH);
    ui.prompt.style.setProperty('--team', team.color);
    this.hud.appendChild(ui.prompt);
    // السلّتان (خانات الإفلات)
    ui.bins = [];
    const round = this.content.rounds[T.r];
    round.bins.forEach((bin, i) => {
      const R = L.bins[i];
      const el = this._place(html('div', `gh-bin gh-bin-${bin.icon}`), R.x, R.y, R.w, R.h);
      el.style.setProperty('--team', team.color);
      el.innerHTML = `<span class="gh-bin-icon">${BIN_ICON[bin.icon]}</span><b>${esc(bin.name)}</b><small>${esc(bin.sub)}</small><em class="gh-bin-count"></em>`;
      el.dataset.target = `bin:${id}:${bin.id}`;
      el.dataset.kind = 'slot';
      if (st.race) el.dataset.team = id;
      this.hud.appendChild(el);
      ui.bins.push(el);
    });
    // البطاقات وشريط الفريق
    const wrap = this._place(html('div', 'tray-wrap gh-wrap'), L.x0, L.trayTop, L.w, L.trayH);
    wrap.style.setProperty('--team', team.color);
    if (st.race) wrap.dataset.team = id;
    const bar = html('div', 'team-bar', `<b>${esc(team.name)}</b><span class="gh-dots"></span><span class="tb-mist"></span>`);
    wrap.appendChild(bar);
    ui.dots = bar.querySelector('.gh-dots');
    ui.mist = bar.querySelector('.tb-mist');
    ui.tray = html('div', 'gh-tray');
    wrap.appendChild(ui.tray);
    this.hud.appendChild(wrap);
    ui.wrap = wrap;
    this._fillTeam(id);
    this._paintBooth(id);
    this._paintPhase(id);
  }

  /** يعيد ملء بطاقات الفريق: أول ثلاث بطاقات متبقية (معرّفاتها ثابتة فلا ينقطع بقاء اليد). */
  _fillTeam(id) {
    const T = this.state.teams[id];
    const ui = this.$teams?.[id];
    if (!ui) return;
    const tray = ui.tray;
    tray.replaceChildren();
    const L = this.L[id];
    const held = this._heldBy(id);
    if (T.phase === 'done') {
      tray.style.setProperty('--n', 1);
      const msg = this.state.race && this.state.winner === id ? '🏆 فزتم! أحسنتم' : '✓ أنهيتم المهمة';
      tray.appendChild(html('div', 'card gh-card gh-wait', `<span class="gh-emoji">🎉</span><div class="card-body"><b>${msg}</b></div>`));
    } else {
      const shown = T.left.slice(0, 3);
      tray.style.setProperty('--n', Math.max(1, shown.length));
      const compact = L.w / Math.max(1, shown.length) < (L.trayH - L.barH) * 1.9;
      tray.classList.toggle('compact', compact);
      shown.forEach((iid, n) => {
        const it = this.item[iid];
        // البطاقة الخارجية هدف اليد (ثابتة لا تتحرك)، وداخلها بطاقة ثلاثية الأبعاد (.gh-c3) تميل وتطفو وتبرز
        const card = html('div', `card gh-card${held.has(iid) ? ' taken' : ''}${it.name.length > 15 ? ' long' : ''}`);
        card.style.setProperty('--i', n);
        // في الطبقتين A وB: صورة المجسّم نفسه (scene3d.makeThumbs)، وإلا الرمز
        // في A وB: «نافذة» يقف فوقها النموذج الحيّ ثلاثي الأبعاد (cards3d.js)؛ وفي C الرمز
        const icon = this.cards ? '<span class="gh-slot"></span>' : `<span class="gh-emoji">${esc(it.emoji)}</span>`;
        card.innerHTML = `<div class="gh-c3"><div class="gh-c3-face">${icon}<div class="card-body"><b>${esc(it.name)}</b></div><i class="gh-c3-shine"></i></div></div>`;
        card.dataset.target = `card:${id}:${iid}`;
        card.dataset.kind = 'card';
        tray.appendChild(card);
        this._els.set(card.dataset.target, card);
      });
    }
    if (!this.state.cine) this._say(id, T.msg);
    else ui.prompt.textContent = 'استعدّوا…';
    this._syncCards();
    this._updateHud();
  }

  _heldBy(id) {
    return new Set([...(this.input?.cursors.values() || [])].filter((c) => c.team === id && c.holding).map((c) => c.holding));
  }

  /** نص سطر الفريق: رسالة مؤقتة إن وُجدت، وإلا تعليمات الجولة */
  _say(id, msg) {
    const ui = this.$teams?.[id];
    const T = this.state?.teams[id];
    if (!ui || !T) return;
    const el = ui.prompt;
    const mid = T.phase === 'mid' ? ' mid' : '';
    if (msg) {
      el.className = `gh-prompt ${msg.kind || ''}${mid}`;
      el.innerHTML = `<span>${msg.html}</span>`;
      return;
    }
    el.className = `gh-prompt${mid}`;
    let text = '';
    if (T.phase === 'play') text = T.r === 0 ? '🃏 التقطوا بطاقة: هل سطح الشيء خشن أم ناعم؟' : '🃏 التقطوا بطاقة: هل هذا ينشر الجراثيم أم يمنع انتشارها؟';
    else if (T.phase === 'done') text = 'انتظروا زملاءكم…';
    else text = '👀 انظروا إلى الحجرة!';
    el.textContent = text;
  }

  /** رسالة مؤقتة في سطر الفريق (تعود التعليمات بعدها) */
  _flash(id, htmlStr, kind = '', ms = 2400) {
    const T = this.state?.teams[id];
    if (!T) return;
    T.msg = { html: htmlStr, kind };
    this._say(id, T.msg);
    clearTimeout(T._msgT);
    T._msgT = setTimeout(() => {
      if (T.msg?.html === htmlStr) {
        T.msg = null;
        this._say(id, null);
      }
    }, ms);
  }

  _place(el, x, y, w, h) {
    Object.assign(el.style, {
      left: `calc(var(--u) * ${x})`,
      top: `calc(var(--u) * ${y})`,
      width: `calc(var(--u) * ${w})`,
      height: `calc(var(--u) * ${h})`,
    });
    return el;
  }

  _collectTargets() {
    const sr = this.stage.getBoundingClientRect();
    const k = 1 / this.scale;
    const EDGE = 90;
    this._targets = [];
    for (const el of this.hud.querySelectorAll('[data-target]')) {
      const r = el.getBoundingClientRect();
      const id = el.dataset.target;
      let x = (r.left - sr.left) * k;
      let y = (r.top - sr.top) * k;
      let w = r.width * k;
      let h = r.height * k;
      // الهدف القريب من حافة الشاشة يمتد إليها: كف الطفل عند الحافة يبقى عليه
      if (x < EDGE) (w += x), (x = 0);
      if (this.VW - (x + w) < EDGE) w = this.VW - x;
      if (this.VH - (y + h) < EDGE) h = this.VH - y;
      const parts = id.split(':');
      const kind = el.dataset.kind || 'button';
      const team = kind === 'button' ? null : parts[1];
      const ref = kind === 'button' ? null : parts[2];
      this._els.set(id, el);
      this._targets.push({ id, kind, el, team, ref, rect: { x, y, w, h }, pad: kind === 'slot' ? 10 : 6, enabled: true });
    }
  }

  _updateHud() {
    const st = this.state;
    if (!st) return;
    if (this.$progress) {
      const T = st.teams.all;
      this.$progress.textContent = `🦠 ${ar(T.placed)} / ${ar(this.total)}`;
      this.$mist.textContent = `أخطاء: ${ar(this.mistakes)}`;
    }
    this.tickClock();
    for (const [id, ui] of Object.entries(this.$teams || {})) {
      const T = st.teams[id];
      if (ui.mist) ui.mist.textContent = `أخطاء: ${ar(T.mistakes)}`;
      if (ui.dots) {
        let h = '';
        for (let i = 0; i < this.total; i++) h += `<i class="${i < T.placed ? 'on' : ''}${i >= this.content.perRound.surface ? ' r2' : ''}"></i>`;
        ui.dots.innerHTML = h;
      }
    }
  }

  // ------------------------------------------------------------------ الحجرة
  /** حالة الحجرة: الشيء المعروض (رمزه واسمه) والضوء البنفسجي */
  _setBooth(id, patch) {
    const T = this.state?.teams[id];
    if (!T) return;
    Object.assign(T.booth, patch);
    this._paintBooth(id);
  }
  _paintBooth(id) {
    const T = this.state?.teams[id];
    const ui = this.$teams?.[id];
    if (!T || !ui) return;
    const el = ui.booth;
    const it = T.booth.item ? this.item[T.booth.item] : null;
    el.classList.toggle('uv', !!T.booth.uv);
    el.classList.toggle('has', !!it);
    // الرمز يظهر في الطبقة C دائمًا، وفي الجولة ٢ في كل الطبقات (المشهد ثلاثي الأبعاد يأتي بعد الصواب)
    // في A وB كل البطاقات (والجولة ٢) نماذج ثلاثية الأبعاد في العدسة؛ الرمز للطبقة C فقط
    el.classList.toggle('emoji', !!it && this.view.tier === 'C' && !T.booth.scene);
    el.querySelector('.gh-booth-emoji').textContent = it ? it.emoji : '';
    el.querySelector('.gh-booth-name').textContent = it ? it.name : '';
  }
  /** الشيء الذي يحمله الفريق الآن يظهر في الحجرة (آخر بطاقة التُقطت) */
  _syncPreview(id) {
    const T = this.state?.teams[id];
    if (!T || T.phase !== 'play' || T.show) return; // العدسة مشغولة بعرض: لا نقطعه بمجرد التقاط بطاقة
    const held = this._heldBy(id);
    let iid = held.has(T.lastPick) ? T.lastPick : [...held][0] || null;
    T.lastPick = iid;
    this._setBooth(id, { item: iid });
    this.view.preview(id, iid ? this.item[iid] : null);
  }
  _paintPhase(id) {
    const T = this.state?.teams[id];
    const ui = this.$teams?.[id];
    if (!T || !ui) return;
    const mid = T.phase === 'mid';
    ui.wrap.classList.toggle('busy', T.phase === 'busy');
    ui.wrap.classList.toggle('mid', mid);
    ui.prompt.classList.toggle('mid', mid);
    ui.dark.classList.toggle('show', mid);
    ui.over.classList.toggle('show', mid);
    for (const b of ui.bins) {
      b.classList.toggle('busy', T.phase === 'busy' || T.phase === 'done');
      b.classList.toggle('mid', mid);
    }
  }

  // ------------------------------------------------------------------ الحلقة
  _frame(now) {
    const dt = Math.min(0.1, (now - this._lastFrame) / 1000);
    this._lastFrame = now;
    if (this.cards) {
      // النماذج في الأيدي تتبعها، وخلفها ذيل لهب يشتد مع السرعة
      const held = [];
      for (const c of this.input?.cursors.values() || []) {
        const it = c.holding && this.item[c.holding];
        const key = it && cardKey(it);
        if (key && Number.isFinite(c.x)) held.push({ cid: c.id ?? c, key, x: c.x, y: c.y });
      }
      this.cards.setHeld(held);
      const rich = this.view.tier === 'A';
      if (!this.reduced) {
        for (const h of this.cards.carried) this.particles.trail(h.x, h.y, dt, Math.min(1, h.v / 900), rich);
        for (const f of this.cards.flying) this.particles.trail(f.x, f.y, dt, 1, rich);
      }
      this.cards.frame(now, dt, this.stage.getBoundingClientRect());
    }
    this._paintScales();
    this._multiplyTick(dt);
    this.particles.frame(dt, this.view.draw ? (c, d) => this.view.draw(c, d) : null);
  }

  /**
   * «الجراثيم تتكاثر»: إن بقيت بطاقة في يد الفريق أكثر من ٥ ث بلا تصنيف، تتضاعف الجراثيم على الشيء في
   * العدسة كل ١٫٥ ث (٨ ← ١٦ ← … ← ٥١٢)، مع تنبيه مرة واحدة. ضغط لعب لطيف يعلّم سرعة التكاثر.
   */
  _multiplyTick(dt) {
    if (!this.state || this.screen !== 'play' || this.state.cine || !this.view.multiply) return;
    for (const [id, T] of Object.entries(this.state.teams)) {
      const held = T.phase === 'play' && !T.show && this._heldBy(id).size > 0;
      if (!held) {
        T.holdT = 0;
        T.multN = 0;
        continue;
      }
      T.holdT = (T.holdT || 0) + dt;
      if (T.holdT < 5) continue;
      const step = Math.floor((T.holdT - 5) / 1.5);
      const n = Math.min(512, 8 * Math.pow(2, step));
      if (n !== T.multN) {
        T.multN = n;
        this.view.multiply(id, n);
        if (step === 0) this._flash(id, '⏳ الجراثيم تتكاثر بسرعة! كل جرثومة تصير اثنتين… صنّفوا الآن!', 'hint', 3200);
      }
    }
  }

  /** يحدّث درجة التكبير وشريط المقياس تحت كل عدسة */
  _paintScales() {
    if (!this.$teams || !this.state || !this.view.scaleInfo) return;
    for (const [id, ui] of Object.entries(this.$teams)) {
      const el = ui.scale;
      if (!el) continue;
      const info = this.state.teams[id]?.show ? this.view.scaleInfo(id) : null;
      el.classList.toggle('show', !!info);
      if (!info) continue;
      const key = `${info.mag}|${info.label || ''}|${Math.round(info.u || 0)}|${Math.round(info.cx)}`;
      if (el.dataset.k === key) continue;
      el.dataset.k = key;
      el.style.left = `calc(var(--u) * ${info.cx})`;
      el.style.top = `calc(var(--u) * ${info.y})`;
      el.querySelector('.gh-mag').textContent = info.mag;
      const bar = el.querySelector('.gh-bar');
      bar.style.display = info.u ? '' : 'none';
      if (info.u) {
        bar.querySelector('i').style.width = `calc(var(--u) * ${info.u.toFixed(1)})`;
        bar.querySelector('em').textContent = info.label;
      }
    }
  }

  // ------------------------------------------------------------------ الأفعال
  press(c, t) {
    if (t.kind === 'button') return this._button(t.id);
    if (t.kind !== 'card' || this.screen !== 'play' || !this.state || this.state.cine) return;
    const id = t.team;
    const T = this.state.teams[id];
    if (!T || T.phase !== 'play') return;
    const iid = t.ref;
    // البطاقة نفسها في اليد: لمسها ثانية يعيدها
    if (c.holding === iid && c.team === id) {
      c.holding = null;
      c.team = null;
      t.el.classList.remove('taken');
      sfx.back();
      this._syncPreview(id);
      return;
    }
    for (const o of this.input.cursors.values()) if (o !== c && o.holding === iid && o.team === id) return;
    if (c.holding) this._els.get(`card:${c.team}:${c.holding}`)?.classList.remove('taken');
    c.holding = iid;
    c.team = id;
    t.el.classList.add('taken');
    sfx.pick();
    T.lastPick = iid;
    this._syncPreview(id);
    const ask = this.content.rounds[T.r].ask;
    this._flash(id, `🧺 <b>${esc(this.item[iid].name)}</b>: ${esc(ask)}`, 'info', 2600);
  }

  drop(c, t) {
    if (this.screen !== 'play' || !this.state || this.state.cine || !c.holding || t.kind !== 'slot') return;
    const id = c.team;
    const T = this.state.teams[id];
    if (!T || t.team !== id || T.phase !== 'play') return;
    const it = this.item[c.holding];
    if (!it || it.round !== this.content.rounds[T.r].id) return;
    const binEl = t.el;
    if (it.cat !== t.ref) return this._wrong(T, it, binEl);
    // صواب
    c.holding = null;
    c.team = null;
    T.left = T.left.filter((x) => x !== it.id);
    T.placed++;
    T.lastPick = null;
    // لا تجميد: بطاقات الفريق تبقى قابلة للسحب أثناء عرض العدسة (انظر _startShow)
    T.msg = null;
    binEl.classList.remove('hint');
    binEl.classList.add('good');
    this.later(() => binEl.classList.remove('good'), 700);
    sfx.correct();
    const R = binEl.getBoundingClientRect();
    const sr = this.stage.getBoundingClientRect();
    const bx = (R.left - sr.left) / this.scale;
    const by = (R.top - sr.top) / this.scale;
    const bw = R.width / this.scale;
    const bh = R.height / this.scale;
    this.particles.ring(bx + bw / 2, by + bh / 2, Math.min(bw, bh) / 2, TEAMS[id].color);
    // اللحظة السينمائية: لهب يشتعل من السلة التي وُضعت فيها البطاقة، ووهج دافئ عليها
    // يشتعل من الحافة العليا ويصعد فوقها: السلة تبقى مقروءة وقابلة للإفلات (اللعب لا يتوقف)
    this.particles.flame(bx + bw * 0.15, by - 4, bw * 0.7, bh * 0.55, { rich: this.view.tier === 'A' });
    this._snd(id, 'flame');
    binEl.classList.remove('fire');
    void binEl.offsetWidth;
    binEl.classList.add('fire');
    this.later(() => binEl.classList.remove('fire'), 1400);
    // كرة النار: النموذج ينطلق من السلة في قوس إلى العدسة (حيث يظهر تحت الضوء البنفسجي)
    const lens = this.view.lensCenter?.(id);
    if (this.cards && lens) this.cards.fly(cardKey(it), { x: bx + bw / 2, y: by - 10 }, lens, 850);
    this._fillTeam(id);
    this._paintPhase(id);
    this._collectTargets();
    this._startShow(T, it);
    if (it.round === 'surface') this._uvTest(T, it);
    else this._spreadScene(T, it);
  }

  _wrong(T, it, binEl) {
    const id = T.id;
    T.mistakes++;
    T.byItem[it.id] = (T.byItem[it.id] || 0) + 1;
    T.wrong[it.id] = (T.wrong[it.id] || 0) + 1;
    this._snd(id, 'bonk');
    binEl.classList.remove('shake');
    void binEl.offsetWidth;
    binEl.classList.add('shake');
    this.view.shake(id);
    this.$teams[id]?.booth.classList.remove('shake');
    void this.$teams[id]?.booth.offsetWidth;
    this.$teams[id]?.booth.classList.add('shake');
    if (T.wrong[it.id] >= 2) {
      this._els.get(`bin:${id}:${it.cat}`)?.classList.add('hint');
      this._flash(id, `تلميح: ${esc(it.wrong)} السلة <b>المضيئة</b> ✨`, 'hint', 3200);
    } else {
      this._flash(id, `${esc(it.wrong)} جرّبوا السلة الأخرى 🙂`, 'bad', 3000);
    }
    this._updateHud();
  }

  /** الجولة ١ بعد الصواب: المصباح يكشف الجراثيم، ثم الهواء يختبر السطح (≈ ٤ ث، بلا أهداف للفريق) */
  _uvTest(T, it) {
    const id = T.id;
    const rough = it.cat === 'rough';
    this._setBooth(id, { item: it.id, uv: true });
    this.view.preview(id, it);
    this.view.lampOn(id);
    this._snd(id, 'lamp');
    this._flash(id, '🔦 نضيء الضوء البنفسجي… هل عليه جراثيم؟', 'reveal', 60000);
    this._showLater(T, () => this.view.cling(id), this._d(250));
    this._showLater(T, () => {
      say(it.name);
      this._flash(id, `✨ ظهرت جراثيم كانت مختفية على <b>${esc(it.name)}</b>!`, 'reveal', 60000);
    }, this._d(1000));
    // اللحظة المدهشة (الطبقتان A وB): العدسة تغوص في السطح بتكبير هائل
    const micro = this.view.tier !== 'C' && !!this.view.dive;
    if (micro) {
      // ثلاث محطات تكبير، وتحت العدسة درجة التكبير وشريط مقياس بالميكرومتر
      this._showLater(T, () => {
        this.view.dive(id, it);
        this._flash(id, `🔬 تكبير ×١٠: نقترب من سطح <b>${esc(it.name)}</b>…`, 'reveal', 60000);
      }, this._d(1700));
      this._showLater(T, () => {
        this.view.zoomTo(id, 2);
        this._flash(id, rough ? '🔬 تكبير ×١٠٠: السطح جبال ووديان!' : '🔬 تكبير ×١٠٠: السطح سهل أملس.', 'reveal', 60000);
      }, this._d(2900));
      this._showLater(T, () => {
        this.view.zoomTo(id, 3);
        this._flash(id, '🦠 تكبير ×١٠٠٠: هذه جراثيم! طول الواحدة نحو ميكرومترين فقط.', 'reveal', 60000);
      }, this._d(4500));
      this._showLater(T, () => this.view.zoomTo(id, 2), this._d(6600));
    }
    const tBlow = micro ? 7500 : 1900;
    this._showLater(T, () => {
      this._snd(id, 'fan');
      this.view.blow(id, rough ? 0.86 : 0.14);
      this._flash(id, rough ? '💨 ننفخ الهواء… هل تختبئ الجراثيم في الوديان؟' : '💨 ننفخ الهواء على السطح الأملس…', 'reveal', 60000);
    }, this._d(tBlow));
    this._showLater(T, () => {
      this._snd(id, 'shimmer');
      const lead = rough ? '🦠 <b>سطح خشن:</b> بقيت الجراثيم عالقة بين النتوءات!' : '💨 <b>سطح ناعم:</b> انزلقت معظم الجراثيم وطارت.';
      this._flash(id, `${lead} ${esc(it.fact)}`, 'reveal', 60000);
    }, this._d(tBlow + 1400));
    this._showLater(T, () => this._endShow(T), this._d(tBlow + (micro ? 4000 : 3700)));
  }

  /** الجولة ٢ بعد الصواب: مشهد قصير يكشف ما يحدث للجراثيم (≈ ٤ ث) */
  _spreadScene(T, it) {
    const id = T.id;
    this._setBooth(id, { item: it.id, uv: true, scene: this.view.tier !== 'C' });
    this.view.lampOn(id);
    this._snd(id, 'lamp');
    this.view.vignette(id, it);
    this._flash(id, `🔦 <b>${esc(it.name)}</b>… ماذا يحدث للجراثيم؟`, 'reveal', 60000);
    this._showLater(T, () => say(it.name), this._d(600));
    // غسل اليدين (A وB): نغوص إلى جرثومة واحدة فنرى جزيئات الصابون تفكّك غلافها
    const soap = it.scene === 'wash' && this.view.tier !== 'C' && !!this.view.soap;
    if (soap) {
      this._showLater(T, () => {
        this.view.soap(id);
        this._flash(id, '🔬 نقترب أكثر: جزيئات الصابون تقترب من الجرثومة…', 'reveal', 60000);
      }, this._d(2100));
      this._showLater(T, () => {
        this._snd(id, 'bubbles');
        this._flash(id, '🧼 الصابون يفكّك غلاف الجرثومة… والماء يحملها بعيدًا!', 'reveal', 60000);
      }, this._d(4400));
    }
    // العطاس: آلاف القطرات تتطاير بعيدًا
    if (it.scene === 'spray' && this.view.tier !== 'C') {
      this._showLater(T, () => this._flash(id, '💦 انظروا: آلاف القطرات الصغيرة تطير بعيدًا وتسقط على الأسطح!', 'reveal', 60000), this._d(1500));
    }
    this._showLater(T, () => {
      this._snd(id, 'shimmer');
      const lead = it.cat === 'spread' ? '🦠 <b>ينشر الجراثيم:</b>' : '🛡️ <b>يمنع انتشارها:</b>';
      this._flash(id, `${lead} ${esc(it.fact)}`, 'reveal', 60000);
    }, this._d(soap ? 6400 : 3000));
    this._showLater(T, () => this._endShow(T), this._d(soap ? 9200 : 5600));
  }

  /** البطاقة التالية، أو «أطفئوا الأنوار» بين الجولتين، أو نهاية الفريق */
  _next(T) {
    if (!this.state || this.screen !== 'play') return;
    const id = T.id;
    T.msg = null;
    if (T.left.length) {
      // (احتياط) ما زالت بطاقات: يستمر اللعب
      T.phase = 'play';
      this._fillTeam(id);
      this._paintPhase(id);
      this._syncPreview(id);
      this._collectTargets();
      return;
    }
    if (T.r === 0) return this._midgame(T);
    this._teamDone(T);
  }

  /** حدث منتصف اللعبة (≈ ٦ ث، بلا أهداف للفريق): إطفاء الأنوار، ويدان «نظيفتان» تتوهّج عليهما الجراثيم. */
  _midgame(T) {
    const id = T.id;
    const ui = this.$teams[id];
    T.phase = 'mid';
    this._releaseTeam(id);
    this._paintPhase(id);
    this._collectTargets();
    this._say(id, null);
    fxs.lightsOut();
    this.view.midHands(id, true);
    // النص محفوظ في حالة الفريق: إعادة الرسم (حين ينهي الفريق الآخر منتصفه) لا تمحوه
    const line = (h) => {
      T.midHtml = h;
      if (this.$teams[id]) this.$teams[id].over.innerHTML = h;
    };
    line('<b>🔦 أطفئوا الأنوار!</b>');
    this.later(() => line('<b>🔦 أطفئوا الأنوار!</b><span>يدان تبدوان نظيفتين…</span>'), this._d(1300));
    this.later(() => {
      fxs.shimmer();
      line('<b>✨ لكن تحت الضوء البنفسجي تظهر الجراثيم!</b><span>الجراثيم أصغر من أن نراها بالعين المجرّدة.</span>');
    }, this._d(2700));
    this.later(() => line('<b>🦠 الجراثيم على أجسامنا وعلى أشياء تبدو نظيفة.</b><span>فكيف تنتشر؟ وكيف نمنعها؟</span>'), this._d(4600));
    this.later(() => {
      this.view.midHands(id, false);
      T.midHtml = '';
      T.r = 1;
      T.left = [...T.rounds[1]];
      T.phase = 'play';
      T.wrong = {};
      music.faster();
      fxs.boom();
      if (ui) this.render();
      this._flash(id, '🛡️ الجولة الثانية: <b>تنشر أم تمنع؟</b>', 'info', 3000);
    }, this._d(6600));
  }

  _teamDone(T) {
    const st = this.state;
    T.end = performance.now();
    T.phase = 'done';
    if (st.race && !st.winner) {
      st.winner = T.id;
      sfx.win();
      const b = this.L[T.id].booth;
      this.particles.burst(b.x + b.w / 2, b.y + b.h / 2, TEAMS[T.id].color, 70);
    }
    this._fillTeam(T.id);
    this._paintPhase(T.id);
    this._collectTargets();
    if (Object.values(st.teams).every((x) => x.phase === 'done')) {
      st.end = performance.now();
      this.later(() => this._finale(), this._d(900));
    }
  }

  /** الختام السينمائي (٢٫٤ ث): قصاصات، «أحسنتم يا صيّادي الجراثيم!»، اسم الفائز، ثم النتيجة. */
  _finale() {
    const st = this.state;
    st.cine = true;
    music.stop();
    fxs.boom();
    sfx.win();
    this.particles.confetti(this.VW);
    const win = st.race && st.winner ? `<div class="cine-sub" style="--team:${TEAMS[st.winner].color}">🏆 ${esc(TEAMS[st.winner].name)}</div>` : '';
    // وسام لكل فريق: «صيّاد الجراثيم» بنجوم حسب أخطائه (المهمة اكتملت)
    const medals = Object.entries(st.teams)
      .map(([id, T]) => {
        const stars = T.mistakes === 0 ? 3 : T.mistakes <= 2 ? 2 : 1;
        return `<div class="gh-medal" style="--team:${TEAMS[id].color}"><i></i><b>وسام صيّاد الجراثيم</b><span>${esc(TEAMS[id].name)}</span><em>${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</em></div>`;
      })
      .join('');
    this._cine(`<div class="cine-bar top"></div><div class="cine-bar bottom"></div><div class="cine-title">أحسنتم يا صيّادي الجراثيم!</div>${win}<div class="gh-medals">${medals}</div>`, 'finale');
    this.later(() => {
      this._cine(null);
      st.cine = false;
      this.screen = 'done';
      st.medals = true;
      this.input?.reset();
      this.view.reset();
      this._applyPending();
      this.render();
    }, this._d(3600)); // وقت أطول لقراءة الأوسمة
  }

  /** أي يد من الفريق تحمل بطاقة تُفرغ (تبدّلت الجولة ولم يعد لها مكان) */
  _releaseTeam(id) {
    for (const o of this.input?.cursors.values() || []) {
      if (o.team === id && o.holding) {
        o.holding = null;
        o.team = null;
      }
    }
  }

  cancel(c) {
    const id = c.team;
    if (c.holding) this._els.get(`card:${c.team}:${c.holding}`)?.classList.remove('taken');
    c.holding = null;
    c.team = null;
    if (id) this._syncPreview(id);
  }

  _button(id) {
    sfx.click();
    if (id === 'opt:solo' || id === 'opt:race') {
      this.opts.race = id === 'opt:race';
      return this.render();
    }
    if (id === 'start' || id === 'again') return this.newGame();
    if (id === 'menu') return this.toMenu();
  }

  // ------------------------------------------------------------------ النتيجة
  _renderDone() {
    const st = this.state;
    if (!st) return;
    const { top, bottom, left, right } = this._band();
    const head = html('header', 'hud-header');
    head.appendChild(html('h1', 'title small gh-title', `🔦 ${esc(this.content.title)}`));
    this.hud.appendChild(head);
    // لوحة نصائح الصيّادين (النشاط ٢: أقدّم نصيحة لزملائي)
    const trayH = 240;
    const boardTop = Math.max(top, 110);
    const boardH = bottom - trayH - 20 - boardTop;
    const tips = this._place(html('div', 'gh-tips'), left, boardTop, right - left, boardH);
    tips.innerHTML = `<div class="gh-tips-title">🛡️ نصائح صيّادي الجراثيم لزملائهم</div>
      <div class="gh-tips-row">${this.content.tips.map((t) => `<div class="gh-tip"><span>${esc(t.emoji)}</span><b>${esc(t.text)}</b></div>`).join('')}</div>
      <div class="gh-tips-note">✋ تذكّروا: جلدنا <b>خشن</b>، فتعلق عليه الجراثيم… والجراثيم قد توجد على أشياء <b>تبدو نظيفة</b>.</div>`;
    this.hud.appendChild(tips);

    const total = this.total * Object.keys(st.teams).length;
    const m = this.mistakes;
    const stars = m === 0 ? 3 : m <= Math.ceil(total * 0.15) ? 2 : 1;
    const panel = this._place(html('div', 'result'), left, bottom - trayH, right - left, trayH);
    const teamsHtml = st.race
      ? Object.keys(st.teams)
          .map((id) => `<span class="res-team" style="--team:${TEAMS[id].color}">${TEAMS[id].name}: <b>${fmtTime(st.teams[id].end - st.start)}</b> • أخطاء <b>${ar(st.teams[id].mistakes)}</b></span>`)
          .join('')
      : `<span>الوقت <b>${fmtTime(st.end - st.start)}</b></span><span>الأخطاء <b>${ar(m)}</b></span><span>الدقة <b>${ar(Math.round((100 * total) / Math.max(total, total + m)))}٪</b></span>`;
    // «راجعوا…»: أكثر ما وقع فيه الخطأ
    const agg = {};
    for (const T of Object.values(st.teams)) for (const [k, v] of Object.entries(T.byItem)) agg[k] = (agg[k] || 0) + v;
    const worst = Object.entries(agg).sort((a, b) => b[1] - a[1])[0];
    let review = '';
    if (worst) {
      const it = this.item[worst[0]];
      if (it.id === 'hand') review = 'راجعوا: لماذا نقول إن <b>جلدنا خشن</b>؟';
      else if (it.round === 'surface') review = `راجعوا: هل سطح <b>${esc(it.name)}</b> خشن أم ناعم؟`;
      else review = `راجعوا: <b>${esc(it.name)}</b> ${it.cat === 'spread' ? 'ينشر الجراثيم' : 'يمنع انتشارها'}`;
    }
    panel.innerHTML = `
      <div class="res-main">
        <div class="stars">${[1, 2, 3].map((i) => `<span class="star${i <= stars ? ' on' : ''}">★</span>`).join('')}</div>
        <div class="res-msg">${stars === 3 ? 'ممتاز! بلا أي خطأ' : stars === 2 ? 'أحسنتم!' : 'جيد — جرّبوا مرة أخرى'}</div>
        ${st.race && st.winner ? `<div class="winner">🏆 الفائز: ${TEAMS[st.winner].name}</div>` : ''}
      </div>
      <div class="res-stats">${teamsHtml}${review ? `<span class="gh-review">${review}</span>` : ''}</div>`;
    const btns = html('div', 'res-btns');
    const again = html('div', 'opt start', '<b>العبوا مجددًا</b>');
    again.dataset.target = 'again';
    const menu = html('div', 'opt', '<b>القائمة</b>');
    menu.dataset.target = 'menu';
    btns.append(again, menu);
    panel.appendChild(btns);
    this.hud.appendChild(panel);
  }

  /** البطاقة المحمولة تحت اليد: هالة محايدة (لا تكشف السلة الصحيحة) ورمز الشيء واسمه. */
  heldIcon(iid, team) {
    const it = this.item[iid];
    const teamed = team && team !== 'all';
    const g = svg('g', { class: 'held-item gh-held', 'data-team': teamed ? team : null });
    if (teamed) g.style.setProperty('--team', TEAMS[team].color);
    // في A وB: النموذج الحيّ نفسه يتبع اليد (cards3d.js)؛ هنا الاسم فقط تحته
    if (this.cards) {
      const lb = svg('text', { y: 112, 'text-anchor': 'middle', class: 'gh-held-label' });
      lb.textContent = it?.name || '';
      g.appendChild(lb);
      return g;
    }
    // بطاقة صغيرة مائلة كأنها مرفوعة من الطاولة: ظلّ، وسُمك، ووجه، وشريط علوي محايد
    const card = svg('g', { class: 'gh-held-card', transform: 'rotate(-7)' });
    card.appendChild(svg('rect', { x: -66, y: -58, width: 132, height: 150, rx: 22, class: 'gh-held-shadow', transform: 'translate(10 16)' }));
    card.appendChild(svg('rect', { x: -66, y: -66, width: 132, height: 158, rx: 22, class: 'gh-held-edge' }));
    card.appendChild(svg('rect', { x: -66, y: -70, width: 132, height: 154, rx: 22, class: 'gh-held-face' }));
    card.appendChild(svg('rect', { x: -66, y: -70, width: 132, height: 16, rx: 8, class: 'gh-held-band' }));
    const thumb = this.view.thumbs?.[it?.model];
    if (thumb) {
      card.appendChild(svg('image', { href: thumb, x: -52, y: -60, width: 104, height: 104, class: 'gh-held-thumb' }));
    } else {
      const em = svg('text', { y: -6, 'text-anchor': 'middle', 'dominant-baseline': 'middle', class: 'gh-held-emoji' });
      em.textContent = it?.emoji || '🃏';
      card.appendChild(em);
    }
    const lb = svg('text', { y: 120, 'text-anchor': 'middle', class: 'gh-held-label' }); // الاسم تحت البطاقة (الأسماء الطويلة لا تتسع داخلها)
    lb.textContent = it?.name || '';
    card.appendChild(lb);
    g.appendChild(card);
    return g;
  }

}
