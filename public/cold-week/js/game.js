// ---------------------------------------------------------------------------
// «أسبوع الزكام» — لعبة سبورة ذكية (لمس السبورة باليد) فوق المحرّك board-kit.
//
// القصة: في الافتتاح «الأسبوع بلا حماية»: عطس زميل بلا تغطية يوم الأحد فمرض القريبون منه
// يومًا بعد يوم (جواب سؤال الدرس: لماذا نمرض في أوقات متقاربة؟). ثم يُعاد الأسبوع:
// عشرة مواقف (يومان لكل يوم دراسي)، يلتقط الطالب بطاقة الحل ويضعها على لوحة الموقف،
// فيرى الحل يحدث في الصف ثلاثي الأبعاد ويبقى الزملاء سالمين.
//
// الأوضاع: «طالب واحد» (أو الصف كله معًا: صف واحد وبطاقات واحدة)،
//          و«سباق طالبين»: لكل طالب صفّه ولوحة موقفه وبطاقاته في نصف السبورة بلونه.
//
// التخطيط (u = جزء من ألف من ارتفاع الشاشة):
//   ترويسة (٩٦u) ← المشهد ثلاثي الأبعاد (زينة وحركة، بلا أهداف) ← لوحة الموقف (خانة الإفلات، ١٨٠u)
//   ← صف البطاقات الأربع (≥ ١٥٠u) في الأسفل. كل الأهداف HTML في الثلث السفلي: مواضعها واحدة في الطبقات الثلاث.
// ---------------------------------------------------------------------------
import { sfx, say } from '/board-kit/js/audio.js';
import { CARDS, WRONG, TOPICS, DAYS, PERIODS, DOLLS, SITUATIONS } from './content.js';
import { fxs, music, setMuted, isMuted, onAudioState, setAllow } from './fx.js';
import { FlatView } from './flat.js';

// للتجربة فقط (?slow=8): نفس إبطاء المشهد (scene3d.js)
const SLOW = Math.max(1, Number(new URLSearchParams(location.search).get('slow')) || 1);

const NS = 'http://www.w3.org/2000/svg';
const TEAMS = {
  a: { name: 'اللاعب الأول', color: '#8a1538', pan: 0.6 },
  b: { name: 'اللاعب الثاني', color: '#0e7490', pan: -0.6 },
  all: { name: '', color: '#8a1538', pan: 0 },
};
const N_CARDS = 4;
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
/** النص يدخل HTML: نهرّبه دائمًا */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
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

/** صورة مجسّم البطاقة ثلاثي الأبعاد مُصيَّرة مسبقًا (tools/prerender.py) */
const thumb = (cid) => new URL(`../assets/cards/${cid}.webp`, import.meta.url).href;

/** الطبقة: ?tier=A|B|C للتجربة، وتقليل الحركة ← C */
function pickTier() {
  const q = new URLSearchParams(location.search).get('tier');
  if (q && /^[abc]$/i.test(q)) return { tier: q.toUpperCase(), forced: true };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduce';
  if (reduce) return { tier: 'C', forced: false };
  if (!document.createElement('canvas').getContext('webgl2') && !navigator.gpu) return { tier: 'C', forced: false };
  return { tier: null, forced: false };
}

export class Game {
  constructor({ stage, board, hud, fx }, content) {
    Object.assign(this, { stage, board, hud, fx, content });
    this.VH = 1000;
    this.VW = 1600;
    this.scale = 1;
    this.settings = {};
    this.input = null;
    this.screen = 'menu';
    this.opts = { race: false };
    this.state = null;
    this._targets = [];
    this._els = new Map();
    this._hoverOn = new Set();
    this._timers = new Set();
    this.scene = null;
    this.flat = null;

    // طبقات المسرح: لوحة 3D (أو صورة الطبقة C) تحت الواجهة HTML، ومؤشرات الأيدي فوق الكل
    this.$gl = html('canvas', 'cw-gl');
    this.$flat = html('div', 'cw-flat');
    this.$loader = html('div', 'cw-loader', '<i class="cw-pearl"></i><b>نجهّز الصف…</b><span class="cw-bar"><i></i></span>');
    this.$bars = html('div', 'cw-bars', '<i></i><i></i>');
    stage.insertBefore(this.$flat, hud);
    stage.insertBefore(this.$gl, hud);
    stage.insertBefore(this.$bars, hud);
    stage.appendChild(this.$loader);

    // وضع التصيير المسبق للطبقة C (tools/prerender.py): ?render=single|race
    this.renderMode = new URLSearchParams(location.search).get('render');
    if (this.renderMode) {
      this.opts.race = this.renderMode === 'race';
      stage.classList.add('cw-render');
    }
    const { tier, forced } = pickTier();
    this.forced = forced;
    this.tierWanted = tier;
    this.ready = this._init3D(tier, forced);
    this._muteButton();
    setAllow(() => this.settings.sound !== false);
  }

