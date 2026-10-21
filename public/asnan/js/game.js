// ---------------------------------------------------------------------------
// لعبة «ركّب الأسنان»: الشاشات (القائمة، اللعب، النتيجة)، والتخطيط، والقواعد.
//
// وحدة القياس «u»: ارتفاع المسرح = 1000u دائمًا، والعرض يتبع نسبة شاشة الآيباد،
// فتملأ اللعبة الشاشة كلها بلا حواف. الأقواس ترسم في SVG، والنصوص والبطاقات
// والأزرار عناصر HTML (عربية سليمة الاتجاه) تُحجَّم بالمتغير --u.
//
// الأوضاع:
//   • «ركّب»: يلتقط الطالب سنًّا من بطاقة نوعه ويضعه في خانته على الفك.
//   • «تعرّف»: تتوهج خانة، ويلمس الطالب بطاقة النوع الصحيح.
//   • «سباق فريقين» (مع الفكّين): فريق للعلوي وفريق للسفلي، ولكل فريق بطاقاته
//     تحت فكّه، وأسنان بطاقاته لا توضع إلا في فكّه (فلا تتشابك أيدي الفريقين).
// ---------------------------------------------------------------------------
import { TYPES, TYPE_ORDER, jawTeeth, crownPath, rootPath, SLOT_PATH, CROWN_LEN } from './teeth.js';
import { archCurve, placeOnArch, inwardNormal } from './geometry.js';
import { sfx, say } from './audio.js';

const NS = 'http://www.w3.org/2000/svg';
/** عمق القوس ÷ عرضه (الفك البشري أعرض من عمقه). */
const DEPTH = 0.8;
const JAW_NAME = { upper: 'الفك العلوي', lower: 'الفك السفلي' };
const LEVELS = [
  { id: 'upper', label: 'الفك العلوي', sub: '١٦ سنًّا' },
  { id: 'lower', label: 'الفك السفلي', sub: '١٦ سنًّا' },
  { id: 'both', label: 'الفكّان', sub: '٣٢ سنًّا' },
];
const MODES = [
  { id: 'build', label: 'ركّب الأسنان', sub: 'التقط السن وضعه في مكانه' },
  { id: 'quiz', label: 'تعرّف على السن', sub: 'المس نوع السن المضيء' },
];

