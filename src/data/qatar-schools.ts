// ---------------------------------------------------------------------------
//  مدارس دولة قطر — قائمة المدارس الحكومية موزّعة على بلديات قطر الثماني.
//
//  تُستخدم في:
//   • بوّابة اختيار المدرسة قبل تشغيل/تحميل الألعاب التعليمية.
//   • الخريطة الحرارية الحقيقية التي تُظهر تركيز المستخدمين حسب موقع المدرسة.
//
//  ▸ الإحداثيات: تُبنى تلقائيًا من مركز بلدية المدرسة مع إزاحة ثابتة مشتقّة من
//    معرّف المدرسة، فتتوزّع المدارس داخل رقعة بلديتها بشكل واقعي — وهذا يكفي
//    لخريطة حرارية «حسب المنطقة». يمكن للوزارة لاحقًا وضع الإحداثيات الفعلية
//    (GPS) لكل مدرسة في الحقلين lat/lng دون تغيير أي كود آخر.
//
//  ▸ القائمة تمثيلية وقابلة للتوسعة: أضِف صفًّا إلى SCHOOL_SEED ليظهر فورًا في
//    شريط البحث وفي الخريطة.
// ---------------------------------------------------------------------------

export type MunicipalityId =
  | 'doha'
  | 'rayyan'
  | 'wakrah'
  | 'khor'
  | 'daayen'
  | 'ummslal'
  | 'shamal'
  | 'shahaniya';

export type SchoolGender = 'boys' | 'girls' | 'mixed';
export type SchoolStage =
  | 'kindergarten'
  | 'primary'
  | 'prep'
  | 'secondary'
  | 'complex';

export interface Municipality {
  id: MunicipalityId;
  name: string;
  nameEn: string;
  /** مركز البلدية التقريبي (خط العرض/الطول). */
  lat: number;
  lng: number;
  /** نصف قطر الانتشار بالدرجات لتوزيع المدارس داخل البلدية. */
  spread: number;
}

export interface QatarSchool {
  id: string;
  name: string;
  municipalityId: MunicipalityId;
  gender: SchoolGender;
  stage: SchoolStage;
  lat: number;
  lng: number;
}

// --- بلديات قطر الثماني (مراكز تقريبية) ------------------------------------
export const MUNICIPALITIES: Municipality[] = [
  { id: 'doha', name: 'الدوحة', nameEn: 'Doha', lat: 25.2854, lng: 51.5310, spread: 0.055 },
  { id: 'rayyan', name: 'الريان', nameEn: 'Al Rayyan', lat: 25.2569, lng: 51.4000, spread: 0.075 },
  { id: 'wakrah', name: 'الوكرة', nameEn: 'Al Wakrah', lat: 25.1712, lng: 51.5980, spread: 0.060 },
  { id: 'daayen', name: 'الظعاين', nameEn: 'Al Daayen', lat: 25.5780, lng: 51.4820, spread: 0.055 },
  { id: 'ummslal', name: 'أم صلال', nameEn: 'Umm Salal', lat: 25.4180, lng: 51.4030, spread: 0.050 },
  { id: 'khor', name: 'الخور والذخيرة', nameEn: 'Al Khor', lat: 25.6840, lng: 51.4980, spread: 0.060 },
  { id: 'shahaniya', name: 'الشيحانية', nameEn: 'Al Shahaniya', lat: 25.4107, lng: 51.1847, spread: 0.070 },
  { id: 'shamal', name: 'الشمال', nameEn: 'Al Shamal', lat: 26.1290, lng: 51.2000, spread: 0.055 },
];

export const MUNICIPALITY_BY_ID: Record<MunicipalityId, Municipality> =
  Object.fromEntries(MUNICIPALITIES.map((m) => [m.id, m])) as Record<
    MunicipalityId,
    Municipality
  >;

// --- بذرة المدارس: الاسم + البلدية + الجنس + المرحلة ------------------------
// (الإحداثيات تُحسب أدناه من مركز البلدية + إزاحة ثابتة من المعرّف.)
type Seed = [name: string, gender: SchoolGender, stage: SchoolStage];