  async _init3D(tier, forced) {
    if (tier === 'C') return this._toC('اختيار');
    try {
      const { createScene3D } = await import('./scene3d.js');
      this._bar(0.35);
      const sc = await createScene3D(this.$gl, { forced: forced ? tier : null });
      if (!sc) return this._toC('تعذّر 3D');
      this.scene = sc;
      this.tier = sc.tier;
      sc.onFail = () => this._toC('تعطّل');
      sc.onTier = (t) => {
        this.tier = t;
        this.stage.dataset.tier = t;
      };
      sc.onSound = (k, team, x) => fxs[k]?.(TEAMS[team]?.pan || 0, x);
      sc.ui.source = () => this._uiSource();
      sc.setTeams(this._teamIds());
      this._bar(0.7);
      this.stage.dataset.tier = sc.tier;
      this._layoutScene();
      try {
        await sc.renderer.compileAsync(sc.scene, sc.camera); // لا يتقطّع أول ظهور للمجسّمات
      } catch {
        /* التجميع المسبق تحسين فقط */
      }
      this._bar(1);
      setTimeout(() => {
        this.$gl.classList.add('on');
        this.$loader.classList.add('done');
      }, 250);
    } catch (e) {
      console.warn(e);
      this._toC('خطأ');
    }
  }

  /** الطبقة C: صور مُصيَّرة مسبقًا من الطبقة A + حركات CSS. اللعبة كاملة. */
  _toC(why) {
    console.info('الطبقة C:', why);
    if (this.scene) {
      try {
        this.scene.dispose();
      } catch {
        /* */
      }
      this.scene = null;
      this.$gl.classList.remove('on');
    }
    this.tier = 'C';
    this.stage.dataset.tier = 'C';
    this.flat = new FlatView(this.$flat);
    this.flat.onSound = (k, team, x) => fxs[k]?.(TEAMS[team]?.pan || 0, x);
    this.flat.setTeams(this._teamIds());
    this._layoutScene();
    this.$loader.classList.add('done');
    // إن كان اللعب جاريًا: أعد مشهد الموقف الحالي في الطبقة الجديدة
    if (this.state && this.screen === 'play') for (const id of Object.keys(this.state.teams)) this._view()?.cue(id, this._sit(id));
    return null;
  }

  _view() {
    return this.scene || this.flat;
  }
  _bar(f) {
    const i = this.$loader.querySelector('.cw-bar i');
    if (i) i.style.width = `${Math.round(f * 100)}%`;
  }
  _teamIds() {
    return this.opts.race ? ['a', 'b'] : ['all'];
  }

  /** زر كتم الصوت في أدوات المعلم (يلمسه المعلم على شاشة الجهاز) */
  _muteButton() {
    const nav = document.getElementById('teacher');
    if (!nav || document.getElementById('btnMute')) return;
    const b = html('button', 'tbtn cw-mute');
    b.id = 'btnMute';
    b.type = 'button';
    const home = document.getElementById('btnHome');
    nav.insertBefore(b, home);
    const paint = (st) => {
      b.dataset.state = st;
      b.textContent = st === 'muted' ? '🔇' : st === 'locked' ? '🔈' : '🔊';
      b.title = st === 'muted' ? 'تشغيل الصوت' : st === 'locked' ? 'المس لتفعيل الصوت' : 'كتم الصوت';
      b.setAttribute('aria-label', b.title);
    };
    onAudioState(paint);
    b.addEventListener('click', () => {
      // أول لمسة تفتح الصوت (iOS)؛ وبعدها الزر يكتم أو يشغّل
      if (b.dataset.state === 'locked') return;
      setMuted(!isMuted(), this.settings.sound !== false);
      if (isMuted()) music.stop();
      else if (this.screen === 'play' || this.screen === 'intro') music.start();
    });
  }