const ar = (n) => Number(n).toLocaleString('ar-EG');
const fmtTime = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${ar(Math.floor(s / 60))}:${ar(String(s % 60).padStart(2, '0')).padStart(2, '٠')}`;
};

function svg(tag, attrs = {}, children = []) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
  for (const c of children) e.appendChild(c);
  return e;
}

function html(tag, cls, inner) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (inner !== undefined) e.innerHTML = inner;
  return e;
}

/** أيقونة سن قائم (التاج للأعلى) داخل مربع w×h بوحدات SVG المحلية. */
export function toothIconSvg(type, { cls = '' } = {}) {
  const crown = CROWN_LEN[type];
  const rootLen = { incisor: 1.3, canine: 1.62, premolar: 1.18, molar: 0.95 }[type];
  const total = crown + rootLen;
  // نقلب الرسم (التاج للأعلى) ونضعه في مربع 0..1 عرضًا و0..total ارتفاعًا
  const g = svg('g', { transform: `translate(0.5 ${crown}) scale(1 -1)` }, [
    svg('path', { d: rootPath(type), class: 'root' }),
    svg('path', { d: crownPath(type), class: 'crown' }),
  ]);
  return svg('svg', { viewBox: `-0.08 -0.08 1.16 ${total + 0.16}`, class: `tooth-icon t-${type} ${cls}`, 'aria-hidden': 'true' }, [g]);
}

export class Game {
  constructor({ stage, board, hud, fx }) {
    this.stage = stage;
    this.board = board;
    this.hud = hud;
    this.fx = fx;
    this.VH = 1000;
    this.VW = 1600;
    this.screen = 'menu';
    this.opts = { level: 'upper', mode: 'build', race: false };
    this.settings = { reachTop: 0, sideInset: 0 };
    this.input = null; // يُضبط من main.js
    this._targets = [];
    this._els = new Map(); // معرّف الهدف ← عنصره (لإبراز الهدف تحت اليد)
    this._hoverOn = new Set();
    this._timers = new Set();
    this.state = null;
  }

  // ------------------------------------------------------------------ عام
  setView() {
    const r = this.stage.getBoundingClientRect();
    const w = Math.max(1, r.width);
    const h = Math.max(1, r.height);
    this.VW = Math.round((1000 * w) / h);
    this.scale = h / 1000;
    this.stage.style.setProperty('--u', `${this.scale}px`);
    for (const s of [this.board, this.fx]) s.setAttribute('viewBox', `0 0 ${this.VW} ${this.VH}`);
  }

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

  later(fn, ms) {
    const t = setTimeout(() => {
      this._timers.delete(t);
      fn();
    }, ms);
    this._timers.add(t);
    return t;
  }

  _clearTimers() {
    for (const t of this._timers) clearTimeout(t);
    this._timers.clear();
  }

  /** إعادة رسم الشاشة الحالية (عند تغيّر حجم الشاشة أو الإعدادات). */
  render() {
    this.setView();
    this._els.clear();
    this._hoverOn.clear();
    this.board.replaceChildren();
    this.hud.replaceChildren();
    this.fx.replaceChildren();
    this.board.appendChild(this._defs());
    if (this.screen === 'menu') this._renderMenu();
    else this._renderPlay();
    const cursors = svg('g', { class: 'cursors' });
    this.fx.appendChild(cursors);
    this.input?.attachLayer(cursors);
    this._collectTargets();
  }

  _defs() {
    return svg('defs', {}, [
      svg('linearGradient', { id: 'enamel', x1: 0, y1: 0, x2: 1, y2: 1 }, [
        svg('stop', { offset: '0', 'stop-color': '#ffffff' }),
        svg('stop', { offset: '1', 'stop-color': '#e6edf2' }),
      ]),
      svg('linearGradient', { id: 'rootg', x1: 0, y1: 0, x2: 0, y2: 1 }, [
        svg('stop', { offset: '0', 'stop-color': '#f6e7c8' }),
        svg('stop', { offset: '1', 'stop-color': '#e9d2a6' }),
      ]),
    ]);
  }

  /** المساحة الرأسية المتاحة للعب بعد ترويسة أعلى الشاشة (وما يحجزه المعلم إن كان الطلاب لا يصلون للأعلى). */
  _band() {
    const headerH = 96;
    const top = Math.max(headerH + 8, Math.round(this.settings.reachTop * this.VH));
    // هامش جانبي يختاره المعلم إن كانت أطراف الصورة خارج السبورة أو تراها الكاميرا بصعوبة
    const side = Math.round((this.settings.sideInset || 0) * this.VW) + 30;
    return { headerH, top, bottom: this.VH - 14, left: side, right: this.VW - side };
  }

  // ------------------------------------------------------------------ تخطيط الأقواس
  /** يضع فكًّا داخل صندوق بحيث تتسع الأسنان بجذورها، ويُرجع خانات الأسنان. */
  _fitArch(box, jaw) {
    const teeth = jawTeeth(jaw);
    let tw = Math.min(box.w, box.h) * 0.08;
    let result = null;
    for (let i = 0; i < 4; i++) {
      const insetOut = 1.0 * tw; // اللثة نحو الخارج عند القواطع
      const insetSide = 1.0 * tw; // اللثة على الجانبين
      const insetEnd = 0.6 * tw; // طرفا القوس
      const availW = box.w - 2 * insetSide;
      const availH = box.h - insetOut - insetEnd;
      const archW = Math.max(50, Math.min(availW, availH / DEPTH));
      const archH = archW * DEPTH;
      const cx = box.x + box.w / 2;
      const pad = (availH - archH) / 2;
      const top = jaw === 'upper' ? box.y + insetOut + pad : box.y + insetEnd + pad;
      const curve = archCurve({ cx, top, w: archW, h: archH, jaw });
      const placed = placeOnArch(teeth, curve, 0.1);
      const maxW = Math.max(...placed.slots.map((s) => s.width));
      result = { curve, placed, teeth, jaw };
      if (Math.abs(maxW - tw) < 0.5) break;
      tw = maxW;
    }
    return result;
  }

  _jawBoxes(level, region) {
    if (level !== 'both') {
      const w = Math.min(region.w, region.h * 1.7);
      return [{ jaw: level, x: region.x + (region.w - w) / 2, y: region.y, w, h: region.h }];
    }
    const gap = 40;
    const w = Math.min((region.w - gap) / 2, region.h * 1.6);
    const total = 2 * w + gap;
    const x0 = region.x + (region.w - total) / 2;
    // الواجهة من اليمين: العلوي في اليمين والسفلي في اليسار
    return [
      { jaw: 'upper', x: x0 + w + gap, y: region.y, w, h: region.h },
      { jaw: 'lower', x: x0, y: region.y, w, h: region.h },
    ];
  }

  /** يرسم فكًّا (لثة، جذور، تيجان، خانات) ويُرجع الخانات مع عناصرها. */
  _drawJaw(fit, { interactive, filledAll = false }) {
    const { curve, placed, teeth, jaw } = fit;
    const layer = svg('g', { class: `jaw jaw-${jaw}` });
    // على القوس: لثة وتيجان فقط (الجذور داخل اللثة كما في الفم)؛ الجذور تظهر في البطاقات
    const gum = svg('g', { class: 'gum-layer' });
    const slotsL = svg('g', { class: 'slots-layer' });
    const crowns = svg('g', { class: 'crowns-layer' });
    layer.append(gum, slotsL, crowns);

    const meanW = placed.slots.reduce((s, x) => s + x.width, 0) / placed.slots.length;
    // اللثة: شريط على امتداد القوس نحو الخارج (جهة الجذور)
    const off = [];
    const pts = curve.pts;
    for (let i = 0; i < pts.length; i += 6) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(pts.length - 1, i + 1)];
      let tx = b.x - a.x;
      let ty = b.y - a.y;
      const l = Math.hypot(tx, ty) || 1;
      tx /= l;
      ty /= l;
      const { nx, ny } = inwardNormal(curve, pts[i].x, pts[i].y, tx, ty);
      off.push(`${(pts[i].x - nx * meanW * 0.42).toFixed(1)},${(pts[i].y - ny * meanW * 0.42).toFixed(1)}`);
    }
    const line = off.join(' ');
    gum.appendChild(svg('polyline', { points: line, class: 'gum-edge', 'stroke-width': (meanW * 1.12).toFixed(1) }));
    gum.appendChild(svg('polyline', { points: line, class: 'gum', 'stroke-width': (meanW * 1.0).toFixed(1) }));
    const lx = curve.pts[Math.floor(pts.length / 2)].x;
    const labelY = jaw === 'upper' ? Math.max(...pts.map((p) => p.y)) - meanW * 0.2 : Math.min(...pts.map((p) => p.y)) + meanW * 0.55;
    layer.appendChild(svg('text', { x: lx, y: labelY, class: 'jaw-label', 'text-anchor': 'middle' }, [document.createTextNode(JAW_NAME[jaw])]));

    const slots = placed.slots.map((p, i) => {
      const t = teeth[i];
      // عرض التاج 92٪ من نصيبه على القوس: فراغ ظاهر بين الأسنان، ولا تتداخل الخانات عند انحناء المقدّمة
      const tf = `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${p.angle.toFixed(2)}) scale(${(p.width * 0.92).toFixed(3)} ${p.width.toFixed(3)})`;
      const crownEl = svg('g', { transform: tf }, [
        svg('g', { class: `pop t-${t.type}` }, [svg('path', { d: crownPath(t.type), class: 'crown' })]),
      ]);
      const slotEl = svg('g', { transform: tf, class: 'slot' }, [svg('path', { d: SLOT_PATH, class: 'slot-shape' })]);
      crowns.appendChild(crownEl);
      slotsL.appendChild(slotEl);
      const cl = CROWN_LEN[t.type] / 2;
      const slot = {
        ...t,
        x: p.x + p.nx * p.width * cl,
        y: p.y + p.ny * p.width * cl,
        r: Math.max(p.width * 0.72, 44),
        width: p.width,
        filled: filledAll,
        crownEl,
        slotEl,
      };
      this._showSlot(slot, false);
      if (interactive) this._els.set(slot.id, slotEl);
      return slot;
    });
    this.board.appendChild(layer);
    return slots;
  }

  _showSlot(slot, animate) {
    slot.crownEl.style.display = slot.filled ? '' : 'none';
    slot.slotEl.style.display = slot.filled ? 'none' : '';
    if (animate) {
      const inner = slot.crownEl.firstChild;
      inner.classList.remove('popping');
      void inner.getBoundingClientRect();
      inner.classList.add('popping');
    }
  }

  // ------------------------------------------------------------------ القائمة
  _renderMenu() {
    const { headerH, left, right } = this._band();
    this.stage.dataset.screen = 'menu';
    // الصورة: الفكّان كاملان بألوان الأنواع (للتعريف بالأنواع قبل اللعب)
    const region = { x: left + 30, y: headerH + 6, w: right - left - 60, h: this.VH * 0.5 - headerH };
    this.board.classList.add('reveal');
    for (const box of this._jawBoxes('both', region)) this._drawJaw(this._fitArch(box, box.jaw), { interactive: false, filledAll: true });

    const head = html('header', 'hud-header menu-head');
    head.appendChild(html('h1', 'title', 'ركّب الأسنان'));
    head.appendChild(html('p', 'lead', 'القواطع • الأنياب • الضواحك • الطواحن — المس السبورة بيدك وأبقِها لحظة حتى تمتلئ الدائرة'));
    this.hud.appendChild(head);

    const legend = html('div', 'legend menu-legend');
    for (const id of TYPE_ORDER) legend.appendChild(html('span', `lg t-${id}`, `<i></i>${TYPES[id].name}`));
    this.hud.appendChild(legend);

    // الخيارات في النصف السفلي (في متناول الطلاب)
    const panel = html('div', 'menu-panel');
    Object.assign(panel.style, { left: `calc(var(--u) * ${left + 20})`, right: `calc(var(--u) * ${this.VW - right + 20})` });
    const row = (items, key) => {
      const r = html('div', 'menu-row');
      for (const it of items) {
        const b = html('div', `opt${this.opts[key] === it.id ? ' on' : ''}`, `<b>${it.label}</b><small>${it.sub}</small>`);
        b.dataset.target = `opt:${key}:${it.id}`;
        r.appendChild(b);
      }
      return r;
    };
    panel.appendChild(row(MODES, 'mode'));
    panel.appendChild(row(LEVELS, 'level'));
    const raceOk = this.opts.level === 'both';
    const extra = html('div', 'menu-row');
    const race = html('div', `opt toggle${this.opts.race && raceOk ? ' on' : ''}${raceOk ? '' : ' off'}`,
      `<b>سباق فريقين</b><small>${raceOk ? (this.opts.race ? 'مفعّل: لكل فريق فكّه وبطاقاته' : 'لكل فريق فكّه وبطاقاته') : 'مع «الفكّان»'}</small>`);
    race.dataset.target = 'opt:race';
    if (!raceOk) race.dataset.disabled = '1';
    const start = html('div', 'opt start', '<b>ابدأ</b><small>المس وأبقِ يدك</small>');
    start.dataset.target = 'start';
    extra.append(race, start);
    panel.appendChild(extra);
    this.hud.appendChild(panel);
  }

  // ------------------------------------------------------------------ الفرق
  /** الفرق في اللعبة الحالية: فريقان في السباق (لكل فريق فك)، أو فريق واحد لكل الفكوك. */
  _teamsFor(level, race) {
    if (race) return [{ id: 'upper', jaws: ['upper'] }, { id: 'lower', jaws: ['lower'] }];
    return [{ id: 'all', jaws: level === 'both' ? ['upper', 'lower'] : [level] }];
  }

  _teamSlots(team) {
    const jaws = this.state.teams[team].jaws;
    return this.slots.filter((s) => jaws.includes(s.jaw));
  }

  _teamOfJaw(jaw) {
    return this.state.race ? jaw : 'all';
  }

  // ------------------------------------------------------------------ اللعب
  newGame() {
    const { level, mode } = this.opts;
    const race = this.opts.race && level === 'both';
    const teams = {};
    for (const t of this._teamsFor(level, race)) {
      teams[t.id] = { ...t, mistakes: 0, end: 0, wrongStreak: {}, quizTarget: null, quizWrong: 0, lastTypes: [] };
    }
    this.state = {
      level,
      mode,
      race,
      teams,
      start: performance.now(),
      end: 0,
      byType: Object.fromEntries(TYPE_ORDER.map((t) => [t, 0])),
      seenFact: new Set(),
      winner: null,
      filled: new Set(),
    };
    this.screen = 'play';
    this.input?.reset();
    this._clearTimers();
    this.render();
    if (mode === 'quiz') for (const id in teams) this._nextQuiz(id);
  }

  get mistakes() {
    return this.state ? Object.values(this.state.teams).reduce((s, t) => s + t.mistakes, 0) : 0;
  }

  _renderPlay() {
    const st = this.state;
    const done = this.screen === 'done';
    this.stage.dataset.screen = this.screen;
    this.board.classList.toggle('reveal', done);
    const { top, bottom, left, right } = this._band();
    // في السباق تحت كل صف بطاقات شريط للفريق (اسمه وتقدّمه)
    const teamBarH = st.race ? 46 : 0;
    const trayH = Math.max(150, Math.min(205, (bottom - top) * 0.26)) + teamBarH;
    const trayTop = bottom - trayH;
    const region = { x: left + 10, y: top, w: right - left - 20, h: trayTop - 18 - top };

    this.slots = [];
    const boxes = this._jawBoxes(st.level, region);
    for (const box of boxes) {
      this.slots.push(...this._drawJaw(this._fitArch(box, box.jaw), { interactive: !done }));
    }
    for (const s of this.slots) {
      s.filled = st.filled.has(s.id);
      this._showSlot(s, false);
    }

    // الترويسة
    const head = html('header', 'hud-header');
    head.appendChild(html('h1', 'title small', st.mode === 'quiz' ? 'تعرّف على السن' : 'ركّب الأسنان'));
    const chips = html('div', 'chips');
    this.$progress = html('span', 'chip');
    this.$time = html('span', 'chip time');
    this.$mist = html('span', 'chip warn');
    chips.append(this.$progress, this.$time, this.$mist);
    head.appendChild(chips);
    this.hud.appendChild(head);
    this.$toast = html('div', 'toast');
    this.hud.appendChild(this.$toast);
    this.$fact = html('div', 'fact');
    this.hud.appendChild(this.$fact);

    this.$cards = null;
    this.$teams = null;
    if (done) {
      this._renderResult({ trayTop, trayH, left, right });
    } else {
      this.$cards = {};
      this.$teams = {};
      const mid = this.VW / 2;
      for (const team of Object.keys(st.teams)) {
        // السباق: بطاقات العلوي في اليمين تحت فكّه، والسفلي في اليسار تحت فكّه
        const x0 = team === 'upper' ? mid + 14 : left;
        const x1 = team === 'lower' ? mid - 14 : right;
        this._renderTray(team, { x0, x1, top: trayTop, h: trayH, teamBarH });
      }
    }
    this._updateHud();
    if (st.mode === 'quiz' && !done) this._markQuiz();
  }

  _renderTray(team, { x0, x1, top, h, teamBarH }) {
    const st = this.state;
    const wrap = html('div', `tray-wrap team-${team}`);
    Object.assign(wrap.style, {
      left: `calc(var(--u) * ${x0})`,
      width: `calc(var(--u) * ${x1 - x0})`,
      top: `calc(var(--u) * ${top})`,
      height: `calc(var(--u) * ${h})`,
    });
    if (st.race) {
      const bar = html('div', 'team-bar', `<b>فريق ${JAW_NAME[team]}</b><span class="tb-bar"><i></i></span><span class="tb-mist"></span>`);
      wrap.appendChild(bar);
      this.$teams[team] = { bar: bar.querySelector('i'), mist: bar.querySelector('.tb-mist') };
    }
    const tray = html('div', 'tray');
    const gap = 20;
    const cardW = (x1 - x0 - 3 * gap) / 4;
    const cardH = h - teamBarH;
    // بطاقة ضيقة (سباق، أو هاتف بشاشة قصيرة عريضة): الأيقونة فوق الاسم
    if (cardW < cardH * 1.35) tray.classList.add('compact');
    this.$cards[team] = {};
    for (const id of TYPE_ORDER) {
      const T = TYPES[id];
      const card = html('div', `card t-${id}`);
      card.dataset.target = `card:${team}:${id}`;
      card.appendChild(toothIconSvg(id));
      const body = html('div', 'card-body', `<b>${T.name}</b><small>${T.job}</small>`);
      const count = html('span', 'count');
      body.appendChild(count);
      card.appendChild(body);
      tray.appendChild(card);
      this.$cards[team][id] = { card, count };
    }
    wrap.appendChild(tray);
    this.hud.appendChild(wrap);
  }

  _collectTargets() {
    const sr = this.stage.getBoundingClientRect();
    const k = 1 / this.scale;
    const targets = [];
    for (const el of this.hud.querySelectorAll('[data-target]')) {
      const r = el.getBoundingClientRect();
      const id = el.dataset.target;
      const isCard = id.startsWith('card:');
      const [, team, type] = isCard ? id.split(':') : [];
      this._els.set(id, el);
      // الهدف القريب من حافة الشاشة يمتد إليها: كف الطفل عند الحافة (أو خارجها قليلًا) يبقى عليه
      let x = (r.left - sr.left) * k;
      let y = (r.top - sr.top) * k;
      let w = r.width * k;
      let h = r.height * k;
      const EDGE = 90;
      if (x < EDGE) (w += x), (x = 0);
      if (this.VW - (x + w) < EDGE) w = this.VW - x;
      if (this.VH - (y + h) < EDGE) h = this.VH - y;
      targets.push({
        id,
        kind: isCard ? 'card' : 'button',
        team,
        type,
        el,
        rect: { x, y, w, h },
        pad: 6,
        enabled: true,
        disabledEl: el.dataset.disabled === '1',
      });
    }
    if (this.screen === 'play') {
      for (const s of this.slots) targets.push({ id: s.id, kind: 'slot', x: s.x, y: s.y, r: s.r, slot: s, enabled: !s.filled });
    }
    this._targets = targets;
    this._refreshEnabled();
  }

  /** كم سنًّا من النوع يمكن التقاطه من بطاقات الفريق (الخانات الفارغة ناقص ما تحمله أيدي الفريق الآن). */
  available(type, team = 'all') {
    if (!this.slots || !this.state) return 0;
    const empty = this._teamSlots(team).filter((s) => s.type === type && !s.filled).length;
    let held = 0;
    for (const c of this.input?.cursors.values() || []) if (c.holding === type && c.team === team) held++;
    return empty - held;
  }

  _refreshEnabled() {
    const cursors = [...(this.input?.cursors.values() || [])];
    for (const t of this._targets) {
      if (t.kind === 'slot') t.enabled = !t.slot.filled && this.state?.mode === 'build';
      else if (t.kind === 'card' && this.state?.mode === 'build') {
        // تبقى البطاقة هدفًا لمن يحمل سنًّا منها (ليعيده)
        t.enabled = true;
        const holdingIt = cursors.some((c) => c.holding === t.type && c.team === t.team);
        t.el.classList.toggle('empty', this.available(t.type, t.team) <= 0 && !holdingIt);
      } else if (t.disabledEl) t.enabled = false;
    }
  }

  _updateHud() {
    const st = this.state;
    if (!st || !this.$progress) return;
    const total = this.slots.length;
    const n = this.slots.filter((s) => s.filled).length;
    this.$progress.textContent = `${ar(n)} / ${ar(total)}`;
    this.$mist.textContent = `أخطاء: ${ar(this.mistakes)}`;
    this.tickClock();
    if (this.$cards) {
      for (const team of Object.keys(this.$cards)) {
        const ts = this._teamSlots(team);
        for (const id of TYPE_ORDER) {
          const left = ts.filter((s) => s.type === id && !s.filled).length;
          const c = this.$cards[team][id];
          c.count.textContent = st.mode === 'build' ? `بقي ${ar(left)}` : '';
          c.card.classList.toggle('done', st.mode === 'build' && left === 0);
        }
      }
    }
    if (this.$teams) {
      for (const team of Object.keys(this.$teams)) {
        const ts = this._teamSlots(team);
        this.$teams[team].bar.style.width = `${(100 * ts.filter((s) => s.filled).length) / ts.length}%`;
        this.$teams[team].mist.textContent = `أخطاء: ${ar(st.teams[team].mistakes)}`;
      }
    }
  }

  tickClock() {
    if (!this.$time || !this.state) return;
    const end = this.state.end || performance.now();
    this.$time.textContent = `⏱ ${fmtTime(end - this.state.start)}`;
  }

  toast(text, kind = '') {
    if (!this.$toast) return;
    this.$toast.textContent = text;
    this.$toast.className = `toast show ${kind}`;
    clearTimeout(this._toastT);
    this._toastT = this.later(() => this.$toast && (this.$toast.className = 'toast'), 1900);
  }

  _fact(type) {
    const st = this.state;
    if (st.seenFact.has(type) || !this.$fact) return;
    st.seenFact.add(type);
    const T = TYPES[type];
    this.$fact.className = `fact show t-${type}`;
    this.$fact.innerHTML = `<b>${T.name}</b> ${T.fact}`;
    clearTimeout(this._factT);
    this._factT = this.later(() => this.$fact && (this.$fact.className = 'fact'), 4800);
  }

  // ------------------------------------------------------------------ الأفعال
  press(c, t) {
    if (t.kind === 'button') return this._button(t.id);
    if (t.kind !== 'card' || this.screen !== 'play') return;
    const { type, team } = t;
    const st = this.state;
    if (!st.teams[team]) return;
    if (st.mode === 'quiz') return this._answer(team, type, t.el);
    // ركّب: إعادة السن المحمول إلى بطاقته، أو تبديله، أو التقاط سن جديد
    if (c.holding === type && c.team === team) {
      c.holding = null;
      c.team = null;
      sfx.back();
      this._refreshEnabled();
      return;
    }
    const prev = [c.holding, c.team];
    c.holding = null;
    c.team = null;
    if (this.available(type, team) <= 0) {
      [c.holding, c.team] = prev;
      this.toast(`وُضعت كل ${TYPES[type].name}`, 'info');
      return;
    }
    c.holding = type;
    c.team = team;
    sfx.pick();
    this._refreshEnabled();
  }

  drop(c, t) {
    const st = this.state;
    if (this.screen !== 'play' || st.mode !== 'build' || !c.holding) return;
    const slot = t.slot;
    if (!slot || slot.filled) return;
    const team = st.teams[c.team] ? c.team : this._teamOfJaw(slot.jaw);
    if (!st.teams[team].jaws.includes(slot.jaw)) return; // فك الفريق الآخر
    const T = st.teams[team];
    const type = c.holding;
    if (slot.type === type) {
      c.holding = null;
      c.team = null;
      T.wrongStreak[type] = 0;
      this._fill(slot);
      return;
    }
    // خطأ: يبقى السن في يد الطالب ليجرّب خانة أخرى
    T.mistakes++;
    st.byType[type]++;
    T.wrongStreak[type] = (T.wrongStreak[type] || 0) + 1;
    sfx.wrong();
    slot.slotEl.classList.remove('wrong');
    void slot.slotEl.getBoundingClientRect();
    slot.slotEl.classList.add('wrong');
    this.later(() => slot.slotEl.classList.remove('wrong'), 700);
    if (T.wrongStreak[type] >= 2) {
      this.toast(`تلميح: الخانات المضيئة لـ${TYPES[type].name}`, 'hint');
      this._hint((s) => s.type === type && !s.filled && T.jaws.includes(s.jaw));
    } else {
      this.toast(`ليس مكان ${TYPES[type].single}`, 'bad');
    }
    this._updateHud();
  }

  cancel(c) {
    if (c.holding) {
      c.holding = null;
      c.team = null;
      this._refreshEnabled();
    }
  }

  _hint(pred) {
    for (const s of this.slots.filter(pred)) {
      s.slotEl.classList.add('hint');
      this.later(() => s.slotEl.classList.remove('hint'), 2600);
    }
  }

  _fill(slot) {
    const st = this.state;
    slot.filled = true;
    st.filled.add(slot.id);
    this._showSlot(slot, true);
    sfx.correct();
    say(TYPES[slot.type].single);
    this._fact(slot.type);
    for (const t of this._targets) if (t.id === slot.id) t.enabled = false;
    this._refreshEnabled();
    this._updateHud();
    const team = this._teamOfJaw(slot.jaw);
    const T = st.teams[team];
    if (!T.end && this._teamSlots(team).every((s) => s.filled)) {
      T.end = performance.now();
      if (st.race && !st.winner) {
        st.winner = team;
        this.toast(`🏆 فاز فريق ${JAW_NAME[team]}!`, 'win');
        sfx.win();
      }
    }
    if (this.slots.every((s) => s.filled)) {
      st.end = performance.now();
      this.later(() => this._finish(), 1100);
    }
  }

  // ------------------------------------------------------------------ وضع «تعرّف»
  _nextQuiz(team) {
    const T = this.state.teams[team];
    const empty = this._teamSlots(team).filter((s) => !s.filled);
    T.quizTarget = null;
    if (!empty.length) return this._markQuiz();
    // اختيار عشوائي، مع تجنّب تكرار النوع نفسه ثلاث مرات متتالية
    let pick = empty[Math.floor(Math.random() * empty.length)];
    const last = T.lastTypes;
    if (last.length >= 2 && last.every((t) => t === pick.type)) {
      const other = empty.filter((s) => s.type !== pick.type);
      if (other.length) pick = other[Math.floor(Math.random() * other.length)];
    }
    T.lastTypes = [...last, pick.type].slice(-2);
    T.quizTarget = pick.id;
    T.quizWrong = 0;
    this._markQuiz();
  }

  _markQuiz() {
    const targets = new Set(Object.values(this.state.teams).map((t) => t.quizTarget));
    for (const s of this.slots) s.slotEl.classList.toggle('target', targets.has(s.id));
  }

  _answer(team, type, cardEl) {
    const st = this.state;
    const T = st.teams[team];
    const slot = this.slots.find((s) => s.id === T.quizTarget);
    if (!slot || slot.filled) return;
    if (slot.type === type) {
      slot.slotEl.classList.remove('target');
      T.quizTarget = null;
      this._fill(slot);
      if (this._teamSlots(team).some((s) => !s.filled)) this.later(() => this._nextQuiz(team), 650);
      return;
    }
    T.mistakes++;
    st.byType[slot.type]++;
    T.quizWrong++;
    sfx.wrong();
    cardEl.classList.remove('shake');
    void cardEl.offsetWidth;
    cardEl.classList.add('shake');
    if (T.quizWrong >= 2) {
      this.toast('تلميح: انظر إلى البطاقة المضيئة', 'hint');
      const right = this.$cards[team][slot.type].card;
      right.classList.add('hint');
      this.later(() => right.classList.remove('hint'), 2600);
    } else {
      this.toast(`ليس ${TYPES[type].single}ًا… انظر إلى موقع الخانة وحجمها`, 'bad');
    }
    this._updateHud();
  }

  // ------------------------------------------------------------------ النتيجة
  _finish() {
    this.screen = 'done';
    this.input?.reset();
    sfx.win();
    this.render();
  }

  _renderResult({ trayTop, trayH, left, right }) {
    const st = this.state;
    const total = this.slots.length;
    const mistakes = this.mistakes;
    const acc = Math.round((100 * total) / (total + mistakes));
    const stars = mistakes === 0 ? 3 : mistakes <= Math.ceil(total * 0.15) ? 2 : 1;
    const worst = TYPE_ORDER.filter((t) => st.byType[t] > 0).sort((a, b) => st.byType[b] - st.byType[a])[0];
    const panel = html('div', 'result');
    Object.assign(panel.style, {
      top: `calc(var(--u) * ${trayTop - 12})`,
      minHeight: `calc(var(--u) * ${trayH + 12})`,
      left: `calc(var(--u) * ${left})`,
      right: `calc(var(--u) * ${this.VW - right})`,
    });
    const starsHtml = [1, 2, 3].map((i) => `<span class="star${i <= stars ? ' on' : ''}">★</span>`).join('');
    const msg = stars === 3 ? 'ممتاز! بلا أي خطأ' : stars === 2 ? 'أحسنتم!' : 'جيد — جرّبوا مرة أخرى';
    const winner = st.race && st.winner ? `<div class="winner">🏆 الفائز: فريق ${JAW_NAME[st.winner]}</div>` : '';
    const teamsHtml = st.race
      ? ['upper', 'lower']
          .map((id) => {
            const T = st.teams[id];
            return `<span class="res-team team-${id}">فريق ${JAW_NAME[id]}: <b>${fmtTime(T.end - st.start)}</b> • أخطاء <b>${ar(T.mistakes)}</b></span>`;
          })
          .join('')
      : `<span>الوقت <b>${fmtTime(st.end - st.start)}</b></span><span>الأخطاء <b>${ar(mistakes)}</b></span>`;
    panel.innerHTML = `
      <div class="res-main">
        <div class="stars">${starsHtml}</div>
        <div class="res-msg">${msg}</div>
        ${winner}
      </div>
      <div class="res-stats">
        ${teamsHtml}
        <span>الدقة <b>${ar(acc)}٪</b></span>
        ${worst ? `<span>راجعوا <b>${TYPES[worst].name}</b></span>` : ''}
      </div>`;
    const legend = html('div', 'legend');
    for (const id of TYPE_ORDER) legend.appendChild(html('span', `lg t-${id}`, `<i></i>${TYPES[id].name} (${ar(TYPES[id].perJaw)} في كل فك)`));
    panel.appendChild(legend);
    const btns = html('div', 'res-btns');
    const again = html('div', 'opt start', '<b>العبوا مجددًا</b>');
    again.dataset.target = 'again';
    const menu = html('div', 'opt', '<b>القائمة</b>');
    menu.dataset.target = 'menu';
    btns.append(again, menu);
    panel.appendChild(btns);
    this.hud.appendChild(panel);
  }

  _button(id) {
    sfx.click();
    if (id.startsWith('opt:')) {
      const [, key, val] = id.split(':');
      if (key === 'race') this.opts.race = !this.opts.race;
      else this.opts[key] = val;
      this.render();
      return;
    }
    if (id === 'start' || id === 'again') return this.newGame();
    if (id === 'menu') return this.toMenu();
  }

  toMenu() {
    this._clearTimers();
    this.screen = 'menu';
    this.state = null;
    this.slots = null;
    this.$cards = null;
    this.$teams = null;
    this.$progress = null;
    this.input?.reset();
    this.render();
  }

  /** أيقونة السن المحمول تحت اليد (بإطار لون الفريق في السباق). */
  heldIcon(type, team) {
    const g = svg('g', { class: `held-tooth t-${type}${team && team !== 'all' ? ` team-${team}` : ''}` });
    const icon = toothIconSvg(type);
    const size = 92;
    const crown = CROWN_LEN[type];
    const rootLen = { incisor: 1.3, canine: 1.62, premolar: 1.18, molar: 0.95 }[type];
    const h = (size * (crown + rootLen + 0.16)) / 1.16;
    icon.setAttribute('width', size);
    icon.setAttribute('height', h.toFixed(1));
    icon.setAttribute('x', -size / 2);
    icon.setAttribute('y', (-h / 2).toFixed(1));
    g.appendChild(svg('circle', { r: size * 0.78, class: 'held-halo' }));
    g.appendChild(icon);
    return g;
  }
}