const SCHOOL_SEED: Record<MunicipalityId, Seed[]> = {
  doha: [
    ['عمر بن الخطاب النموذجية', 'boys', 'primary'],
    ['حمزة بن عبدالمطلب الإعدادية', 'boys', 'prep'],
    ['عبدالله بن رواحة الإعدادية', 'boys', 'prep'],
    ['قطر الثانوية للبنين', 'boys', 'secondary'],
    ['أحمد بن محمد آل ثاني الثانوية', 'boys', 'secondary'],
    ['علي بن جاسم الثانوية', 'boys', 'secondary'],
    ['ابن خلدون الإعدادية', 'boys', 'prep'],
    ['الرازي الثانوية للبنين', 'boys', 'secondary'],
    ['الخنساء الثانوية للبنات', 'girls', 'secondary'],
    ['عائشة أم المؤمنين الابتدائية', 'girls', 'primary'],
    ['فاطمة بنت محمد الابتدائية', 'girls', 'primary'],
    ['أسماء بنت أبي بكر الإعدادية', 'girls', 'prep'],
    ['زبيدة الابتدائية للبنات', 'girls', 'primary'],
    ['الدوحة الثانوية للبنات', 'girls', 'secondary'],
    ['روضة بنت جاسم النموذجية', 'girls', 'primary'],
    ['الأصمعي الابتدائية للبنين', 'boys', 'primary'],
  ],
  rayyan: [
    ['خالد بن الوليد الابتدائية', 'boys', 'primary'],
    ['الريان الثانوية للبنين', 'boys', 'secondary'],
    ['معاذ بن جبل الإعدادية', 'boys', 'prep'],
    ['جاسم بن حمد الثانوية', 'boys', 'secondary'],
    ['سعد بن معاذ الابتدائية', 'boys', 'primary'],
    ['أبو بكر الصديق الإعدادية', 'boys', 'prep'],
    ['المعري الثانوية للبنين', 'boys', 'secondary'],
    ['حصة بنت خليفة الثانوية للبنات', 'girls', 'secondary'],
    ['موزة بنت محمد الإعدادية للبنات', 'girls', 'prep'],
    ['الوجبة الابتدائية للبنات', 'girls', 'primary'],
    ['أم المؤمنين الثانوية للبنات', 'girls', 'secondary'],
    ['السيلية الابتدائية للبنين', 'boys', 'primary'],
    ['الشقب الإعدادية للبنات', 'girls', 'prep'],
    ['معيذر الابتدائية للبنات', 'girls', 'primary'],
    ['الغرافة الثانوية للبنين', 'boys', 'secondary'],
    ['نور الإسلام الابتدائية', 'boys', 'primary'],
  ],
  wakrah: [
    ['الوكرة الثانوية للبنين', 'boys', 'secondary'],
    ['عثمان بن عفان الإعدادية', 'boys', 'prep'],
    ['الوكرة الابتدائية للبنين', 'boys', 'primary'],
    ['المسيلة الابتدائية للبنين', 'boys', 'primary'],
    ['الوكير الإعدادية للبنين', 'boys', 'prep'],
    ['خديجة بنت خويلد الثانوية للبنات', 'girls', 'secondary'],
    ['الوكرة الإعدادية للبنات', 'girls', 'prep'],
    ['مسيمير الابتدائية للبنات', 'girls', 'primary'],
    ['حليمة السعدية الابتدائية للبنات', 'girls', 'primary'],
    ['الوكرة النموذجية للبنات', 'girls', 'secondary'],
    ['المشاف الابتدائية للبنين', 'boys', 'primary'],
    ['الوكير الثانوية للبنات', 'girls', 'secondary'],
  ],
  daayen: [
    ['الظعاين الثانوية للبنين', 'boys', 'secondary'],
    ['سميسمة الابتدائية للبنين', 'boys', 'primary'],
    ['الخيسة الإعدادية للبنين', 'boys', 'prep'],
    ['لوسيل الثانوية للبنين', 'boys', 'secondary'],
    ['روضة الحمامة الابتدائية', 'boys', 'primary'],
    ['أم القرى الثانوية للبنات', 'girls', 'secondary'],
    ['الظعاين الإعدادية للبنات', 'girls', 'prep'],
    ['وادي البنات الابتدائية للبنات', 'girls', 'primary'],
    ['لوسيل الابتدائية للبنات', 'girls', 'primary'],
    ['جري السمر الثانوية للبنات', 'girls', 'secondary'],
    ['الخيسة الابتدائية للبنات', 'girls', 'primary'],
  ],
  ummslal: [
    ['أم صلال الثانوية للبنين', 'boys', 'secondary'],
    ['أم صلال محمد الإعدادية للبنين', 'boys', 'prep'],
    ['العريش الابتدائية للبنين', 'boys', 'primary'],
    ['أم صلال علي الابتدائية للبنين', 'boys', 'primary'],
    ['الخرطيات الثانوية للبنات', 'girls', 'secondary'],
    ['أم صلال الإعدادية للبنات', 'girls', 'prep'],
    ['أم صلال محمد الابتدائية للبنات', 'girls', 'primary'],
    ['الرفاع الابتدائية للبنات', 'girls', 'primary'],
    ['أم صلال النموذجية للبنات', 'girls', 'secondary'],
  ],
  khor: [
    ['الخور الثانوية للبنين', 'boys', 'secondary'],
    ['الخور الإعدادية للبنين', 'boys', 'prep'],
    ['الذخيرة الابتدائية للبنين', 'boys', 'primary'],
    ['الخور النموذجية للبنين', 'boys', 'primary'],
    ['رأس لفان الإعدادية للبنين', 'boys', 'prep'],
    ['الخور الثانوية للبنات', 'girls', 'secondary'],
    ['الذخيرة الإعدادية للبنات', 'girls', 'prep'],
    ['الخور الابتدائية للبنات', 'girls', 'primary'],
    ['فاطمة الزهراء الابتدائية للبنات', 'girls', 'primary'],
    ['الخور المستقلة للبنات', 'girls', 'secondary'],
  ],
  shahaniya: [
    ['الشيحانية الثانوية للبنين', 'boys', 'secondary'],
    ['الشيحانية الإعدادية للبنين', 'boys', 'prep'],
    ['دخان الابتدائية للبنين', 'boys', 'primary'],
    ['الشيحانية الابتدائية للبنين', 'boys', 'primary'],
    ['الجميلية الابتدائية للبنات', 'girls', 'primary'],
    ['الشيحانية الثانوية للبنات', 'girls', 'secondary'],
    ['دخان الإعدادية للبنات', 'girls', 'prep'],
    ['الشيحانية النموذجية للبنات', 'girls', 'primary'],
  ],
  shamal: [
    ['مدينة الشمال الثانوية للبنين', 'boys', 'secondary'],
    ['أبو ظلوف الإعدادية للبنين', 'boys', 'prep'],
    ['الرويس الابتدائية للبنين', 'boys', 'primary'],
    ['الشمال النموذجية للبنين', 'boys', 'primary'],
    ['مدينة الشمال الثانوية للبنات', 'girls', 'secondary'],
    ['أبو ظلوف الابتدائية للبنات', 'girls', 'primary'],
    ['الرويس الإعدادية للبنات', 'girls', 'prep'],
  ],
};