  // ------------------------------------------------------------------ عقد اللعبة
  setSettings(s) {
    this.settings = s;
  }
  targets() {
    return this._targets;
  }
  setHovered(ids) {
    for (const id of this._hoverOn) if (!ids.has(id)) this._els.get(id)?.classList.remove('hover');
    for (const id of ids) if (!this._hoverOn.has(id)) this._els.get(id)?.classList.add('hover');
    this._hoverOn = new Set(ids);
  }
  toMenu() {
    this._clearTimers();
    music.stop();
    this.screen = 'menu';
    this.state = null;
    this.input?.reset();
    this._view()?.reset();
    this.render();
  }
  tickClock() {
    if (this.$time && this.state) this.$time.textContent = `⏱ ${fmtTime((this.state.end || performance.now()) - this.state.start)}`;
  }
  later(fn, ms) {
    const t = setTimeout(() => {
      this._timers.delete(t);
      fn();
    }, ms * SLOW);
    this._timers.add(t);
  }
  _clearTimers() {
    for (const t of this._timers) clearTimeout(t);
    this._timers.clear();
  }

  /** حدود اللعب: أسفل الترويسة (أو ما يحجزه المعلم أعلى السبورة)، وهامش جانبي */
  _band() {
    const side = Math.round((this.settings.sideInset || 0) * this.VW) + 26;
    return { top: Math.max(104, Math.round((this.settings.reachTop || 0) * this.VH)), bottom: this.VH - 12, left: side, right: this.VW - side };
  }

  /** مستطيلات التخطيط (واحدة في كل الطبقات) */
  _geom(race = this.opts.race) {
    const b = this._band();
    const barH = race ? 46 : 0;
    const cardsH = Math.max(150, Math.min(178, (b.bottom - 104) * 0.22));
    const trayH = cardsH + barH;
    const trayTop = b.bottom - trayH;
    const panelH = 178;
    const panelTop = Math.max(b.top, trayTop - 14 - panelH);
    return { ...b, barH, trayH, trayTop, panelH, panelTop, frame: { x0: b.left, x1: b.right, top: 104, bottom: panelTop - 8 } };
  }

  _layoutScene() {
    const r = this.stage.getBoundingClientRect();
    const g = this._geom();
    if (this.renderMode) {
      // إطار مرجعي بعرض شاشة 16:9 في منتصف صورة أعرض (هوامش للشاشات الأعرض)
      const w = 1726;
      g.frame = { x0: (this.VW - w) / 2, x1: (this.VW + w) / 2, top: 104, bottom: 624 };
    }
    const v = this._view();
    if (!v) return;
    v.setTeams?.(this._teamIds());
    v.layout(Math.max(1, r.width), Math.max(1, r.height), this.VW, this.VH, g.frame);
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
    this.stage.dataset.screen = this.screen;
    this.$panels = {};
    this.$cards = {};
    this.$teamUi = {};
    if (this.screen === 'menu') this._renderMenu();
    else this._renderPlay();
    const layer = svg('g', { class: 'cursors' });
    this.fx.appendChild(layer);
    this.input?.attachLayer(layer);
    this._layoutScene();
    this._collectTargets();
  }

  // ------------------------------------------------------------------ القائمة
  _renderMenu() {
    const g = this._geom();
    const head = html('header', 'hud-header menu-head cw-menu-head');
    head.append(html('h1', 'title cw-logo', `<span class="cw-logo-mark" aria-hidden="true"></span>${esc(this.content.title)}`), html('p', 'lead', esc(this.content.lead)));
    this.hud.appendChild(head);
    const panel = html('div', 'menu-panel cw-menu');
    Object.assign(panel.style, { left: `calc(var(--u) * ${g.left + 40})`, right: `calc(var(--u) * ${this.VW - g.right + 40})` });
    const row = html('div', 'menu-row');
    const solo = html('div', `opt${this.opts.race ? '' : ' on'}`, '<b>طالب واحد</b><small>أو الصف كله معًا</small>');
    solo.dataset.target = 'opt:solo';
    const race = html('div', `opt${this.opts.race ? ' on' : ''}`, '<b>سباق طالبين</b><small>لكل طالب صفّه وبطاقاته</small>');
    race.dataset.target = 'opt:race';
    const start = html('div', 'opt start', '<b>ابدأ الأسبوع</b><small>المس وأبقِ يدك</small>');
    start.dataset.target = 'start';
    row.append(solo, race, start);
    panel.append(row);
    this.hud.appendChild(panel);
  }

