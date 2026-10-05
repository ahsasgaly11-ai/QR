// المحتوى والإعدادات والنتائج: IndexedDB محليًا (يعمل دون إنترنت)، ومزامنة اختيارية مع Firestore عند توفر الإعداد.
const DB = 'qurs-altahaddi', VER = 1;
const DEF_BANK = [
  'كم عدد حواس الإنسان؟ | خمس حواس\nما العضو الذي نتنفس به؟ | الرئتان\nما لون أوراق النبات غالبًا؟ | الأخضر\nما مصدر الضوء والحرارة للأرض؟ | الشمس\nكم عدد أرجل الحشرة؟ | ست أرجل',
  'ما حالات المادة الثلاث؟ | صلبة وسائلة وغازية\nما العضو الذي يضخ الدم في الجسم؟ | القلب\nماذا نسمي تحوّل الماء السائل إلى بخار؟ | التبخر\nعلى أي كوكب نعيش؟ | الأرض\nماذا يحتاج النبات ليصنع غذاءه؟ | ضوء الشمس والماء والهواء',
  'ما الغاز الذي نحتاجه للتنفس؟ | الأكسجين\nماذا نسمي الحيوانات التي تأكل النباتات فقط؟ | آكلات الأعشاب\nما القوة التي تسحب الأجسام نحو الأرض؟ | الجاذبية\nماذا نسمي تحوّل بخار الماء إلى قطرات ماء؟ | التكثف\nكم كوكبًا في المجموعة الشمسية؟ | ثمانية كواكب',
  'ما أقرب كوكب إلى الشمس؟ | عطارد\nما العملية التي يصنع بها النبات غذاءه؟ | البناء الضوئي\nما أكبر كوكب في المجموعة الشمسية؟ | المشتري',
];
export const TEAM_COL = ['#3fb6ff', '#ff5d8f', '#7be36a', '#ffb020', '#b58cff', '#3fe0d0', '#ff8a4c', '#f25ad6', '#c9e14a', '#7aa2ff', '#ff6b6b', '#e0c38a'];
export const MAX_PLAYERS = 12;
export function defaultConfig() {
  return { teams: ['الفريق الأول', 'الفريق الثاني', 'الفريق الثالث', 'الفريق الرابع'], nTeams: 2, mode: 'groups', players: ['اللاعب الأول', 'اللاعب الثاني'], rounds: 0, balls: 3, qOn: true, grade: 'primary', className: '',
    tiers: [{ bonus: 10, prize: 'تصفيق الصف', bank: DEF_BANK[0] }, { bonus: 30, prize: 'نجمة فضية', bank: DEF_BANK[1] }, { bonus: 60, prize: 'نجمة ذهبية', bank: DEF_BANK[2] }, { bonus: 100, prize: 'وسام البطل', bank: DEF_BANK[3] }], zones: {}, sens: 38 };
}

function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, VER);
    r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv'); if (!d.objectStoreNames.contains('results')) d.createObjectStore('results', { keyPath: 'id' }); if (!d.objectStoreNames.contains('samples')) d.createObjectStore('samples', { keyPath: 'id' }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function tx(store, mode, fn) { try { const d = await openDB(); return await new Promise((res, rej) => { const t = d.transaction(store, mode), s = t.objectStore(store), q = fn(s); t.oncomplete = () => res(q && q.result !== undefined ? q.result : undefined); t.onerror = () => rej(t.error); }); } catch (e) { return undefined; } }

export const store = {
  cfg: defaultConfig(), cloud: null,
  async load() { const c = await tx('kv', 'readonly', (s) => s.get('cfg')); if (c) this.cfg = Object.assign(defaultConfig(), c); else { try { const s = localStorage.getItem('qursCfg'); if (s) this.cfg = Object.assign(defaultConfig(), JSON.parse(s)); } catch {} } return this.cfg; },
  async save() { await tx('kv', 'readwrite', (s) => s.put(JSON.parse(JSON.stringify(this.cfg)), 'cfg')); try { localStorage.setItem('qursCfg', JSON.stringify(this.cfg)); } catch {} this.cloud?.saveConfig(this.cfg).catch(() => {}); },
  async addResult(r) { r.id = r.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 6); r.at = r.at || Date.now(); await tx('results', 'readwrite', (s) => s.put(r)); this.cloud?.addResult(r).catch(() => {}); return r; },
  async results() { const all = await tx('results', 'readonly', (s) => s.getAll()); return (all || []).sort((a, b) => b.at - a.at); },
  async clearResults() { await tx('results', 'readwrite', (s) => s.clear()); },
  async addSample(s) { await tx('samples', 'readwrite', (st) => st.put(s)); },
  async samples() { return (await tx('samples', 'readonly', (s) => s.getAll())) || []; },
  async clearSamples() { await tx('samples', 'readwrite', (s) => s.clear()); },
  async sampleCount() { return (await tx('samples', 'readonly', (s) => s.count())) || 0; },
};