// --- توليد إزاحة ثابتة من المعرّف (بلا عشوائية متغيّرة) ----------------------
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** رقمان زائفا-عشوائيان ثابتان في [-1, 1] مشتقّان من المعرّف. */
function jitter(id: string): [number, number] {
  const h = hashString(id);
  const a = ((h & 0xffff) / 0xffff) * 2 - 1;
  const b = (((h >>> 16) & 0xffff) / 0xffff) * 2 - 1;
  return [a, b];
}

function slugify(name: string, municipalityId: string, i: number): string {
  return `${municipalityId}-${i}-${hashString(name).toString(36)}`;
}

// --- بناء قائمة المدارس النهائية بالإحداثيات ---------------------------------
export const QATAR_SCHOOLS: QatarSchool[] = (() => {
  const out: QatarSchool[] = [];
  for (const m of MUNICIPALITIES) {
    const seeds = SCHOOL_SEED[m.id] ?? [];
    seeds.forEach(([name, gender, stage], i) => {
      const id = slugify(name, m.id, i);
      const [ja, jb] = jitter(id);
      // انتشار بيضوي: خط الطول أوسع قليلًا من خط العرض ليتبع شكل قطر.
      out.push({
        id,
        name,
        municipalityId: m.id,
        gender,
        stage,
        lat: +(m.lat + jb * m.spread * 0.8).toFixed(4),
        lng: +(m.lng + ja * m.spread).toFixed(4),
      });
    });
  }
  return out;
})();

export const SCHOOL_BY_ID: Record<string, QatarSchool> = Object.fromEntries(
  QATAR_SCHOOLS.map((s) => [s.id, s])
);

export const STAGE_LABEL: Record<SchoolStage, string> = {
  kindergarten: 'روضة',
  primary: 'ابتدائية',
  prep: 'إعدادية',
  secondary: 'ثانوية',
  complex: 'مجمّع تعليمي',
};

export const GENDER_LABEL: Record<SchoolGender, string> = {
  boys: 'بنين',
  girls: 'بنات',
  mixed: 'مختلطة',
};

/** تطبيع نص عربي للبحث: إزالة التشكيل وتوحيد الألف والهاء والياء. */
export function normalizeArabic(s: string): string {
  return s
    .replace(/[ً-ْٰ]/g, '') // تشكيل
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

/** بحث في المدارس بالاسم أو اسم البلدية (يتحمّل اختلاف التشكيل والهمزات). */
export function searchSchools(query: string, limit = 40): QatarSchool[] {
  const q = normalizeArabic(query);
  if (!q) return QATAR_SCHOOLS.slice(0, limit);
  const tokens = q.split(' ').filter(Boolean);
  const scored: { s: QatarSchool; score: number }[] = [];
  for (const s of QATAR_SCHOOLS) {
    const hay = normalizeArabic(
      `${s.name} ${MUNICIPALITY_BY_ID[s.municipalityId].name}`
    );
    let score = 0;
    for (const t of tokens) {
      const idx = hay.indexOf(t);
      if (idx === -1) {
        score = -1;
        break;
      }
      score += idx === 0 ? 3 : 1;
    }
    if (score >= 0) scored.push({ s, score });
  }
  scored.sort((a, b) => b.score - a.score || a.s.name.localeCompare(b.s.name));
  return scored.slice(0, limit).map((x) => x.s);
}