  // ------------------------------------------------------------------ اللعب
  newGame() {
    const ids = this._teamIds();
    const teams = {};
    for (const id of ids) teams[id] = { i: 0, mistakes: 0, wrongHere: 0, topicMiss: {}, busy: true, end: 0, cards: [], midDone: false, hint: null, msg: null };
    this.state = { race: this.opts.race, teams, start: performance.now(), end: 0, winner: null, intro: true };
    this.screen = 'intro';
    this.input?.reset();
    this._clearTimers();
    music.reset();
    this.render();
    const run = () => {
      const v = this._view();
      v.setTeams?.(ids);
      this._layoutScene();
      const { dur, marks } = v.intro();
      // سطور الافتتاح، وأشرطة سينمائية، وضربة منخفضة
      this.$bars.classList.add('on');
      fxs.boom();
      this.content.intro.forEach((line, i) => this.later(() => {
        const cap = this.$caption;
        if (!cap) return;
        cap.textContent = line;
        cap.classList.remove('show');
        void cap.offsetWidth;
        cap.classList.add('show');
        if (i === 1) fxs.whoosh();
      }, marks[i] * 1000 + 200));
      this.later(() => this.$titleCard?.classList.add('out'), 2300);
      this.later(() => {
        this.$bars.classList.remove('on');
        this._startPlay();
      }, dur * 1000);
    };
    // إن لم يكتمل تجهيز 3D بعد: ننتظره (الشاشة تعرض العنوان)
    Promise.resolve(this.ready).then(() => {
      if (this.screen === 'intro' && this.state && !this.state.started) {
        this.state.started = true;
        run();
      }
    });
  }

  _startPlay() {
    if (!this.state) return;
    this.state.intro = false;
    this.state.start = performance.now();
    this.screen = 'play';
    music.start();
    this.render();
    for (const id of Object.keys(this.state.teams)) this._cue(id);
  }

  _sit(id) {
    const T = this.state.teams[id];
    return SITUATIONS[Math.min(T.i, SITUATIONS.length - 1)];
  }

  /** بداية موقف لفريق */
  _cue(id) {
    const T = this.state.teams[id];
    if (!T || T.end) return;
    const s = this._sit(id);
    // منتصف الأسبوع (بداية الأربعاء): «سرّ العدوى» مرة واحدة
    if (s.day === 3 && !T.midDone) {
      T.midDone = true;
      T.busy = true;
      T.msg = { title: this.content.midgame.title, text: this.content.midgame.text, kind: 'mid' };
      this._paintTeam(id);
      music.speedUp();
      const d = this._view()?.midgame(id) || 2;
      this.later(() => this._cue(id), d * 1000 + 200);
      return;
    }
    T.cards = shuffle([s.answer, ...s.others]);
    this.scene?.ui.clearWell(id);
    this.$panels?.[id]?.querySelector('.cw-drop')?.classList.remove('lit');
    T.wrongHere = 0;
    T.hint = null;
    T.busy = false;
    T.msg = null;
    this._view()?.cue(id, s);
    this._paintTeam(id);
  }

  get mistakes() {
    return this.state ? Object.values(this.state.teams).reduce((s, t) => s + t.mistakes, 0) : 0;
  }

  _renderPlay() {
    const st = this.state;
    const g = this._geom();
    const head = html('header', 'hud-header cw-head');
    head.appendChild(html('h1', 'title small', esc(this.content.title)));
    const chips = html('div', 'chips');
    this.$progress = html('span', 'chip');
    this.$time = html('span', 'chip time');
    this.$mist = html('span', 'chip warn');
    chips.append(this.$progress, this.$time, this.$mist);
    head.appendChild(chips);
    this.hud.appendChild(head);
    this.$toast = html('div', 'toast');
    this.hud.append(this.$toast);

    if (this.screen === 'intro' || this.screen === 'outro') {
      this.$caption = html('div', 'cw-caption');
      this.hud.appendChild(this.$caption);
      if (this.screen === 'intro') {
        this.$titleCard = html('div', 'cw-titlecard', `<b>${esc(this.content.title)}</b><small>لماذا نمرض في أوقات متقاربة؟</small>`);
        this.hud.appendChild(this.$titleCard);
      }
      this._updateHud();
      return;
    }

    const ids = Object.keys(st.teams);
    const mid = this.VW / 2;
    for (const id of ids) {
      const x0 = id === 'a' ? mid + 12 : g.left;
      const x1 = id === 'b' ? mid - 12 : g.right;
      this._renderTeam(id, { x0, x1, g });
    }
    if (this.screen === 'done') this._renderResult(g);
    this._updateHud();
  }

