// منطق اللعبة: فرق، أدوار، نقاط، أسئلة، جوائز. لا يلمس DOM؛ يبثّ أحداثًا تستجيب لها الواجهة.
import { zoneAt, tierOf } from '../vision/geometry.js';
import { TEAM_COL } from '../content/store.js';

export class Game extends EventTarget {
  constructor(store) { super(); this.store = store; this.teams = []; this.cur = 0; this.left = 3; this.paused = false; this.busy = false; this.hist = []; this.bankUsed = [{}, {}, {}, {}]; this.startedAt = 0; this.pending = []; }
  get cfg() { return this.store.cfg; }
  start() { const c = this.cfg; this.teams = c.teams.slice(0, c.nTeams).map((n, i) => ({ name: n || 'الفريق ' + (i + 1), c: TEAM_COL[i], score: 0, prizes: [], hits: 0, throws: 0 }));
    this.cur = 0; this.left = c.balls; this.hist = []; this.pending = []; this.paused = false; this.busy = false; this.startedAt = Date.now(); this.emit('change'); }
  emit(type, d) { this.dispatchEvent(new CustomEvent(type, { detail: d || {} })); }
  hit(u, v, auto) {
    if (this.busy && auto) { this.pending.push([u, v]); this.emit('queued', { n: this.pending.length }); return; } // لا تضيع كرة رُميت أثناء المؤثر أو السؤال
    const z = zoneAt(u, v);
    if (!z) { this.emit('miss', { u, v }); return; }
    const tm = this.teams[this.cur], t = tierOf(z.pts);
    tm.score += z.pts; tm.hits++; tm.throws++; this.left--; this.hist.push({ team: this.cur, d: z.pts, prize: false, zone: z.id });
    this.busy = true; this.emit('hit', { z, u, v, t }); this.emit('change');
    const q = this.cfg.qOn ? this.pickQ(z, t) : null;
    setTimeout(() => { if (q) this.emit('question', { z, t, q }); else this.after(); }, t === 3 ? 3300 : t === 2 ? 1700 : 1200);
  }
  pickQ(z, t) {
    const zc = this.cfg.zones[z.id];
    if (zc && zc.q && zc.q.trim()) { const ch = (zc.c || '').split('\n').map((s) => s.trim()).filter(Boolean); let right = -1; const opts = ch.map((s, i) => { if (s[0] === '*') { right = i; return s.slice(1).trim(); } return s; });
      return { q: zc.q.trim(), a: (zc.a || '').trim(), opts: opts.length > 1 && right >= 0 ? opts : null, right, prize: (zc.p || '').trim() }; }
    const lines = (this.cfg.tiers[t].bank || '').split('\n').map((s) => s.trim()).filter(Boolean); if (!lines.length) return null;
    let used = this.bankUsed[t]; if (Object.keys(used).length >= lines.length) used = this.bankUsed[t] = {};
    let i; do { i = Math.floor(Math.random() * lines.length); } while (used[i]); used[i] = 1; const parts = lines[i].split('|');
    return { q: parts[0].trim(), a: (parts[1] || '').trim(), opts: null, right: -1, prize: '' };
  }
  answer(ok, t, q) { const tm = this.teams[this.cur], tr = this.cfg.tiers[t], pz = q.prize || tr.prize;
    if (ok) { tm.score += +tr.bonus || 0; const h = this.hist[this.hist.length - 1]; h.d += +tr.bonus || 0; if (pz) { tm.prizes.push(pz); h.prize = true; } }
    this.emit('answered', { ok, bonus: ok ? +tr.bonus || 0 : 0, prize: ok ? pz : '' }); this.emit('change'); }
  after() { this.busy = false; if (this.left <= 0) this.next();   // انتهى الدور: الكرات الزائدة لا تُحتسب
    if (this.pending.length) { const p = this.pending.shift(); this.busy = true; setTimeout(() => { this.busy = false; this.hit(p[0], p[1], true); }, 450); } }
  next(keepQueue) { if (!keepQueue) this.pending = []; this.cur = (this.cur + 1) % this.teams.length; this.left = this.cfg.balls; this.busy = false; this.emit('turn', { team: this.teams[this.cur] }); this.emit('change'); }
  undo() { const h = this.hist.pop(); if (!h) return false; const tm = this.teams[h.team]; tm.score -= h.d; tm.hits--; tm.throws--; if (h.prize) tm.prizes.pop(); if (this.cur !== h.team) { this.cur = h.team; this.left = 0; } this.left = Math.min(this.cfg.balls, this.left + 1); this.busy = false; this.emit('change'); return true; }
  ranking() { return [...this.teams].sort((a, b) => b.score - a.score); }
  async end() { const r = { className: this.cfg.className || '', teams: this.teams.map((t) => ({ name: t.name, score: t.score, prizes: t.prizes, hits: t.hits })), balls: this.cfg.balls, duration: Date.now() - this.startedAt };
    await this.store.addResult(r); this.emit('end', { ranking: this.ranking() }); return r; }
}
