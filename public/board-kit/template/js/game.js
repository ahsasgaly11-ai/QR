// ---------------------------------------------------------------------------
// قالب «صنّف»: يلتقط الطالب بطاقة عنصر بيده ويضعها في سلة فئتها على السبورة.
// يطبّق عقد اللعبة في board-kit كاملًا (راجع /board-kit/README_AR.md)، ويصلح
// نقطة بداية لأي لعبة سبورة: القائمة، اللعب، السباق بأدوات لكل فريق، النتيجة.
//
// التخطيط (وحدة u: ارتفاع المسرح 1000u):
//   ترويسة (96u) ← السلال في الوسط ← صف البطاقات في الأسفل (في متناول الأطفال).
//   في السباق: نصف الشاشة لكل فريق، بسلاله وبطاقاته ولونه، ولا تقبل سلاله
//   إلا بطاقاته (team على الخانة وعلى اليد).
// ---------------------------------------------------------------------------
import { sfx, say } from '/board-kit/js/audio.js';

const NS = 'http://www.w3.org/2000/svg';
const TEAMS = {
  a: { name: 'الفريق الأول', color: '#8a1538' },
  b: { name: 'الفريق الثاني', color: '#0e7490' },
};
const TRAY_SIZE = 4; // بطاقات ظاهرة في الصف لكل فريق (تُعبّأ كلما وُضعت واحدة)
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
/** النص يدخل HTML: نهرّبه (المحتوى من ملف المعلم لكن الاحتياط واجب). */
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
    this.cat = Object.fromEntries(content.categories.map((c) => [c.id, c]));
    this.item = Object.fromEntries(content.items.map((i) => [i.id, i]));
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
    this.screen = 'menu';
    this.state = null;
    this.input?.reset();
    this.render();
  }
  tickClock() {
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
  }

  /** حدود اللعب: أسفل الترويسة (أو ما يحجزه المعلم أعلى السبورة)، وهامش جانبي يختاره المعلم. */
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

  /** موضع عنصر HTML بوحدة u داخل المسرح. */
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
    if (this.screen === 'menu') this._renderMenu();
    else this._renderPlay();
    const layer = svg('g', { class: 'cursors' });
    this.fx.appendChild(layer);
    this.input?.attachLayer(layer);
    this._collectTargets();
  }

  // ------------------------------------------------------------------ القائمة
  _renderMenu() {
    const { left, right } = this._band();
    const head = html('header', 'hud-header menu-head');
    head.append(html('h1', 'title', esc(this.content.title)), html('p', 'lead', esc(this.content.lead)));
    this.hud.appendChild(head);
    const legend = html('div', 'legend tpl-legend');
    for (const c of this.content.categories) {
      const lg = html('span', 'lg', `<i></i>${esc(c.emoji)} ${esc(c.name)}`);
      lg.style.setProperty('--c', c.color);
      legend.appendChild(lg);
    }
    this.hud.appendChild(legend);
    const panel = html('div', 'menu-panel');
    Object.assign(panel.style, { left: `calc(var(--u) * ${left + 20})`, right: `calc(var(--u) * ${this.VW - right + 20})` });
    const row = html('div', 'menu-row');
    const solo = html('div', `opt${this.opts.race ? '' : ' on'}`, '<b>الصف كله</b><small>بطاقات واحدة للجميع</small>');
    solo.dataset.target = 'opt:solo';
    const race = html('div', `opt${this.opts.race ? ' on' : ''}`, '<b>سباق فريقين</b><small>لكل فريق سلاله وبطاقاته</small>');
    race.dataset.target = 'opt:race';
    row.append(solo, race);
    const row2 = html('div', 'menu-row');
    const start = html('div', 'opt start', '<b>ابدأ</b><small>المس وأبقِ يدك</small>');
    start.dataset.target = 'start';
    row2.appendChild(start);
    panel.append(row, row2);
    this.hud.appendChild(panel);
  }

  // ------------------------------------------------------------------ اللعب
  newGame() {
    const teamIds = this.opts.race ? ['a', 'b'] : ['all'];
    const teams = {};
    for (const id of teamIds) {
      teams[id] = { queue: shuffle(this.content.items.map((i) => i.id)), tray: [], placed: 0, mistakes: 0, wrong: {}, end: 0 };
      this._refill(teams[id]);
    }
    this.state = { race: this.opts.race, teams, start: performance.now(), end: 0, winner: null, seenFact: new Set() };
    this.screen = 'play';
    this.input?.reset();
    this._clearTimers();
    this.render();
  }

  _refill(T) {
    while (T.tray.length < TRAY_SIZE && T.queue.length) T.tray.push(T.queue.shift());
  }

  get mistakes() {
    return this.state ? Object.values(this.state.teams).reduce((s, t) => s + t.mistakes, 0) : 0;
  }

  _renderPlay() {
    const st = this.state;
    const done = this.screen === 'done';
    const { top, bottom, left, right } = this._band();
    const head = html('header', 'hud-header');
    head.appendChild(html('h1', 'title small', esc(this.content.title)));
    const chips = html('div', 'chips');
    this.$progress = html('span', 'chip');
    this.$time = html('span', 'chip time');
    this.$mist = html('span', 'chip warn');
    chips.append(this.$progress, this.$time, this.$mist);
    head.appendChild(chips);
    this.hud.appendChild(head);
    this.$toast = html('div', 'toast');
    this.$fact = html('div', 'fact');
    this.hud.append(this.$toast, this.$fact);

    const barH = st.race ? 46 : 0;
    const trayH = Math.max(150, Math.min(200, (bottom - top) * 0.28)) + barH;
    const trayTop = bottom - trayH;
    const ids = Object.keys(st.teams);
    const mid = this.VW / 2;
    this.$teams = {};
    for (const id of ids) {
      // السباق: الفريق الأول يمينًا (بداية القراءة) والثاني يسارًا
      const x0 = id === 'a' ? mid + 14 : left;
      const x1 = id === 'b' ? mid - 14 : right;
      this._renderTeam(id, { x0, x1, top, trayTop, trayH, barH, done });
    }
    if (done) this._renderResult({ left, right, trayTop, trayH });
    this._updateHud();
  }

  _renderTeam(id, { x0, x1, top, trayTop, trayH, barH, done }) {
    const st = this.state;
    const T = st.teams[id];
    const cats = this.content.categories;
    const ui = (this.$teams[id] = { bins: {}, cards: [] });
    // السلال: صف فوق البطاقات مباشرة (أقرب إلى متناول الأطفال)، لا في أعلى السبورة
    const gap = 24;
    const binsH = Math.min(320, trayTop - 30 - (top + 20));
    const binsTop = trayTop - 30 - binsH;
    const binW = (x1 - x0 - gap * (cats.length - 1)) / cats.length;
    cats.forEach((c, i) => {
      const bin = this._place(html('div', 'tpl-bin'), x1 - (i + 1) * binW - i * gap, binsTop, binW, binsH);
      bin.style.setProperty('--c', c.color);
      bin.innerHTML = `<span class="tpl-bin-emoji">${esc(c.emoji)}</span><b>${esc(c.name)}</b><span class="tpl-bin-count"></span>`;
      bin.dataset.target = `bin:${id}:${c.id}`;
      bin.dataset.kind = 'slot';
      if (st.race) {
        bin.dataset.team = id;
        bin.style.setProperty('--team', TEAMS[id].color);
      }
      this.hud.appendChild(bin);
      ui.bins[c.id] = bin;
    });
    if (done) return;
    const wrap = this._place(html('div', 'tray-wrap'), x0, trayTop, x1 - x0, trayH);
    if (st.race) {
      wrap.dataset.team = id;
      wrap.style.setProperty('--team', TEAMS[id].color);
      const bar = html('div', 'team-bar', `<b>${TEAMS[id].name}</b><span class="tb-bar"><i></i></span><span class="tb-mist"></span>`);
      wrap.appendChild(bar);
      ui.bar = bar.querySelector('i');
      ui.mist = bar.querySelector('.tb-mist');
    }
    const tray = html('div', 'tray');
    const cardW = (x1 - x0 - 3 * 20) / TRAY_SIZE;
    if (cardW < (trayH - barH) * 1.35) tray.classList.add('compact');
    for (let i = 0; i < TRAY_SIZE; i++) {
      const card = html('div', 'card tpl-card');
      tray.appendChild(card);
      ui.cards.push(card);
    }
    wrap.appendChild(tray);
    this.hud.appendChild(wrap);
    this._fillCards(id);
  }

  /** يملأ بطاقات الفريق من صفّه الظاهر. معرّف الهدف = العنصر نفسه، فيبقى ثابتًا وإن تبدّل مكانه. */
  _fillCards(team) {
    const T = this.state.teams[team];
    const ui = this.$teams[team];
    const held = new Set([...(this.input?.cursors.values() || [])].filter((c) => c.team === team).map((c) => c.holding));
    ui.cards.forEach((card, i) => {
      const itemId = T.tray[i];
      if (!itemId) {
        card.innerHTML = '';
        card.classList.add('done');
        delete card.dataset.target;
        return;
      }
      const it = this.item[itemId];
      card.classList.remove('done');
      card.classList.toggle('taken', held.has(itemId));
      card.innerHTML = `<span class="tpl-emoji">${esc(it.emoji)}</span><div class="card-body"><b>${esc(it.label)}</b></div>`;
      card.dataset.target = `card:${team}:${itemId}`;
    });
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
      const [prefix, team, ref] = id.split(':');
      const kind = el.dataset.kind || (prefix === 'card' ? 'card' : 'button');
      this._els.set(id, el);
      this._targets.push({ id, kind, el, team, ref, rect: { x, y, w, h }, pad: 6, enabled: true });
    }
  }

  _updateHud() {
    const st = this.state;
    if (!st || !this.$progress) return;
    const total = this.content.items.length * Object.keys(st.teams).length;
    const placed = Object.values(st.teams).reduce((s, t) => s + t.placed, 0);
    this.$progress.textContent = `${ar(placed)} / ${ar(total)}`;
    this.$mist.textContent = `أخطاء: ${ar(this.mistakes)}`;
    this.tickClock();
    for (const [id, ui] of Object.entries(this.$teams || {})) {
      const T = st.teams[id];
      if (ui.bar) ui.bar.style.width = `${(100 * T.placed) / this.content.items.length}%`;
      if (ui.mist) ui.mist.textContent = `أخطاء: ${ar(T.mistakes)}`;
      for (const c of this.content.categories) {
        const n = (T.byCat?.[c.id] || 0);
        ui.bins[c.id].querySelector('.tpl-bin-count').textContent = n ? ar(n) : '';
      }
    }
  }

  toast(text, kind = '') {
    if (!this.$toast) return;
    this.$toast.textContent = text;
    this.$toast.className = `toast show ${kind}`;
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => this.$toast && (this.$toast.className = 'toast'), 1900);
  }

  _fact(catId) {
    const c = this.cat[catId];
    if (!c.fact || this.state.seenFact.has(catId) || !this.$fact) return;
    this.state.seenFact.add(catId);
    this.$fact.style.setProperty('--c', c.color);
    this.$fact.innerHTML = `<b>${esc(c.name)}</b> ${esc(c.fact)}`;
    this.$fact.className = 'fact show';
    clearTimeout(this._factT);
    this._factT = setTimeout(() => this.$fact && (this.$fact.className = 'fact'), 4500);
  }

  // ------------------------------------------------------------------ الأفعال
  press(c, t) {
    if (t.kind === 'button') return this._button(t.id);
    if (t.kind !== 'card' || this.screen !== 'play') return;
    const { team, ref: itemId } = t;
    const T = this.state.teams[team];
    if (!T || !T.tray.includes(itemId)) return;
    // البطاقة نفسها في اليد: لمسها ثانية يعيدها
    if (c.holding === itemId && c.team === team) {
      c.holding = null;
      c.team = null;
      t.el.classList.remove('taken');
      sfx.back();
      return;
    }
    // بطاقة في يد أخرى الآن لا تُلتقط مرتين
    for (const o of this.input.cursors.values()) if (o !== c && o.holding === itemId && o.team === team) return;
    if (c.holding) this._els.get(`card:${c.team}:${c.holding}`)?.classList.remove('taken');
    c.holding = itemId;
    c.team = team;
    t.el.classList.add('taken');
    sfx.pick();
  }

  drop(c, t) {
    if (this.screen !== 'play' || !c.holding || t.kind !== 'slot') return;
    const team = c.team;
    const T = this.state.teams[team];
    if (!T || t.team !== team) return;
    const it = this.item[c.holding];
    const bin = t.el;
    if (it.category === t.ref) {
      T.tray = T.tray.filter((x) => x !== it.id);
      this._refill(T);
      T.placed++;
      T.byCat = { ...(T.byCat || {}), [t.ref]: (T.byCat?.[t.ref] || 0) + 1 };
      c.holding = null;
      c.team = null;
      sfx.correct();
      say(it.label);
      bin.classList.remove('good');
      void bin.offsetWidth;
      bin.classList.add('good');
      this._fact(t.ref);
      this._fillCards(team);
      this._collectTargets(); // البطاقات تبدّلت: أعد حساب الأهداف
      this._updateHud();
      if (!T.tray.length && !T.end) {
        T.end = performance.now();
        if (this.state.race && !this.state.winner) {
          this.state.winner = team;
          this.toast(`🏆 فاز ${TEAMS[team].name}!`, 'win');
          sfx.win();
        }
      }
      if (Object.values(this.state.teams).every((x) => !x.tray.length)) {
        this.state.end = performance.now();
        this.later(() => this._finish(), 1100);
      }
      return;
    }
    // خطأ: تبقى البطاقة في اليد لتجرّب سلة أخرى، وبعد خطأين تضيء السلة الصحيحة
    T.mistakes++;
    T.wrong[it.id] = (T.wrong[it.id] || 0) + 1;
    sfx.wrong();
    bin.classList.remove('shake');
    void bin.offsetWidth;
    bin.classList.add('shake');
    if (T.wrong[it.id] >= 2) {
      const right = this.$teams[team].bins[it.category];
      right.classList.add('hint');
      this.later(() => right.classList.remove('hint'), 2600);
      this.toast(`تلميح: «${it.label}» مكانه في السلة المضيئة`, 'hint');
    } else {
      this.toast(`ليس «${this.cat[t.ref].name}»… فكّر مرة أخرى`, 'bad');
    }
    this._updateHud();
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
      return this.render();
    }
    if (id === 'start' || id === 'again') return this.newGame();
    if (id === 'menu') return this.toMenu();
  }

  // ------------------------------------------------------------------ النتيجة
  _finish() {
    this.screen = 'done';
    this.input?.reset();
    sfx.win();
    this.render();
  }

  _renderResult({ left, right, trayTop, trayH }) {
    const st = this.state;
    const total = this.content.items.length * Object.keys(st.teams).length;
    const m = this.mistakes;
    const stars = m === 0 ? 3 : m <= Math.ceil(total * 0.15) ? 2 : 1;
    const panel = this._place(html('div', 'result'), left, trayTop - 12, right - left, trayH + 12);
    const teamsHtml = st.race
      ? Object.keys(st.teams)
          .map((id) => `<span class="res-team" style="--team:${TEAMS[id].color}">${TEAMS[id].name}: <b>${fmtTime(st.teams[id].end - st.start)}</b> • أخطاء <b>${ar(st.teams[id].mistakes)}</b></span>`)
          .join('')
      : `<span>الوقت <b>${fmtTime(st.end - st.start)}</b></span><span>الأخطاء <b>${ar(m)}</b></span>`;
    panel.innerHTML = `
      <div class="res-main">
        <div class="stars">${[1, 2, 3].map((i) => `<span class="star${i <= stars ? ' on' : ''}">★</span>`).join('')}</div>
        <div class="res-msg">${stars === 3 ? 'ممتاز! بلا أي خطأ' : stars === 2 ? 'أحسنتم!' : 'جيد — جرّبوا مرة أخرى'}</div>
        ${st.race && st.winner ? `<div class="winner">🏆 الفائز: ${TEAMS[st.winner].name}</div>` : ''}
      </div>
      <div class="res-stats">${teamsHtml}</div>`;
    const btns = html('div', 'res-btns');
    const again = html('div', 'opt start', '<b>العبوا مجددًا</b>');
    again.dataset.target = 'again';
    const menu = html('div', 'opt', '<b>القائمة</b>');
    menu.dataset.target = 'menu';
    btns.append(again, menu);
    panel.appendChild(btns);
    this.hud.appendChild(panel);
  }

  /** العنصر المحمول تحت اليد، بهالة محايدة (لا بلون فئته) حتى لا تكشف الإجابة. */
  heldIcon(itemId, team) {
    const it = this.item[itemId];
    const teamed = team && team !== 'all';
    const g = svg('g', { class: 'held-item tpl-held', 'data-team': teamed ? team : null });
    if (teamed) g.style.setProperty('--team', TEAMS[team].color);
    g.appendChild(svg('circle', { r: 64, class: 'held-halo' }));
    const em = svg('text', { y: 4, 'text-anchor': 'middle', 'dominant-baseline': 'middle', class: 'tpl-held-emoji' });
    em.textContent = it.emoji;
    const lb = svg('text', { y: 92, 'text-anchor': 'middle', class: 'tpl-held-label' });
    lb.textContent = it.label;
    g.append(em, lb);
    return g;
  }
}
