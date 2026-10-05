// محرر الأسئلة والجوائز لكل خانة ولكل مستوى.
import { Z_OUT, Z_IN, ANG0, COL, CLS_OUT, CLS_IN, TIERS, tierOf, rings } from '../vision/geometry.js';
import { store, defaultConfig } from '../content/store.js';

let $, app, edSel = null;
export function initEditor(a, q) { app = a; $ = q;
  $('btnEdClose').onclick = () => { edStore(); store.save(); $('editor').hidden = true; };
  $('btnExport').onclick = () => { edStore(); $('edJson').value = JSON.stringify(store.cfg); $('edJson').select(); $('edMsg').textContent = 'النص محدَّث. انسخه واحفظه.'; };
  $('btnImport').onclick = () => { try { const o = JSON.parse($('edJson').value); if (!o.tiers || o.tiers.length !== 4) throw 0; store.cfg = Object.assign(defaultConfig(), o); store.save(); openEditor(); $('edMsg').textContent = 'تم الاستيراد.'; } catch { $('edMsg').textContent = 'النص غير صالح. الصق النص كما نسخته من هذه النافذة.'; } };
  $('btnReset').onclick = () => { const d = defaultConfig(); store.cfg.tiers = d.tiers; store.cfg.zones = {}; store.save(); openEditor(); $('edMsg').textContent = 'عادت الأسئلة الافتراضية.'; };
}
export function openEditor() { edSel = null; $('edTitle').textContent = 'اختر خانة'; ['edQ', 'edC', 'edA', 'edP'].forEach((i) => ($(i).value = '')); edBuild(); edTiers(); $('edJson').value = JSON.stringify(store.cfg); $('edMsg').textContent = ''; $('editor').hidden = false; }
function edBuild() {
  const svg = $('edBoard'), NS = 'http://www.w3.org/2000/svg'; svg.innerHTML = '';
  const R_IN = 0.615, R_BULL = 0.165;
  const pt = (r, a) => (r * Math.sin((a * Math.PI) / 180)).toFixed(4) + ' ' + (-r * Math.cos((a * Math.PI) / 180)).toFixed(4);
  const add = (id, pts, fill, d, lr, la) => { const g = document.createElementNS(NS, d ? 'path' : 'circle'); if (d) g.setAttribute('d', d); else g.setAttribute('r', R_BULL); g.setAttribute('fill', fill); g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button'); g.setAttribute('aria-label', 'خانة ' + pts);
    if (edSel === id) g.setAttribute('class', 'sel'); g.onclick = () => edPick(id, pts); g.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') edPick(id, pts); }; svg.append(g);
    const tx = document.createElementNS(NS, 'text'), p = pt(lr, la).split(' '); tx.setAttribute('x', p[0]); tx.setAttribute('y', p[1]); tx.textContent = pts + (store.cfg.zones[id] && store.cfg.zones[id].q ? ' •' : ''); svg.append(tx); };
  for (let i = 0; i < 12; i++) { const a0 = i * 30 + ANG0, a1 = a0 + 30;
    add('o' + i, Z_OUT[i], CLS_OUT(i) === 1 ? COL.o : COL[CLS_OUT(i)], `M ${pt(R_IN, a0)} L ${pt(1, a0)} A 1 1 0 0 1 ${pt(1, a1)} L ${pt(R_IN, a1)} A ${R_IN} ${R_IN} 0 0 0 ${pt(R_IN, a0)} Z`, 0.82, a0 + 15);
    add('i' + i, Z_IN[i], COL[CLS_IN(i)], `M ${pt(R_BULL, a0)} L ${pt(R_IN, a0)} A ${R_IN} ${R_IN} 0 0 1 ${pt(R_IN, a1)} L ${pt(R_BULL, a1)} A ${R_BULL} ${R_BULL} 0 0 0 ${pt(R_BULL, a0)} Z`, 0.42, a0 + 15); }
  add('b', 200, COL[1], null, 0, 0);
}
function edStore() { if (!edSel) return; const z = { q: $('edQ').value, c: $('edC').value, a: $('edA').value, p: $('edP').value }; if (z.q.trim() || z.p.trim()) store.cfg.zones[edSel] = z; else delete store.cfg.zones[edSel]; }
function edPick(id, pts) { edStore(); edSel = id; const z = store.cfg.zones[id] || {}; $('edTitle').textContent = 'خانة ' + pts + ' — مستوى ' + TIERS[tierOf(+pts)].name; $('edQ').value = z.q || ''; $('edC').value = z.c || ''; $('edA').value = z.a || ''; $('edP').value = z.p || ''; edBuild(); }
function edTiers() { const el = $('edTiers'); el.innerHTML = ''; const rng = ['خانات 10', 'خانات 20 إلى 70', 'خانات 80 إلى 190', 'خانة 200'];
  TIERS.forEach((T, i) => { const d = document.createElement('div'); d.className = 'tier'; d.style.setProperty('--tc', T.c);
    const f = (lab, type, val, key, num) => { const l = document.createElement('label'); l.className = 'field'; const s = document.createElement('span'); s.textContent = lab; const inp = document.createElement(type === 'ta' ? 'textarea' : 'input'); if (type !== 'ta') inp.type = type; inp.id = 'tier' + i + key; inp.value = val; inp.oninput = () => { store.cfg.tiers[i][key] = num ? +inp.value || 0 : inp.value; }; l.append(s, inp); return l; };
    const h = document.createElement('h3'); h.textContent = T.name + ' (' + rng[i] + ')'; h.style.color = T.c;
    d.append(h, f('جائزة الإجابة الصحيحة', 'text', store.cfg.tiers[i].prize, 'prize'), f('بنك الأسئلة', 'ta', store.cfg.tiers[i].bank, 'bank')); el.append(d); }); }
