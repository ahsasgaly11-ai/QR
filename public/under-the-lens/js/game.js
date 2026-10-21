// ---------------------------------------------------------------------------
// «عالَمٌ تحت العدسة» — لعبة سبورة: لكل فريق (أو للصف كله) طبق عليه عيّنة غامضة
// أصغر من أن تُرى. يلتقط الطالب العدسة المكبّرة بيده ويضعها على الطبق، فتطير
// العدسة ثلاثية الأبعاد إليه وتتضح الصورة تدريجيًا (ضبط التركيز)، ثم يلمس اسم ما يراه.
// في منتصف الجولة تصير العيّنات «أصغر من أن تكفيها العدسة» فيُفتح المجهر.
//
// ناتج التعلّم: التكبير يجعلنا نرى الشيء بوضوح أكبر؛ نكبّر بالعدسة المكبّرة أو
// بالمجهر، والمجهر يكبّر أكثر بكثير (للأشياء الصغيرة جدًا).
//
// يطبّق عقد اللعبة في board-kit (راجع /board-kit/README_AR.md):
//   الأهداف: بطاقات الأدوات (تُلتقط)، والطبق (خانة إفلات دائرية)، وبطاقات الإجابة (تُلمس).
//   في السباق: نصف الشاشة لكل فريق بطبقه وأدواته وبطاقاته ولونه، ولا يقبل طبقه إلا أدواته.
//
// الطبقات: #board (زخرفة SVG) ← #ul-scope (الأطباق) ← #ul-gl (three.js شفّافة)
//          ← #hud (البطاقات والنصوص) ← #ul-fx (جسيمات) ← #ul-cine (افتتاح/ختام) ← #fx (الأيدي)
// ---------------------------------------------------------------------------
import { sfx, say } from '/board-kit/js/audio.js';
import { drawView, getArt } from './art.js';
import { fxs, music, setFxSound, Particles } from './fx.js';

