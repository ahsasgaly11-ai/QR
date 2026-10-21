// ---------------------------------------------------------------------------
// الطبقة C الهادئة (بلا WebGL): صورة الصف مُصيَّرة مسبقًا من الطبقة A (WebP)، وفوقها
// علامات الزملاء وحركات CSS خفيفة: رذاذ نقاط، ورموز الحلول، وميزان الحرارة للمريض.
// الواجهة نفسها التي يقدّمها scene3d.js، فاللعبة كاملة في هذه الطبقة.
// تعمل أيضًا مع تقليل الحركة: لا حركة كاميرا، ومدد قصيرة.
// مواضع رؤوس الدمى في الصورة محفوظة في assets/c-meta.json (يصنعها tools/prerender.py).
// ---------------------------------------------------------------------------
const ICON = { elbow: '💪', tissue: '🤧', bin: '🗑️', wash: '🧼', wipe: '🧽', bottle: '🥤', rest: '🏠', distance: '👣' };

export class FlatView {
  constructor(el) {
    this.el = el;
    this.el.classList.add('on');
    this.el.innerHTML = '<img class="cw-bg" alt="" decoding="async"><div class="cw-marks"></div>';
    this.img = this.el.querySelector('.cw-bg');
    this.marks = this.el.querySelector('.cw-marks');
    this.meta = null;
    this.teamIds = ['all'];
    this.rooms = {};
    this.timers = new Set();
    this.onSound = () => {};
    fetch(new URL('../assets/c-meta.json', import.meta.url))
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => {
        this.meta = m;
        this._build();
        this._place();
      })
      .catch(() => {
        this._build();
        this._place();
      });
  }

  later(fn, ms) {
    const t = setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, ms);
    this.timers.add(t);
  }

  setTeams(ids) {
    const key = ids.join(',');
    if (key === this.teamIds.join(',') && this.marks.childElementCount) return;
    this.teamIds = [...ids];
    this._build();
    this._place();
  }

  _mode() {
    return this.teamIds.length === 2 ? 'race' : 'single';
  }

  _build() {
    const M = this.meta?.[this._mode()];
    this.img.src = M ? new URL(`../${M.img}`, import.meta.url).href : '';
    this.img.style.display = M ? '' : 'none';
    this.marks.replaceChildren();
    this.rooms = {};
    for (const id of this.teamIds) {
      const R = (this.rooms[id] = { id, dolls: [] });
      for (let i = 0; i < 6; i++) {
        const d = document.createElement('div');
        d.className = 'cw-mk';
        d.innerHTML = '<i class="ring"></i><span class="ico"></span><span class="spray"></span>';
        this.marks.appendChild(d);
        R.dolls.push(d);
      }
    }
  }

  layout(wPx, hPx, VW, VH, frame) {
    this.VW = VW;
    this.frame = frame;
    this._place();
  }

  /** يضع الصورة حتى يقع الصف داخل المستطيل frame كما في الطبقة A */
  _place() {
    const f = this.frame;
    if (!f) return;
    const M = this.meta?.[this._mode()];
    const fw = f.x1 - f.x0;
    const fh = f.bottom - f.top;
    if (M) {
      const bw = M.box.x1 - M.box.x0;
      const bh = M.box.y1 - M.box.y0;
      const s = Math.min(fw / bw, fh / bh);
      const left = (f.x0 + f.x1) / 2 - ((M.box.x0 + M.box.x1) / 2) * s;
      const top = (f.top + f.bottom) / 2 - ((M.box.y0 + M.box.y1) / 2) * s;
      Object.assign(this.img.style, { left: `calc(var(--u) * ${left})`, top: `calc(var(--u) * ${top})`, width: `calc(var(--u) * ${M.w * s})`, height: `calc(var(--u) * ${M.h * s})` });
      for (const id of this.teamIds) {
        const pts = M.rooms[id] || [];
        this.rooms[id].dolls.forEach((d, i) => {
          const p = pts[i] || [0, 0];
          d.style.left = `calc(var(--u) * ${left + p[0] * s})`;
          d.style.top = `calc(var(--u) * ${top + p[1] * s})`;
          d.style.setProperty('--s', s.toFixed(3));
        });
      }
    } else {
      // بلا صور: الدمى دوائر في صفّين داخل المستطيل
      this.teamIds.forEach((id, k) => {
        const n = this.teamIds.length;
        const x0 = f.x0 + (fw / n) * (n === 2 ? 1 - k : k);
        this.rooms[id].dolls.forEach((d, i) => {
          const col = i % 3;
          const row = Math.floor(i / 3);
          d.style.left = `calc(var(--u) * ${x0 + (fw / n) * (0.22 + col * 0.28)})`;
          d.style.top = `calc(var(--u) * ${f.top + fh * (0.42 + row * 0.3)})`;
          d.classList.add('plain');
        });
      });
    }
  }

  _d(id, i) {
    return this.rooms[id]?.dolls[i];
  }
  _set(id, i, cls, on = true) {
    this._d(id, i)?.classList.toggle(cls, on);
  }
  _icon(id, i, txt) {
    const d = this._d(id, i);
    if (!d) return;
    const ic = d.querySelector('.ico');
    ic.textContent = txt || '';
    ic.classList.remove('pop');
    void ic.offsetWidth;
    if (txt) ic.classList.add('pop');
  }
  /** رذاذ نقاط من دمية نحو أخرى؛ إن كان «محجوزًا» يتوقف قريبًا */
  _spray(id, from, to, blocked) {
    const a = this._d(id, from);
    const b = this._d(id, to);
    if (!a || !b) return;
    const sp = a.querySelector('.spray');
    const dx = b.offsetLeft - a.offsetLeft;
    const dy = b.offsetTop - a.offsetTop;
    sp.style.setProperty('--dx', `${blocked ? dx * 0.18 : dx}px`);
    sp.style.setProperty('--dy', `${blocked ? dy * 0.18 : dy}px`);
    sp.className = 'spray go';
    void sp.offsetWidth;
    sp.classList.add('run');
    this.later(() => (sp.className = 'spray'), 1600);
  }

  reset() {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    for (const R of Object.values(this.rooms)) R.dolls.forEach((d) => {
      d.className = d.className.replace(/\b(sick|hi|away|moved|cheer)\b/g, '').trim();
      d.querySelector('.ico').textContent = '';
    });
  }

  intro() {
    this.reset();
    for (const id of this.teamIds) {
      this._set(id, 1, 'hi');
      this.later(() => this._spray(id, 1, 4, false), 900);
      [[0, 2, 4], [3, 5]].forEach((list, k) => this.later(() => list.forEach((i) => {
        this._set(id, i, 'sick');
        this._icon(id, i, '🤒');
      }), 1500 + k * 600));
      this.later(() => {
        this._set(id, 1, 'sick');
        this._icon(id, 1, '🤒');
      }, 1300);
      this.later(() => {
        for (let i = 0; i < 6; i++) {
          this._set(id, i, 'sick', false);
          this._set(id, i, 'hi', false);
          this._icon(id, i, '');
        }
      }, 3400);
    }
    return { dur: 4.2, marks: [0, 0.9, 1.6, 3.4] };
  }

  cue(id, s) {
    for (let i = 0; i < 6; i++) {
      this._set(id, i, 'hi', false);
      if (i !== s.doll) this._icon(id, i, '');
    }
    this._set(id, s.doll, 'hi');
    this._icon(id, s.doll, s.anim === 'rest' ? '🤒' : '❗');
    if (s.anim === 'rest') this._set(id, s.doll, 'sick');
    if (s.anim === 'bottle' || s.anim === 'distance') {
      this._set(id, s.near, 'sick');
      this._icon(id, s.near, '🤒');
    }
    this.onSound('cue', id);
  }

  solve(id, s) {
    this._icon(id, s.doll, ICON[s.anim] || '✨');
    if (s.anim === 'elbow' || s.anim === 'tissue') {
      this.later(() => this._spray(id, s.doll, s.near, true), 250);
      this.onSound('achoo', id);
      this.later(() => this.onSound('block', id), 600);
    }
    if (s.anim === 'rest') this.later(() => this._set(id, s.doll, 'away'), 600);
    if (s.anim === 'distance') {
      this._set(id, s.doll, 'moved');
      this.later(() => this._spray(id, s.near, s.doll, true), 500);
    }
    const snd = { bin: 'bin', wash: 'bubbles', wipe: 'wipe', bottle: 'gulp', rest: 'door' }[s.anim];
    if (snd) this.later(() => this.onSound(snd, id), 300);
    return 1.4;
  }

  wrong(id, s) {
    this._spray(id, s.doll, s.near, false);
    this._set(id, s.near, 'sick');
    this.later(() => this._set(id, s.near, 'sick', s.anim === 'bottle' || s.anim === 'distance'), 1200);
  }

  advance(id, next, prev) {
    const newDay = !prev || next.day !== prev.day;
    for (let i = 0; i < 6; i++) {
      this._set(id, i, 'hi', false);
      this._icon(id, i, '');
      if (newDay) ['sick', 'away', 'moved'].forEach((c) => this._set(id, i, c, false));
    }
    this.onSound('tick', id);
    return newDay ? 0.9 : 0.6;
  }

  midgame(id) {
    this._set(id, 3, 'hi');
    this._icon(id, 3, '🔍');
    this._spray(id, 4, 3, false);
    this.onSound('mid', id);
    this.later(() => {
      this._set(id, 3, 'hi', false);
      this._icon(id, 3, '');
    }, 2200);
    return 2.4;
  }

  celebrate(id) {
    for (let i = 0; i < 6; i++) {
      ['sick', 'away', 'moved', 'hi'].forEach((c) => this._set(id, i, c, false));
      this._set(id, i, 'cheer');
      this._icon(id, i, '🎉');
    }
  }

  outro() {
    for (const id of this.teamIds) this.celebrate(id);
    return 1.4;
  }

  dispose() {
    this.reset();
    this.el.classList.remove('on');
    this.el.replaceChildren();
  }
}