  _renderTeam(id, { x0, x1, g }) {
    const st = this.state;
    const T = st.teams[id];
    const ui = (this.$teamUi[id] = {});
    const team = TEAMS[id];
    // لوحة الموقف = خانة الإفلات (كبيرة: يكفي أن تصل اليد إلى أي مكان فيها)
    const panel = this._place(html('div', 'cw-panel'), x0, g.panelTop, x1 - x0, g.panelH);
    panel.dataset.kind = 'slot';
    if (st.race) {
      panel.dataset.team = id;
      panel.style.setProperty('--team', team.color);
    }
    panel.innerHTML = `
      <div class="cw-info">
        <div class="cw-days">${DAYS.map((d, i) => `<span class="cw-day" data-i="${i}">${esc(d)}</span>`).join('')}<span class="cw-period"></span></div>
        <div class="cw-sit"><span class="cw-who"><i></i><b></b></span><p class="cw-text"></p></div>
      </div>
      <div class="cw-drop"><span class="cw-drop-ring"></span><img class="cw-placed" alt=""><b>ضع الحل هنا</b></div>`;
    this.hud.appendChild(panel);
    this.$panels[id] = panel;
    if (this.screen === 'done') {
      panel.classList.add('cw-off');
      return;
    }
    // البطاقات
    const wrap = this._place(html('div', 'tray-wrap cw-tray'), x0, g.trayTop, x1 - x0, g.trayH);
    if (st.race) {
      wrap.dataset.team = id;
      wrap.style.setProperty('--team', team.color);
      const bar = html('div', 'team-bar', `<b>${team.name}</b><span class="tb-bar"><i></i></span><span class="tb-mist"></span>`);
      wrap.appendChild(bar);
      ui.bar = bar.querySelector('i');
      ui.mist = bar.querySelector('.tb-mist');
    }
    const tray = html('div', 'tray');
    const cardW = (x1 - x0 - 3 * 20) / N_CARDS;
    if (cardW < (g.trayH - g.barH) * 1.5) tray.classList.add('compact');
    this.$cards[id] = [];
    for (let i = 0; i < N_CARDS; i++) {
      const c = html('div', 'card cw-card');
      tray.appendChild(c);
      this.$cards[id].push(c);
    }
    wrap.appendChild(tray);
    this.hud.appendChild(wrap);
    this._paintTeam(id, false);
  }

  /** يرسم لوحة الموقف وبطاقات الفريق من حالته */
  _paintTeam(id, collect = true) {
    const T = this.state?.teams[id];
    const panel = this.$panels?.[id];
    if (!T || !panel) return;
    const s = this._sit(id);
    const doll = DOLLS[s.doll];
    panel.querySelectorAll('.cw-day').forEach((d, i) => {
      d.classList.toggle('on', i === s.day && !T.end);
      d.classList.toggle('past', i < s.day || !!T.end);
    });
    panel.querySelector('.cw-period').textContent = T.end ? 'انتهى الأسبوع' : PERIODS[s.period];
    const who = panel.querySelector('.cw-who');
    const text = panel.querySelector('.cw-text');
    panel.classList.toggle('cw-busy', !!T.busy);
    panel.classList.toggle('cw-mid', T.msg?.kind === 'mid');
    if (T.msg) {
      who.style.setProperty('--d', T.msg.kind === 'good' ? '#15803d' : '#c9961a');
      who.querySelector('b').textContent = T.msg.title;
      text.textContent = T.msg.text;
    } else {
      who.style.setProperty('--d', doll.color);
      who.querySelector('b').textContent = doll.name;
      text.textContent = s.text;
    }
    const slotId = `slot:${id}:${s.id}`;
    if (T.busy || T.end) delete panel.dataset.target;
    else panel.dataset.target = slotId;
    // البطاقات
    const cards = this.$cards?.[id] || [];
    const held = new Set([...(this.input?.cursors.values() || [])].filter((c) => c.team === id).map((c) => c.holding));
    cards.forEach((el, i) => {
      const cid = T.cards[i];
      el.classList.remove('hint', 'shake', 'good');
      if (!cid || T.end) {
        el.innerHTML = '';
        el.classList.add('done');
        delete el.dataset.target;
        delete el.dataset.model;
        return;
      }
      const c = CARDS[cid];
      el.classList.remove('done');
      el.classList.toggle('taken', held.has(cid));
      el.classList.toggle('cw-wait', !!T.busy);
      // موضع المجسّم ثلاثي الأبعاد (ui.js يرسمه تحت هذا الموضع)، وصورته للطبقة C
      el.innerHTML = `<span class="cw-model" aria-hidden="true"><img class="cw-thumb" src="${thumb(cid)}" alt="" decoding="async"></span><div class="card-body"><b>${esc(c.label)}</b></div>`;
      el.dataset.model = cid;
      if (T.busy) delete el.dataset.target;
      else el.dataset.target = `card:${id}:${cid}`;
      if (T.hint === cid) el.classList.add('hint');
    });
    if (collect) {
      this._collectTargets();
      this._updateHud();
    }
  }