const NS = 'http://www.w3.org/2000/svg';
const TEAMS = {
  a: { name: 'الفريق الأول', short: 'الأول', color: '#8a1538' },
  b: { name: 'الفريق الثاني', short: 'الثاني', color: '#0e7490' },
  all: { name: 'المستكشفون', short: 'المستكشفون', color: '#0f5f5a' },
};
const ar = (n) => Number(n).toLocaleString('ar-EG');
const fmtTime = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${ar(Math.floor(s / 60))}:${ar(String(s % 60).padStart(2, '0')).padStart(2, '٠')}`;
};
const shuffle = (a) => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
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

export class Game {
  constructor({ stage, board, hud, fx }, content) {
    Object.assign(this, { stage, board, hud, fx, content });
    this.VH = 1000;
    this.VW = 1600;
    this.scale = 1;
    this.settings = {};
    this.input = null;
    this.screen = 'menu';
    this.opts = { race: true }; // الطلب الأساسي: طالبان، كلٌّ في طرف
    this.state = null;
    this.L = {};
    this._targets = [];
    this._els = new Map();
    this._hoverOn = new Set();
    this._timers = new Set();
    this.item = Object.fromEntries(content.items.map((i) => [i.id, i]));
    this.reduced = reducedMotion();

    // طبقات دائمة (لا يمسحها render)
    this.$scope = html('div', 'ul-scope');
    this.$gl = html('canvas', 'ul-gl');
    this.$px = html('canvas', 'ul-px');
    this.$cine = html('div', 'ul-cine');
    stage.insertBefore(this.$scope, hud);
    stage.insertBefore(this.$gl, hud);
    stage.insertBefore(this.$px, fx);
    stage.insertBefore(this.$cine, fx);
    this.particles = new Particles(this.$px);
    this.scene = null;
    // three.js يُحمَّل ديناميكيًا: إن تعذّر (جهاز بلا WebGL) تعمل اللعبة كاملة بلا أبعاد ثلاثة
    import('./scene3d.js')
      .then(({ createScene }) => {
        this.scene = createScene(this.$gl);
        if (this.scene) {
          this.scene.reduced = this.reduced;
          this.render();
        }
      })
      .catch(() => {
        this.scene = null;
      });
    this._lastFrame = performance.now();
    const loop = (now) => {
      this._frame(now);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
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
    // فريق في مشهد (تكبير، كشف، فتح المجهر) لا أهداف له حتى ينتهي
    return this._targets.filter((t) => !t.team || !st.teams[t.team] || !this._busy(st.teams[t.team]));
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
    this.scene?.reset();
    this.render();
  }
  tickClock() {
    const soundOn = this.settings.sound !== false;
    setFxSound(soundOn);
    // الموسيقى تبدأ بعد أول لمسة للجهاز (شرط iOS) وتعود إن أعاد المعلم تشغيل الصوت
    const st = this.state;
    if (soundOn && st && this.screen === 'play' && !st.cine && !music.on) music.start(Object.values(st.teams).some((t) => t.level > 1));
    if (this.$time && this.state) this.$time.textContent = `⏱ ${fmtTime((this.state.end || performance.now()) - this.state.start)}`;
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
    clearTimeout(this._msgT);
  }
  _busy(T) {
    return T.phase === 'zoom' || T.phase === 'reveal' || T.phase === 'unlock';
  }
  _d(ms) {
    return this.reduced ? Math.round(ms * 0.35) : ms;
  }

  // ------------------------------------------------------------------ التخطيط
  _band() {
    const headerH = 96;
    const side = Math.round((this.settings.sideInset || 0) * this.VW) + 30;
    return {
      top: Math.max(headerH + 8, Math.round((this.settings.reachTop || 0) * this.VH)),
      bottom: this.VH - 14,
      left: side,
      right: this.VW - side,
    };
  }

  /** مواضع كل فريق: الطبق، وسطر الرسائل، والبطاقات، وأماكن الأدوات ثلاثية الأبعاد. */
  _layout() {
    const { top, bottom, left, right } = this._band();
    const mid = this.VW / 2;
    const ids = this.state ? Object.keys(this.state.teams) : [];
    this.L = {};
    for (const id of ids) {
      const x0 = id === 'a' ? mid + 14 : left; // الفريق الأول يمينًا (بداية القراءة)
      const x1 = id === 'b' ? mid - 14 : right;
      const w = x1 - x0;
      const barH = 46;
      const cardH = clamp((bottom - top) * 0.2, 150, 180);
      const trayH = cardH + barH + 6;
      const trayTop = bottom - trayH;
      const promptH = 76;
      const promptTop = trayTop - 10 - promptH;
      const avail = promptTop - 14 - (top + 6);
      const r = Math.round(Math.max(60, Math.min(avail / 2, w * 0.3, 270)));
      const cx = (x0 + x1) / 2;
      const cy = promptTop - 14 - r;
      const outward = id === 'b' ? -1 : 1;
      const side = w / 2 - r;
      const size = clamp(Math.min(side * 1.15, r * 1.0), 100, 240);
      const off = r + side / 2;
      this.L[id] = {
        x0, x1, w, top, trayTop, trayH, barH, promptTop, promptH,
        plate: { x: cx, y: cy, r },
        // العدسة في الزاوية الخارجية العليا (مقبضها نحو الخارج والأسفل)، والمجهر في الجهة الداخلية
        lensHome: { x: clamp(cx + outward * off, x0 + size * 0.36, x1 - size * 0.36), y: cy - r * 0.5 },
        scopeHome: { x: cx - outward * off, y: cy + r * 0.12 },
        outward, size,
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
    this.$plates = {};
    this.stage.dataset.screen = this.screen;
    this.particles.resize(r.width, r.height, this.scale);
    this._decorate();
    if (this.screen === 'menu') this._renderMenu();
    else if (this.screen === 'play') this._renderPlay();
    else this._renderDone();
    if (this.scene) {
      this.scene.layout(r.width, r.height, this.VW, this.VH);
      this._syncScene();
    }
    const layer = svg('g', { class: 'cursors' });
    this.fx.appendChild(layer);
    this.input?.attachLayer(layer);
    this._collectTargets();
  }

  /** خلفية المختبر: ورق مربّعات خفيف ودوائر ضوء كأنها من عدسة */
  _decorate() {
    const b = this.board;
    const defs = svg('defs');
    const pat = svg('pattern', { id: 'ulgrid', width: 40, height: 40, patternUnits: 'userSpaceOnUse' });
    pat.appendChild(svg('path', { d: 'M40 0H0V40', fill: 'none', stroke: '#0f5f5a', 'stroke-opacity': '0.07', 'stroke-width': 2 }));
    defs.appendChild(pat);
    b.appendChild(defs);
    b.appendChild(svg('rect', { width: this.VW, height: this.VH, fill: 'url(#ulgrid)' }));
    const bokeh = [[0.08, 0.2, 90], [0.93, 0.16, 70], [0.5, 0.06, 50], [0.2, 0.62, 40], [0.82, 0.58, 55]];
    for (const [fx, fy, rr] of bokeh) b.appendChild(svg('circle', { cx: fx * this.VW, cy: fy * this.VH, r: rr, class: 'ul-bokeh' }));
    if (this.screen === 'play' && this.state?.race) {
      const { top } = this._band();
      b.appendChild(svg('line', { x1: this.VW / 2, y1: top, x2: this.VW / 2, y2: this.VH - 10, class: 'ul-divider' }));
    }
  }

  // ------------------------------------------------------------------ القائمة
  _renderMenu() {
    const { left, right } = this._band();
    const head = html('header', 'hud-header menu-head');
    head.append(html('h1', 'title ul-title', esc(this.content.title)), html('p', 'lead', esc(this.content.lead)));
    this.hud.appendChild(head);
    const how = html('div', 'ul-how');
    how.innerHTML = `
      <span><i>🔍</i>التقط العدسة</span><b>←</b>
      <span><i>🫧</i>ضعها على العيّنة</span><b>←</b>
      <span><i>👀</i>اكتشف ما هي</span><b>←</b>
      <span><i>🔬</i>ثم يُفتح المجهر!</span>`;
    this.hud.appendChild(how);
    const panel = html('div', 'menu-panel');
    Object.assign(panel.style, { left: `calc(var(--u) * ${left + 20})`, right: `calc(var(--u) * ${this.VW - right + 20})` });
    const row = html('div', 'menu-row');
    const race = html('div', `opt${this.opts.race ? ' on' : ''}`, '<b>سباق طالبين</b><small>كلٌّ في طرف بعدسته وعيّناته</small>');
    race.dataset.target = 'opt:race';
    const solo = html('div', `opt${this.opts.race ? '' : ' on'}`, '<b>الصف كله</b><small>طبق واحد للجميع</small>');
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
    if (this.scene) this.scene.reduced = this.reduced;
    this.particles.reduced = this.reduced;
    const { perLevel, items } = this.content;
    const pick = (lv) => shuffle(items.filter((i) => i.level === lv)).slice(0, perLevel[lv]).map((i) => i.id);
    const set1 = pick(1);
    const set2 = pick(2);
    const teamIds = this.opts.race ? ['a', 'b'] : ['all'];
    const teams = {};
    for (const id of teamIds) {
      // العيّنات نفسها للفريقين (عدالة) بترتيب مختلف (فلا ينقل أحدهما عن الآخر)
      teams[id] = {
        id, queue: [...shuffle(set1), ...shuffle(set2)], idx: 0, level: 1, phase: 'look',
        mistakes: 0, toolMistakes: 0, toolWrong: 0, guessWrong: 0, byItem: {}, placed: 0, end: 0,
        options: [], view: { zoom: 0, focus: 0 }, anim: null, msg: null,
      };
    }
    this.state = { race: this.opts.race, teams, start: performance.now(), end: 0, winner: null, cine: true };
    this.screen = 'play';
    this.input?.reset();
    this._clearTimers();
    this.scene?.reset();
    this.render();
    this._intro();
  }

  /** الافتتاح السينمائي (٢٫٣ ث): أشرطة، سطر تمهيدي، عنوان يتّسع مع ومضة، الأدوات تطير إلى أماكنها. لا أهداف أثناءه. */
  _intro() {
    const st = this.state;
    this._cine(`
      <div class="cine-bar top"></div><div class="cine-bar bottom"></div>
      <div class="cine-pre">في مختبر المستكشفين الصغار…</div>
      <div class="cine-title">${esc(this.content.title)}</div>
      <div class="cine-flash"></div>`, 'intro');
    this.scene?.intro();
    fxs.whoosh(0.9);
    this.later(() => fxs.boom(), this._d(900));
    this.later(() => {
      this._cine(null);
      st.cine = false;
      music.start();
      for (const id of Object.keys(st.teams)) this._say(id, null);
      this._collectTargets();
    }, this._d(2300));
  }

  _cine(inner, kind = '') {
    if (!inner) {
      this.$cine.className = 'ul-cine';
      this.$cine.replaceChildren();
      return;
    }
    this.$cine.innerHTML = inner;
    this.$cine.className = `ul-cine show ${kind}${this.reduced ? ' reduced' : ''}`;
  }

  get mistakes() {
    return this.state ? Object.values(this.state.teams).reduce((s, t) => s + t.mistakes, 0) : 0;
  }
  get total() {
    const { perLevel } = this.content;
    return perLevel[1] + perLevel[2];
  }

  // ------------------------------------------------------------------ اللعب
  _renderPlay() {
    const st = this.state;
    this._layout();
    const head = html('header', 'hud-header');
    head.appendChild(html('h1', 'title small ul-title', esc(this.content.title)));
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
    this.$teams = {};
    for (const id of Object.keys(st.teams)) this._renderTeam(id);
    this._updateHud();
  }

  _renderTeam(id) {
    const st = this.state;
    const T = st.teams[id];
    const L = this.L[id];
    const team = TEAMS[id];
    const ui = (this.$teams[id] = {});
    const { plate } = L;
    // الطبق (خانة الإفلات): في طبقة تحت الأبعاد الثلاثة، فيلمع زجاج العدسة فوق الصورة
    const p = this._place(html('div', 'ul-plate'), plate.x - plate.r, plate.y - plate.r, plate.r * 2, plate.r * 2);
    p.style.setProperty('--team', team.color);
    if (st.race) p.dataset.team = id;
    const cv = html('canvas');
    const dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = cv.height = Math.max(64, Math.round(plate.r * 2 * this.scale * dpr));
    p.appendChild(cv);
    p.appendChild(html('div', 'ul-plate-q', '؟'));
    this.$scope.appendChild(p);
    this.$plates[id] = { el: p, cv, ctx: cv.getContext('2d'), dirty: true };
    this._els.set(`plate:${id}`, p);
    // شارة التكبير
    ui.badge = this._place(html('div', 'ul-badge'), plate.x + plate.r * 0.55, plate.y - plate.r * 0.98, 150, 64);
    this.hud.appendChild(ui.badge);
    // قفل المجهر
    ui.lock = this._place(html('div', 'ul-lock', '🔒'), L.scopeHome.x - 36, L.scopeHome.y - L.size * 0.62, 72, 72);
    this.hud.appendChild(ui.lock);
    // سطر التعليمات والرسائل
    ui.prompt = this._place(html('div', 'ul-prompt'), L.x0, L.promptTop, L.w, L.promptH);
    ui.prompt.style.setProperty('--team', team.color);
    this.hud.appendChild(ui.prompt);
    // البطاقات وشريط الفريق
    const wrap = this._place(html('div', 'tray-wrap ul-wrap'), L.x0, L.trayTop, L.w, L.trayH);
    wrap.style.setProperty('--team', team.color);
    if (st.race) wrap.dataset.team = id;
    const bar = html('div', 'team-bar', `<b>${esc(team.name)}</b><span class="ul-jars"></span><span class="tb-mist"></span>`);
    wrap.appendChild(bar);
    ui.jars = bar.querySelector('.ul-jars');
    ui.mist = bar.querySelector('.tb-mist');
    ui.tray = html('div', 'ul-tray');
    wrap.appendChild(ui.tray);
    this.hud.appendChild(wrap);
    ui.wrap = wrap;
    this._fillTeam(id);
  }

  /** يعيد ملء بطاقات الفريق حسب مرحلته. معرّفات الأهداف ثابتة فلا ينقطع بقاء اليد. */
  _fillTeam(id) {
    const T = this.state.teams[id];
    const ui = this.$teams?.[id];
    if (!ui) return;
    const tray = ui.tray;
    tray.replaceChildren();
    const sample = this.item[T.queue[T.idx]];
    const L = this.L[id];
    const held = new Set([...(this.input?.cursors.values() || [])].filter((c) => c.team === id).map((c) => c.holding));
    const compact = L.w / 3 < (L.trayH - L.barH) * 1.6;
    tray.classList.toggle('compact', compact);
    const tools = this.content.tools;
    if (T.phase === 'look' || T.phase === 'zoom') {
      tray.style.setProperty('--n', 2);
      for (const key of ['lens', 'scope']) {
        const tl = tools[key];
        const locked = key === 'scope' && T.level < 2;
        const card = html('div', `card ul-card ul-tool${locked ? ' locked' : ''}${held.has(key) ? ' taken' : ''}`);
        card.innerHTML = `<span class="ul-emoji">${tl.emoji}</span><div class="card-body"><b>${esc(tl.name)}</b><small>${locked ? 'مقفل الآن 🔒' : `تكبير ${tl.mag}`}</small></div>`;
        card.dataset.target = `tool:${id}:${key}`;
        card.dataset.kind = 'card';
        if (T.phase === 'zoom') card.classList.add('dim');
        tray.appendChild(card);
        this._els.set(card.dataset.target, card);
      }
    } else if (T.phase === 'guess' || T.phase === 'reveal') {
      tray.style.setProperty('--n', T.options.length);
      for (const optId of T.options) {
        const it = this.item[optId];
        const card = html('div', 'card ul-card ul-ans');
        card.innerHTML = `<span class="ul-emoji">${esc(it.emoji)}</span><div class="card-body"><b>${esc(it.name)}</b></div>`;
        card.dataset.target = `ans:${id}:${optId}`;
        card.dataset.kind = 'card';
        if (T.phase === 'reveal') card.classList.add(optId === sample.id ? 'good' : 'dim');
        tray.appendChild(card);
        this._els.set(card.dataset.target, card);
      }
    } else if (T.phase === 'unlock') {
      tray.style.setProperty('--n', 1);
      tray.appendChild(html('div', 'card ul-card ul-wait', `<span class="ul-emoji">🔬</span><div class="card-body"><b>المجهر يستعدّ…</b></div>`));
    } else if (T.phase === 'done') {
      tray.style.setProperty('--n', 1);
      const msg = this.state.race && this.state.winner === id ? '🏆 فزتم! أحسنتم' : '✓ أنهيتم كل العيّنات';
      tray.appendChild(html('div', 'card ul-card ul-wait done-card', `<span class="ul-emoji">🎉</span><div class="card-body"><b>${msg}</b></div>`));
    }
    ui.lock.classList.toggle('show', T.level < 2 && T.phase !== 'done');
    this._say(id, T.msg);
    this._updateHud();
  }

  /** نص سطر الفريق: رسالة مؤقتة إن وُجدت، وإلا تعليمات المرحلة */
  _say(id, msg) {
    const ui = this.$teams?.[id];
    const T = this.state?.teams[id];
    if (!ui || !T) return;
    const el = ui.prompt;
    if (msg) {
      el.className = `ul-prompt ${msg.kind || ''}`;
      el.innerHTML = `<span>${msg.html}</span>`;
      return;
    }
    el.className = 'ul-prompt';
    const tools = this.content.tools;
    let text = '';
    if (this.state.cine) text = 'استعدّوا…';
    else if (T.phase === 'look') text = T.level < 2 ? `التقط ${tools.lens.emoji} العدسة وضعها على العيّنة` : 'عيّنة صغيرة جدًا! أيّ أداة تكبّرها بما يكفي؟';
    else if (T.phase === 'zoom') text = 'نضبط التركيز… انظروا!';
    else if (T.phase === 'guess') text = '👀 ما هذا الذي نراه مكبّرًا؟ المس اسمه';
    else if (T.phase === 'done') text = 'انتظروا زملاءكم…';
    el.textContent = text;
  }

  /** رسالة مؤقتة في سطر الفريق (تعود التعليمات بعدها) */
  _flash(id, htmlStr, kind = '', ms = 2200) {
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
      this._targets.push({ id, kind, el, team, ref, rect: { x, y, w, h }, pad: 6, enabled: true });
    }
    // الأطباق: خانات إفلات دائرية (نصف القطر أكبر بكثير من ٤٤u)
    if (this.screen === 'play' && this.state) {
      for (const [id, T] of Object.entries(this.state.teams)) {
        if (T.phase !== 'look') continue;
        const { x, y, r } = this.L[id].plate;
        this._targets.push({ id: `plate:${id}`, kind: 'slot', el: this.$plates[id]?.el, team: id, ref: 'plate', x, y, r: r + 10, enabled: true });
      }
    }
  }

  _updateHud() {
    const st = this.state;
    if (!st) return;
    if (this.$progress) {
      const T = st.teams.all;
      this.$progress.textContent = `🔎 ${ar(T.placed)} / ${ar(this.total)}`;
      this.$mist.textContent = `أخطاء: ${ar(this.mistakes)}`;
    }
    this.tickClock();
    for (const [id, ui] of Object.entries(this.$teams || {})) {
      const T = st.teams[id];
      if (ui.mist) ui.mist.textContent = `أخطاء: ${ar(T.mistakes)}`;
      if (ui.jars) {
        // «مرطبانات» العيّنات: تمتلئ كلما اكتُشفت عيّنة (والمستوى ٢ بلون آخر)
        let h = '';
        T.queue.forEach((iid, i) => {
          const it = this.item[iid];
          const on = i < T.placed;
          h += `<i class="${on ? 'on' : ''}${it.level === 2 ? ' l2' : ''}">${on ? esc(it.emoji) : ''}</i>`;
        });
        ui.jars.innerHTML = h;
      }
    }
  }

  // ------------------------------------------------------------------ الحلقة (رسوم الأطباق والجسيمات والأبعاد الثلاثة)
  _frame(now) {
    const dt = Math.min(0.1, (now - this._lastFrame) / 1000);
    this._lastFrame = now;
    const st = this.state;
    if (st && this.screen === 'play') {
      for (const [id, T] of Object.entries(st.teams)) {
        const a = T.anim;
        if (a) {
          const k = Math.min(1, (now - a.t0) / Math.max(1, a.dur));
          const e = a.ease ? a.ease(k) : k;
          T.view.zoom = a.z0 + (a.z1 - a.z0) * e;
          T.view.focus = a.f0 + (a.f1 - a.f0) * (a.focusEase ? a.focusEase(k) : e);
          if (this.$plates[id]) this.$plates[id].dirty = true;
          if (k >= 1) {
            T.anim = null;
            a.onDone?.();
          }
        }
        const P = this.$plates[id];
        if (P?.dirty && T.queue[T.idx]) {
          drawView(P.ctx, T.queue[T.idx], T.view.zoom, T.view.focus);
          P.el.classList.toggle('mystery', T.view.zoom < 0.05);
          P.dirty = false;
        }
        // العدسة/المجهر ثلاثي الأبعاد يتبع اليد التي تحمله
        if (this.scene) {
          const S = this.scene.team(id);
          if (S) {
            const heldBy = {};
            for (const c of this.input?.cursors.values() || []) if (c.team === id && c.holding && c.source !== 'pointer') heldBy[c.holding] = c;
            for (const c of this.input?.cursors.values() || []) if (c.team === id && c.holding && c.source === 'pointer') heldBy[c.holding] = c;
            for (const tool of ['lens', 'scope']) {
              const c = heldBy[tool];
              if (c) this.scene.follow(S, tool, c.x, c.y);
              else if (S[tool].mode === 'follow') this.scene.home(S, tool);
            }
          }
        }
      }
    }
    this.particles.frame(dt);
    this.scene?.frame(now);
  }

  _anim(T, { z1, f1, dur, ease, focusEase, onDone }) {
    T.anim = { t0: performance.now(), z0: T.view.zoom, f0: T.view.focus, z1, f1, dur: Math.max(1, dur), ease, focusEase, onDone };
  }

  /** يضبط أدوات المشهد ثلاثي الأبعاد على مواضع التخطيط الحالي */
  _syncScene() {
    if (!this.scene) return;
    const spec = {};
    if (this.screen === 'play' && this.state) {
      for (const [id, L] of Object.entries(this.L)) {
        spec[id] = { lensHome: L.lensHome, scopeHome: L.scopeHome, plate: L.plate, outward: L.outward, size: L.size };
      }
    }
    this.scene.setTeams(spec);
    if (this.screen === 'play' && this.state) {
      for (const [id, T] of Object.entries(this.state.teams)) {
        const S = this.scene.team(id);
        if (S && S.locked !== T.level < 2) this.scene.setLocked(S, T.level < 2);
      }
    }
  }

  // ------------------------------------------------------------------ الأفعال
  press(c, t) {
    if (t.kind === 'button') return this._button(t.id);
    if (t.kind !== 'card' || this.screen !== 'play' || !this.state || this.state.cine) return;
    const id = t.team;
    const T = this.state.teams[id];
    if (!T || this._busy(T)) return;
    const [prefix] = t.id.split(':');
    if (prefix === 'tool') return this._pickTool(c, t, T);
    if (prefix === 'ans' && T.phase === 'guess' && !c.holding) return this._answer(t, T);
  }

  _pickTool(c, t, T) {
    const id = T.id;
    const key = t.ref;
    if (T.phase !== 'look') return;
    if (key === 'scope' && T.level < 2) {
      fxs.bonk();
      this._flash(id, '🔒 المجهر مقفل الآن — ابدؤوا بالعدسة المكبّرة', 'info');
      return;
    }
    // الأداة نفسها في اليد: لمسها ثانية يعيدها
    if (c.holding === key && c.team === id) {
      c.holding = null;
      c.team = null;
      t.el.classList.remove('taken');
      sfx.back();
      return;
    }
    // أداة في يد أخرى من الفريق لا تُلتقط مرتين
    for (const o of this.input.cursors.values()) if (o !== c && o.holding === key && o.team === id) return;
    if (c.holding) this._els.get(`tool:${c.team}:${c.holding}`)?.classList.remove('taken');
    c.holding = key;
    c.team = id;
    t.el.classList.add('taken');
    sfx.pick();
    this._flash(id, 'الآن ضعها على الطبق وأبقِ يدك 🫧', 'info', 1800);
  }

  drop(c, t) {
    if (this.screen !== 'play' || !this.state || this.state.cine || !c.holding || t.kind !== 'slot') return;
    const id = c.team;
    const T = this.state.teams[id];
    if (!T || t.team !== id || T.phase !== 'look') return;
    const tool = c.holding;
    const sample = this.item[T.queue[T.idx]];
    const S = this.scene?.team(id);
    const plateEl = this.$plates[id]?.el;
    // العيّنة صغيرة جدًا والعدسة لا تكفي: خطأ لطيف، والعدسة تبقى في اليد
    if (sample.level === 2 && tool === 'lens') {
      T.mistakes++;
      T.toolMistakes++;
      T.toolWrong++;
      fxs.blur();
      if (S) this.scene.shake(S, 'lens');
      this._anim(T, {
        z1: 0.55, f1: 0.04, dur: this._d(450),
        onDone: () => this.later(() => T.phase === 'look' && this._anim(T, { z1: 0, f1: 0, dur: this._d(350) }), this._d(500)),
      });
      plateEl?.classList.remove('shake');
      void plateEl?.offsetWidth;
      plateEl?.classList.add('shake');
      if (T.toolWrong >= 2) {
        const sc = this._els.get(`tool:${id}:scope`);
        sc?.classList.add('hint');
        this._flash(id, 'تلميح: الأداة المضيئة تكبّر <b>أكثر بكثير</b> 🔬', 'hint', 2600);
      } else {
        this._flash(id, 'ما زالت ضبابية! العدسة <b>لا تكبّر بما يكفي</b>… جرّب أداة أخرى', 'bad', 2600);
      }
      this._updateHud();
      return;
    }
    // الأداة المناسبة: تطير إلى الطبق وتتضح الصورة
    c.holding = null;
    c.team = null;
    this._releaseTeam(id);
    T.phase = 'zoom';
    T.tool = tool;
    T.toolWrong = 0;
    T.guessWrong = 0;
    T.msg = null;
    this._fillTeam(id);
    this._collectTargets();
    fxs.whoosh(0.55);
    let delay = 0;
    if (S) {
      if (tool === 'lens') delay = this.scene.lensToPlate(S);
      else this.scene.scopeOnPlate(S);
    }
    plateEl?.classList.add(tool === 'scope' ? 'scope' : 'lens');
    const zoomMs = this._d(tool === 'scope' ? 1700 : 1400);
    this.later(() => {
      fxs.focus(zoomMs / 1000);
      this._anim(T, {
        z1: 1, f1: 1, dur: zoomMs,
        ease: (k) => 1 - Math.pow(1 - k, 3),
        focusEase: (k) => (k < 0.45 ? k * 0.4 : 0.18 + (k - 0.45) * (0.82 / 0.55)),
        onDone: () => this._revealView(T, tool),
      });
    }, delay * 0.8);
  }

  _revealView(T, tool) {
    const id = T.id;
    const ui = this.$teams[id];
    const P = this.L[id].plate;
    fxs.shimmer();
    this.particles.ring(P.x, P.y, P.r, '#ffd667');
    ui.badge.textContent = `${this.content.tools[tool].emoji} ${this.content.tools[tool].mag}`;
    ui.badge.classList.add('show');
    // ثلاث بطاقات: الإجابة ومشتّتان يشبهانها مكبّرين
    const sample = this.item[T.queue[T.idx]];
    const pool = this.content.items.filter((i) => i.level === sample.level && i.id !== sample.id).map((i) => i.id);
    const pref = shuffle(sample.confuse.filter((x) => pool.includes(x)));
    const rest = shuffle(pool.filter((x) => !pref.includes(x)));
    T.options = shuffle([sample.id, ...[...pref, ...rest].slice(0, 2)]);
    T.phase = 'guess';
    this._fillTeam(id);
    this._collectTargets();
  }

  _answer(t, T) {
    const id = T.id;
    const sample = this.item[T.queue[T.idx]];
    const card = t.el;
    if (t.ref === sample.id) {
      sfx.correct();
      fxs.shimmer();
      say(sample.name);
      const P = this.L[id].plate;
      this.particles.burst(P.x, P.y, sample.color, 44);
      this.particles.ring(P.x, P.y, P.r, sample.color);
      T.placed++;
      T.phase = 'reveal';
      this._fillTeam(id);
      this._collectTargets();
      this._flash(id, `<span class="ul-name" style="--c:${sample.color}">${esc(sample.emoji)} ${esc(sample.name)}</span> ${esc(sample.fact)}`, 'reveal', 60000);
      this.later(() => this._next(T), this._d(3200));
      return;
    }
    T.mistakes++;
    T.guessWrong++;
    T.byItem[sample.id] = (T.byItem[sample.id] || 0) + 1;
    fxs.bonk();
    card.classList.remove('shake');
    void card.offsetWidth;
    card.classList.add('shake');
    if (T.guessWrong >= 2) {
      this._els.get(`ans:${id}:${sample.id}`)?.classList.add('hint');
      this._flash(id, 'تلميح: الإجابة الصحيحة <b>تتوهّج</b> ✨', 'hint', 3000);
    } else {
      const wrong = this.item[t.ref];
      this._flash(id, `ليست «${esc(wrong.name)}»… انظروا جيدًا إلى التفاصيل 👀`, 'bad', 2400);
    }
    this._updateHud();
  }

  /** العيّنة التالية، أو فتح المجهر في منتصف الجولة، أو نهاية الفريق */
  _next(T) {
    if (!this.state || this.screen !== 'play') return;
    const id = T.id;
    const S = this.scene?.team(id);
    if (S) this.scene.clearPlate(S);
    this.$plates[id]?.el.classList.remove('lens', 'scope');
    this.$teams[id]?.badge.classList.remove('show');
    T.msg = null;
    T.idx++;
    T.view = { zoom: 0, focus: 0 };
    if (this.$plates[id]) this.$plates[id].dirty = true;
    if (T.idx >= T.queue.length) return this._teamDone(T);
    const nextLevel = this.item[T.queue[T.idx]].level;
    if (nextLevel === 2 && T.level < 2) return this._unlock(T);
    T.phase = 'look';
    this._fillTeam(id);
    this._collectTargets();
  }

  /** حدث منتصف اللعبة: «العدسة لا تكفي!» ثم يُفتح المجهر وتتسارع الموسيقى. لا أهداف للفريق أثناءه. */
  _unlock(T) {
    const id = T.id;
    T.phase = 'unlock';
    T.level = 2;
    this._fillTeam(id);
    this._collectTargets();
    this._flash(id, '🔬 العيّنات القادمة <b>صغيرة جدًا</b>، لا تكفيها العدسة… المجهر يكبّر <b>أكثر بكثير</b>!', 'reveal', 60000);
    fxs.boom();
    // العيّنة الجديدة تظهر نقطة لا تكاد تُرى
    this.later(() => {
      const S = this.scene?.team(id);
      if (S) this.scene.unlock(S);
      fxs.unlock();
      const L = this.L[id];
      this.particles.burst(L.scopeHome.x, L.scopeHome.y, '#ffd667', 50);
      this.$teams[id]?.lock.classList.add('pop');
      music.faster();
    }, this._d(900));
    this.later(() => {
      T.msg = null;
      T.phase = 'look';
      this._fillTeam(id);
      this._collectTargets();
    }, this._d(3400));
  }

  _teamDone(T) {
    const st = this.state;
    T.end = performance.now();
    T.phase = 'done';
    if (st.race && !st.winner) {
      st.winner = T.id;
      sfx.win();
      this.particles.burst(this.L[T.id].plate.x, this.L[T.id].plate.y, TEAMS[T.id].color, 70);
    }
    this._fillTeam(T.id);
    this._collectTargets();
    if (Object.values(st.teams).every((x) => x.phase === 'done')) {
      st.end = performance.now();
      this.later(() => this._finale(), this._d(900));
    }
  }

  /** الختام السينمائي (٢ ث): قصاصات، «أحسنتم!»، اسم الفائز، ثم شاشة النتيجة. */
  _finale() {
    const st = this.state;
    st.cine = true;
    music.stop();
    fxs.boom();
    sfx.win();
    this.particles.confetti(this.VW);
    const win = st.race && st.winner ? `<div class="cine-sub" style="--team:${TEAMS[st.winner].color}">🏆 ${esc(TEAMS[st.winner].name)}</div>` : '';
    this._cine(`<div class="cine-bar top"></div><div class="cine-bar bottom"></div><div class="cine-title">أحسنتم!</div>${win}`, 'finale');
    this.later(() => {
      this._cine(null);
      st.cine = false;
      this.screen = 'done';
      this.input?.reset();
      this.scene?.reset();
      this.render();
    }, this._d(2200));
  }

  /** أي يد أخرى من الفريق تحمل أداة تُفرغ (تبدّلت المرحلة ولم يعد لها مكان) */
  _releaseTeam(id) {
    for (const o of this.input?.cursors.values() || []) {
      if (o.team === id && o.holding) {
        o.holding = null;
        o.team = null;
      }
    }
  }

  cancel(c) {
    if (c.holding) this._els.get(`tool:${c.team}:${c.holding}`)?.classList.remove('taken');
    c.holding = null;
    c.team = null;
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
    head.appendChild(html('h1', 'title small ul-title', esc(this.content.title)));
    this.hud.appendChild(head);
    // ألبوم المستكشف: العيّنات المكبّرة التي اكتشفوها
    const first = Object.values(st.teams)[0];
    const ids = [...first.queue];
    const trayH = 240;
    const albumTop = top + 6;
    const albumH = bottom - trayH - 20 - albumTop;
    const album = this._place(html('div', 'ul-album'), left, albumTop, right - left, albumH);
    album.appendChild(html('div', 'ul-album-title', '📒 ألبوم المستكشفين: هكذا تبدو الأشياء مكبّرة'));
    const grid = html('div', 'ul-album-grid');
    const n = ids.length;
    const d = Math.round(clamp(Math.min((right - left - (n - 1) * 22) / n - 16, albumH - 140), 70, 190));
    for (const iid of ids) {
      const it = this.item[iid];
      const cell = html('div', 'ul-album-cell');
      cell.style.width = `calc(var(--u) * ${d + 16})`;
      const cv = html('canvas');
      const px = Math.round(d * this.scale * Math.min(2, devicePixelRatio || 1));
      cv.width = cv.height = Math.max(32, px);
      cv.style.width = cv.style.height = `calc(var(--u) * ${d})`;
      cv.getContext('2d').drawImage(getArt(iid), 0, 0, cv.width, cv.height);
      cell.appendChild(cv);
      cell.appendChild(html('b', '', `${esc(it.emoji)} ${esc(it.name)}`));
      cell.appendChild(html('small', '', it.level === 2 ? '🔬 بالمجهر' : '🔍 بالعدسة'));
      grid.appendChild(cell);
    }
    album.appendChild(grid);
    this.hud.appendChild(album);

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
    let toolM = 0;
    for (const T of Object.values(st.teams)) {
      toolM += T.toolMistakes;
      for (const [k, v] of Object.entries(T.byItem)) agg[k] = (agg[k] || 0) + v;
    }
    const worst = Object.entries(agg).sort((a, b) => b[1] - a[1])[0];
    let review = '';
    if (toolM > 0 && (!worst || toolM >= worst[1])) review = 'راجعوا: متى نحتاج <b>المجهر</b> بدل العدسة؟';
    else if (worst) review = `راجعوا: كيف تبدو <b>${esc(this.item[worst[0]].name)}</b> مكبّرة؟`;
    panel.innerHTML = `
      <div class="res-main">
        <div class="stars">${[1, 2, 3].map((i) => `<span class="star${i <= stars ? ' on' : ''}">★</span>`).join('')}</div>
        <div class="res-msg">${stars === 3 ? 'ممتاز! بلا أي خطأ' : stars === 2 ? 'أحسنتم!' : 'جيد — جرّبوا مرة أخرى'}</div>
        ${st.race && st.winner ? `<div class="winner">🏆 الفائز: ${TEAMS[st.winner].name}</div>` : ''}
      </div>
      <div class="res-stats">${teamsHtml}${review ? `<span class="ul-review">${review}</span>` : ''}</div>`;
    const btns = html('div', 'res-btns');
    const again = html('div', 'opt start', '<b>العبوا مجددًا</b>');
    again.dataset.target = 'again';
    const menu = html('div', 'opt', '<b>القائمة</b>');
    menu.dataset.target = 'menu';
    btns.append(again, menu);
    panel.appendChild(btns);
    this.hud.appendChild(panel);
  }

  /** الأداة المحمولة تحت اليد: هالة محايدة واسم الأداة (المجسّم ثلاثي الأبعاد يتبع اليد أيضًا). */
  heldIcon(key, team) {
    const tl = this.content.tools[key];
    const teamed = team && team !== 'all';
    const g = svg('g', { class: 'held-item ul-held', 'data-team': teamed ? team : null });
    if (teamed) g.style.setProperty('--team', TEAMS[team].color);
    g.appendChild(svg('circle', { r: 58, class: 'held-halo' }));
    if (!this.scene) {
      const em = svg('text', { y: 4, 'text-anchor': 'middle', 'dominant-baseline': 'middle', class: 'ul-held-emoji' });
      em.textContent = tl?.emoji || '🔍';
      g.appendChild(em);
    }
    const lb = svg('text', { y: 92, 'text-anchor': 'middle', class: 'ul-held-label' });
    lb.textContent = tl?.name || '';
    g.appendChild(lb);
    return g;
  }
}
