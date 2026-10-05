// مزامنة اختيارية مع Firebase (Firestore). يعمل فقط إذا وُجد إعداد في config.js وكان الجهاز متصلًا.
// يحمّل SDK من CDN جوجل عند الحاجة؛ عدم توفره لا يعطّل اللعبة.
export async function connectCloud(config) {
  if (!config || !config.apiKey) return null;
  const V = '10.14.1';
  const [{ initializeApp }, fs] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`),
  ]);
  const app = initializeApp(config), db = fs.getFirestore(app);
  const school = config.schoolId || 'default';
  return {
    async saveConfig(cfg) { await fs.setDoc(fs.doc(db, 'schools', school, 'qurs', 'config'), { cfg: JSON.parse(JSON.stringify(cfg)), at: Date.now() }); },
    async loadConfig() { const s = await fs.getDoc(fs.doc(db, 'schools', school, 'qurs', 'config')); return s.exists() ? s.data().cfg : null; },
    async addResult(r) { await fs.setDoc(fs.doc(db, 'schools', school, 'results', r.id), r); },
    async results(limit = 100) { const q = fs.query(fs.collection(db, 'schools', school, 'results'), fs.orderBy('at', 'desc'), fs.limit(limit)); const s = await fs.getDocs(q); return s.docs.map((d) => d.data()); },
  };
}