  _center(el) {
    if (!el) return { x: this.VW / 2, y: this.VH / 2 };
    const sr = this.stage.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: (r.left + r.width / 2 - sr.left) / this.scale, y: (r.top + r.height / 2 - sr.top) / this.scale };
  }

  /** مواضع البطاقات وحلقات الإفلات بوحدة u، تقرؤها طبقة البطاقات ثلاثية الأبعاد كل إطار */
  _uiSource() {
    const out = { cards: [], wells: [] };
    if (!this.state || this.screen !== 'play') return out;
    const sr = this.stage.getBoundingClientRect();
    const k = 1 / this.scale;
    const rectOf = (el, untransformed = false) => {
      const r = el.getBoundingClientRect();
      const w = untransformed ? el.offsetWidth * k : r.width * k;
      const h = untransformed ? el.offsetHeight * k : r.height * k;
      const cx = (r.left + r.width / 2 - sr.left) * k;
      const cy = (r.top + r.height / 2 - sr.top) * k;
      return { x: cx - w / 2, y: cy - h / 2, w, h };
    };
    for (const [id, cards] of Object.entries(this.$cards || {})) {
      const T = this.state.teams[id];
      if (!T || T.end) continue;
      cards.forEach((el, i) => {
        const cid = el.dataset.model;
        if (!cid || el.classList.contains('done') || !el.isConnected) return;
        const icon = el.querySelector('.cw-model');
        out.cards.push({
          key: `${id}:${i}`,
          model: cid,
          rect: rectOf(el, true),
          icon: icon ? rectOf(icon) : rectOf(el),
          taken: el.classList.contains('taken'),
          wait: el.classList.contains('cw-wait'),
          hint: el.classList.contains('hint'),
          hover: el.classList.contains('hover'),
          teamColor: this.state.race ? TEAMS[id].color : null,
        });
      });
    }
    for (const [id, panel] of Object.entries(this.$panels || {})) {
      const drop = panel.querySelector('.cw-drop');
      if (!drop || panel.classList.contains('cw-off')) continue;
      out.wells.push({ team: id, rect: rectOf(drop), hot: panel.classList.contains('hover') });
    }
    return out;
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
      // الهدف القريب من حافة الشاشة يمتد إليها
      if (x < EDGE) (w += x), (x = 0);
      if (this.VW - (x + w) < EDGE) w = this.VW - x;
      if (this.VH - (y + h) < EDGE) h = this.VH - y;
      const [prefix, team, ref] = id.split(':');
      const kind = el.dataset.kind || (prefix === 'card' ? 'card' : 'button');
      this._els.set(id, el);
      this._targets.push({ id, kind, el, team, ref, rect: { x, y, w, h }, pad: 6, enabled: true });
    }
  }

  _updateHud() {
    const st = this.state;
    if (!st || !this.$progress) return;
    const ids = Object.keys(st.teams);
    const total = SITUATIONS.length * ids.length;
    const done = ids.reduce((s, id) => s + Math.min(SITUATIONS.length, st.teams[id].i), 0);
    this.$progress.textContent = `🛡️ ${ar(done)} / ${ar(total)}`;
    this.$mist.textContent = `أخطاء: ${ar(this.mistakes)}`;
    this.tickClock();
    for (const [id, ui] of Object.entries(this.$teamUi || {})) {
      const T = st.teams[id];
      if (ui.bar) ui.bar.style.width = `${(100 * Math.min(SITUATIONS.length, T.i)) / SITUATIONS.length}%`;
      if (ui.mist) ui.mist.textContent = `أخطاء: ${ar(T.mistakes)}`;
    }
  }

  toast(text, kind = '', team = null) {
    if (!this.$toast) return;
    this.$toast.textContent = text;
    this.$toast.className = `toast show ${kind}`;
    // في السباق: الرسالة فوق نصف صاحبها
    if (team && team !== 'all') this.$toast.style.left = team === 'a' ? '75%' : '25%';
    else this.$toast.style.left = '';
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => this.$toast && (this.$toast.className = 'toast'), 2300);
  }

  // ------------------------------------------------------------------ الأفعال
  press(c, t) {
    if (t.kind === 'button') return this._button(t.id);
    if (t.kind !== 'card' || this.screen !== 'play') return;
    const { team, ref: cid } = t;
    const T = this.state.teams[team];
    if (!T || T.busy || !T.cards.includes(cid)) return;
    if (c.holding === cid && c.team === team) {
      c.holding = null;
      c.team = null;
      t.el.classList.remove('taken');
      sfx.back();
      return;
    }
    for (const o of this.input.cursors.values()) if (o !== c && o.holding === cid && o.team === team) return;
    if (c.holding) this._els.get(`card:${c.team}:${c.holding}`)?.classList.remove('taken');
    c.holding = cid;
    c.team = team;
    t.el.classList.add('taken');
    sfx.pick();
  }

  drop(c, t) {
    if (this.screen !== 'play' || !c.holding || t.kind !== 'slot') return;
    const team = c.team;
    const T = this.state.teams[team];
    if (!T || t.team !== team || T.busy || T.end) return;
    const s = this._sit(team);
    const cid = c.holding;
    const panel = this.$panels[team];
    if (cid === s.answer) {
      const from = { x: c.x, y: c.y };
      c.holding = null;
      c.team = null;
      this._correct(team, s, from);
      return;
    }
    // خطأ: البطاقة تبقى في اليد، ورسالة لطيفة تكشف الفهم الخاطئ، وبعد خطأين تضيء البطاقة الصحيحة
    T.mistakes++;
    T.wrongHere++;
    T.topicMiss[s.topic] = (T.topicMiss[s.topic] || 0) + 1;
    sfx.wrong();
    fxs.oops(TEAMS[team].pan);
    panel.classList.remove('shake');
    void panel.offsetWidth;
    panel.classList.add('shake');
    this._view()?.wrong(team, s, cid);
    this.scene?.ui.nudge(team);
    if (T.wrongHere >= 2) {
      T.hint = s.answer;
      this._paintTeam(team);
      this.toast(`تلميح: الحل في البطاقة المضيئة ✨`, 'hint', team);
    } else {
      this.toast(s.wrong?.[cid] || WRONG[cid] || 'ليس هذا الحل… فكّر مرة أخرى.', 'bad', team);
    }
    this._updateHud();
  }

  _correct(team, s, from) {
    const T = this.state.teams[team];
    T.busy = true;
    T.hint = null;
    // المجسّم يطير من اليد إلى موضعه ويشتعل اللهب (3D)، أو صورته بلهب CSS (الطبقة C)
    const drop = this.$panels[team]?.querySelector('.cw-drop');
    if (this.scene) this.scene.ui.place(team, s.answer, from || this._center(drop));
    else if (drop) {
      const img = drop.querySelector('.cw-placed');
      img.src = thumb(s.answer);
      drop.classList.remove('lit');
      void drop.offsetWidth;
      drop.classList.add('lit');
      fxs.flame(TEAMS[team].pan);
    }
    sfx.correct();
    fxs.sparkle(TEAMS[team].pan);
    say(CARDS[s.answer].label);
    T.msg = { kind: 'good', title: 'أحسنت!', text: s.fact };
    this._paintTeam(team);
    const panel = this.$panels[team];
    panel.classList.remove('good');
    void panel.offsetWidth;
    panel.classList.add('good');
    const v = this._view();
    const d = v ? v.solve(team, s) : 1;
    const prev = s;
    T.i++;
    this.later(() => {
      if (!this.state) return;
      if (T.i >= SITUATIONS.length) return this._teamDone(team);
      const next = this._sit(team);
      const a = v ? v.advance(team, next, prev) : 0.5;
      // اليوم الجديد يظهر على اللوحة أثناء دوران الساعة
      this.later(() => this._cue(team), Math.max(0.6, a) * 1000);
    }, Math.max(1.2, d + 0.6) * 1000);
    this._updateHud();
  }

  _teamDone(team) {
    const st = this.state;
    const T = st.teams[team];
    T.end = performance.now();
    T.busy = true;
    T.msg = { kind: 'good', title: 'صفّك سليم!', text: 'بقي الجميع بخير طوال الأسبوع.' };
    this._paintTeam(team);
    this._view()?.celebrate(team);
    fxs.cheer(TEAMS[team].pan);
    if (st.race && !st.winner) {
      st.winner = team;
      this.toast(`🏆 فاز ${TEAMS[team].name}!`, 'win');
      sfx.win();
    }
    if (Object.values(st.teams).every((x) => x.end)) {
      st.end = performance.now();
      this.later(() => this._finish(), 1400);
    }
  }

  cancel(c) {
    if (c.holding) this._els.get(`card:${c.team}:${c.holding}`)?.classList.remove('taken');
    c.holding = null;
    c.team = null;
  }

  _button(id) {
    sfx.click();
    if (id === 'opt:solo' || id === 'opt:race') {
      this.opts.race = id === 'opt:race';
      this._view()?.setTeams?.(this._teamIds());
      return this.render();
    }
    if (id === 'start' || id === 'again') return this.newGame();
    if (id === 'menu') return this.toMenu();
  }

  // ------------------------------------------------------------------ الختام والنتيجة
  _finish() {
    this.screen = 'outro';
    this.input?.reset();
    this.render();
    const d = this._view()?.outro() || 1;
    this.$bars.classList.add('on');
    sfx.win();
    if (this.$caption) {
      this.$caption.textContent = this.content.outro;
      this.$caption.classList.add('show');
    }
    this.later(() => {
      this.$bars.classList.remove('on');
      this.screen = 'done';
      this.render();
    }, d * 1000 + 600);
  }

  _renderResult(g) {
    const st = this.state;
    const ids = Object.keys(st.teams);
    const total = SITUATIONS.length * ids.length;
    const m = this.mistakes;
    const stars = m === 0 ? 3 : m <= Math.ceil(total * 0.15) ? 2 : 1;
    // أكثر موضوع وقع فيه الخطأ
    const miss = {};
    for (const id of ids) for (const [k, n] of Object.entries(st.teams[id].topicMiss)) miss[k] = (miss[k] || 0) + n;
    const worst = Object.entries(miss).sort((a, b) => b[1] - a[1])[0];
    const panel = this._place(html('div', 'result cw-result'), g.left, g.panelTop, g.right - g.left, g.bottom - g.panelTop);
    const teamsHtml = st.race
      ? ids.map((id) => `<span class="res-team" style="--team:${TEAMS[id].color}">${TEAMS[id].name}: <b>${fmtTime(st.teams[id].end - st.start)}</b> • أخطاء <b>${ar(st.teams[id].mistakes)}</b></span>`).join('')
      : `<span>الوقت <b>${fmtTime(st.end - st.start)}</b></span><span>الأخطاء <b>${ar(m)}</b></span><span>الدقة <b>${ar(Math.round((100 * SITUATIONS.length * ids.length) / (SITUATIONS.length * ids.length + m)))}٪</b></span>`;
    panel.innerHTML = `
      <div class="res-main">
        <div class="stars">${[1, 2, 3].map((i) => `<span class="star${i <= stars ? ' on' : ''}">★</span>`).join('')}</div>
        <div class="res-msg">${stars === 3 ? 'ممتاز! حميتم الصف بلا أي خطأ' : stars === 2 ? 'أحسنتم! الصف سليم' : 'جيد — جرّبوا مرة أخرى'}</div>
        ${st.race && st.winner ? `<div class="winner">🏆 الفائز: ${TEAMS[st.winner].name}</div>` : ''}
      </div>
      <div class="res-stats">${teamsHtml}${worst ? `<span class="cw-review">راجعوا: <b>${esc(TOPICS[worst[0]])}</b></span>` : ''}</div>`;
    const btns = html('div', 'res-btns');
    const again = html('div', 'opt start', '<b>العبوا مجددًا</b>');
    again.dataset.target = 'again';
    const menu = html('div', 'opt', '<b>القائمة</b>');
    menu.dataset.target = 'menu';
    btns.append(again, menu);
    panel.appendChild(btns);
    this.hud.appendChild(panel);
  }

  /** البطاقة المحمولة تحت اليد بهالة محايدة (لا تكشف الإجابة) */
  heldIcon(cid, team) {
    const c = CARDS[cid];
    const teamed = team && team !== 'all';
    const g = svg('g', { class: 'held-item cw-held', 'data-team': teamed ? team : null });
    if (teamed) g.style.setProperty('--team', TEAMS[team].color);
    g.appendChild(svg('circle', { r: 64, class: 'held-halo' }));
    // صورة المجسّم ثلاثي الأبعاد نفسه (مُصيَّرة مسبقًا) فوق هالة محايدة
    const em = svg('image', { href: thumb(cid), x: -58, y: -58, width: 116, height: 116, class: 'cw-held-img' });
    const lb = svg('text', { y: 96, 'text-anchor': 'middle', class: 'cw-held-label' });
    lb.textContent = c.label;
    g.append(em, lb);
    return g;
  }
}
