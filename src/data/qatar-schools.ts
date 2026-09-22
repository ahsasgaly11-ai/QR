// ---------------------------------------------------------------------------
//  مدارس دولة قطر — قائمة المدارس الحكومية (بكل المراحل) موزّعة على بلديات قطر.
//
//  تُستخدم في:
//   • بوّابة اختيار المدرسة قبل تشغيل/تحميل الألعاب التعليمية.
//   • الخريطة الحرارية الحقيقية التي تُظهر تركيز المستخدمين حسب موقع المدرسة.
//
//  ▸ مصدر البيانات:
//     1) REAL_SCHOOLS: مدارس حكومية حقيقية بإحداثيات فعلية (GPS) مأخوذة من
//        OpenStreetMap — أدقّها موقعًا.
//     2) SCHOOL_SEED: قائمة منسّقة تغطّي كل المراحل (رياض/ابتدائية/إعدادية/
//        ثانوية/مجمّعات) عبر البلديات الثماني؛ إحداثياتها تُبنى من مركز بلدية
//        المدرسة مع إزاحة ثابتة من المعرّف فتتوزّع داخل رقعة بلديتها.
//
//  ▸ التوسعة: القائمة قابلة للتوسعة بالكامل — أضِف صفًّا إلى SCHOOL_SEED (أو إلى
//    REAL_SCHOOLS مع إحداثيات) ليظهر فورًا في شريط البحث وفي الخريطة. لإدراج
//    السجلّ الرسمي الكامل لوزارة التربية، استبدل هذين المصدرين بملف الوزارة.
// ---------------------------------------------------------------------------

import { normalizeAr } from '@/lib/utils';

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
  lat: number;
  lng: number;
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
  /** true إن كانت الإحداثيات فعلية (GPS) لا محسوبة من مركز البلدية. */
  real?: boolean;
  /** true إن كان موقع/بلدية المدرسة تقديريًّا (لم يُذكر في المصدر الرسمي بعد). */
  approx?: boolean;
}

// --- بلديات قطر الثماني (مراكز تقريبية) ------------------------------------
export const MUNICIPALITIES: Municipality[] = [
  { id: 'doha', name: 'الدوحة', nameEn: 'Doha', lat: 25.2854, lng: 51.531, spread: 0.055 },
  { id: 'rayyan', name: 'الريان', nameEn: 'Al Rayyan', lat: 25.2569, lng: 51.4, spread: 0.075 },
  { id: 'wakrah', name: 'الوكرة', nameEn: 'Al Wakrah', lat: 25.1712, lng: 51.598, spread: 0.06 },
  { id: 'daayen', name: 'الظعاين', nameEn: 'Al Daayen', lat: 25.578, lng: 51.482, spread: 0.055 },
  { id: 'ummslal', name: 'أم صلال', nameEn: 'Umm Salal', lat: 25.418, lng: 51.403, spread: 0.05 },
  { id: 'khor', name: 'الخور والذخيرة', nameEn: 'Al Khor', lat: 25.684, lng: 51.498, spread: 0.06 },
  { id: 'shahaniya', name: 'الشيحانية', nameEn: 'Al Shahaniya', lat: 25.4107, lng: 51.1847, spread: 0.07 },
  { id: 'shamal', name: 'الشمال', nameEn: 'Al Shamal', lat: 26.129, lng: 51.2, spread: 0.055 },
];

export const MUNICIPALITY_BY_ID: Record<MunicipalityId, Municipality> =
  Object.fromEntries(MUNICIPALITIES.map((m) => [m.id, m])) as Record<
    MunicipalityId,
    Municipality
  >;

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** أقرب بلدية لإحداثيات فعلية (لإسناد مدارس OSM إلى بلدياتها). */
function nearestMunicipality(lat: number, lng: number): MunicipalityId {
  let best: MunicipalityId = 'doha';
  let bestD = Infinity;
  for (const m of MUNICIPALITIES) {
    const dLat = lat - m.lat;
    const dLng = (lng - m.lng) * Math.cos((lat * Math.PI) / 180);
    const d = dLat * dLat + dLng * dLng;
    if (d < bestD) {
      bestD = d;
      best = m.id;
    }
  }
  return best;
}

// ===========================================================================
//  1) مدارس حكومية حقيقية بإحداثيات فعلية (المصدر: OpenStreetMap)
//     [الاسم, الجنس, المرحلة, خط العرض, خط الطول]
// ===========================================================================
type Real = [name: string, gender: SchoolGender, stage: SchoolStage, lat: number, lng: number];

const REAL_SCHOOLS: Real[] = [
  ['عمر بن الخطاب المستقلة الثانوية للبنين', 'boys', 'secondary', 25.3064, 51.50108],
  ['خليفة النموذجية المستقلة للبنين', 'boys', 'complex', 25.30913, 51.47587],
  ['اليرموك المستقلة الإعدادية للبنين', 'boys', 'prep', 25.3031, 51.49163],
  ['خولة بنت الأزور المستقلة الابتدائية للبنات', 'girls', 'primary', 25.31298, 51.47489],
  ['آمنة بنت وهب المستقلة الإعدادية للبنات', 'girls', 'prep', 25.29919, 51.48777],
  ['أبو عبيدة المستقلة الإعدادية للبنين', 'boys', 'prep', 25.34636, 51.42277],
  ['موزة بنت محمد المستقلة الإعدادية للبنات', 'girls', 'prep', 25.22901, 51.54961],
  ['الوفاء النموذجية المستقلة للبنين', 'boys', 'complex', 25.23523, 51.54456],
  ['ميمونة المستقلة الابتدائية للبنات', 'girls', 'primary', 25.253, 51.5397],
  ['حفصة المستقلة الإعدادية للبنات', 'girls', 'prep', 25.26637, 51.50976],
  ['النفيسة المستقلة الإعدادية للبنات', 'girls', 'prep', 25.27428, 51.52865],
  ['خديجة بنت خويلد المستقلة الابتدائية للبنات', 'girls', 'primary', 25.25274, 51.5022],
  ['سمية المستقلة الابتدائية للبنات', 'girls', 'primary', 25.267, 51.51143],
  ['ابن الهيثم المستقلة الابتدائية للبنين', 'boys', 'primary', 25.24094, 51.56215],
  ['الإيمان الثانوية المستقلة', 'mixed', 'secondary', 25.24254, 51.50984],
  ['الدوحة المستقلة الثانوية للبنين', 'boys', 'secondary', 25.21646, 51.49391],
  ['أم هاني الابتدائية للبنات', 'girls', 'primary', 25.19736, 51.36566],
  ['ماريا القبطية الإعدادية للبنات', 'girls', 'prep', 25.44909, 51.43789],
  ['الأحنف بن قيس المستقلة للبنين', 'boys', 'complex', 25.35692, 51.50398],
  ['أبي حنيفة النموذجية للبنين', 'boys', 'complex', 25.35692, 51.50687],
  ['عمر بن عبدالعزيز المستقلة الثانوية للبنين', 'boys', 'secondary', 25.332, 51.48338],
  ['آمنة محمود الجدة المستقلة الابتدائية للبنات', 'girls', 'primary', 25.35274, 51.47754],
  ['الرشاد المستقلة الابتدائية للبنين', 'boys', 'primary', 25.35387, 51.47755],
  ['غرناطة المستقلة الإعدادية للبنات', 'girls', 'prep', 25.32895, 51.51192],
  ['زهرة المستقلة الابتدائية للبنات', 'girls', 'primary', 25.37763, 51.46538],
  ['حطين النموذجية المستقلة للبنين', 'boys', 'complex', 25.24959, 51.44183],
  ['البيان المستقلة الثانوية للبنات', 'girls', 'secondary', 25.31408, 51.48864],
  ['علي بن جاسم الثانوية للبنين', 'boys', 'secondary', 25.32889, 51.38725],
  ['عبدالرحمن بن جاسم الإعدادية للبنين', 'boys', 'prep', 25.17314, 51.60087],
  ['مسيبة بنت كعب المستقلة الابتدائية للبنات', 'girls', 'primary', 25.21247, 51.4748],
  ['أبي أيوب الأنصاري النموذجية المستقلة للبنين', 'boys', 'complex', 25.20701, 51.47814],
  ['الأقصى المستقلة الإعدادية للبنات', 'girls', 'prep', 25.2106, 51.48795],
  ['الوكرة المستقلة الإعدادية للبنات', 'girls', 'prep', 25.18557, 51.58943],
  ['سعود بن عبدالرحمن المستقلة للبنين', 'boys', 'complex', 25.18845, 51.61029],
];

// ===========================================================================
//  2) قائمة منسّقة تغطّي كل المراحل عبر البلديات — [الاسم, الجنس, المرحلة]
//     (الإحداثيات تُحسب من مركز البلدية + إزاحة ثابتة من المعرّف.)
// ===========================================================================
type Seed = [name: string, gender: SchoolGender, stage: SchoolStage];

const SCHOOL_SEED: Record<MunicipalityId, Seed[]> = {
  doha: [
    ['روضة الدوحة الأولى', 'mixed', 'kindergarten'],
    ['روضة الأندلس', 'mixed', 'kindergarten'],
    ['روضة الوعب', 'mixed', 'kindergarten'],
    ['عمر بن الخطاب النموذجية', 'boys', 'primary'],
    ['حمزة بن عبدالمطلب الإعدادية', 'boys', 'prep'],
    ['عبدالله بن رواحة الإعدادية', 'boys', 'prep'],
    ['قطر الثانوية للبنين', 'boys', 'secondary'],
    ['أحمد بن محمد آل ثاني الثانوية', 'boys', 'secondary'],
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
    ['المعارف الابتدائية للبنين', 'boys', 'primary'],
    ['النهضة الإعدادية للبنات', 'girls', 'prep'],
  ],
  rayyan: [
    ['روضة الريان الأولى', 'mixed', 'kindergarten'],
    ['روضة الغرافة', 'mixed', 'kindergarten'],
    ['روضة معيذر', 'mixed', 'kindergarten'],
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
    ['نور الإسلام الابتدائية للبنين', 'boys', 'primary'],
    ['بروة الرياض الابتدائية للبنات', 'girls', 'primary'],
  ],
  wakrah: [
    ['روضة الوكرة الأولى', 'mixed', 'kindergarten'],
    ['روضة الوكير', 'mixed', 'kindergarten'],
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
    ['روضة الظعاين الأولى', 'mixed', 'kindergarten'],
    ['روضة لوسيل', 'mixed', 'kindergarten'],
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
    ['روضة أم صلال الأولى', 'mixed', 'kindergarten'],
    ['روضة الخرطيات', 'mixed', 'kindergarten'],
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
    ['روضة الخور الأولى', 'mixed', 'kindergarten'],
    ['روضة الذخيرة', 'mixed', 'kindergarten'],
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
    ['روضة الشيحانية الأولى', 'mixed', 'kindergarten'],
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
    ['روضة الشمال الأولى', 'mixed', 'kindergarten'],
    ['مدينة الشمال الثانوية للبنين', 'boys', 'secondary'],
    ['أبو ظلوف الإعدادية للبنين', 'boys', 'prep'],
    ['الرويس الابتدائية للبنين', 'boys', 'primary'],
    ['الشمال النموذجية للبنين', 'boys', 'primary'],
    ['مدينة الشمال الثانوية للبنات', 'girls', 'secondary'],
    ['أبو ظلوف الابتدائية للبنات', 'girls', 'primary'],
    ['الرويس الإعدادية للبنات', 'girls', 'prep'],
  ],
};

// --- توليد إزاحة ثابتة من المعرّف ------------------------------------------
function jitter(id: string): [number, number] {
  const h = hashString(id);
  const a = ((h & 0xffff) / 0xffff) * 2 - 1;
  const b = (((h >>> 16) & 0xffff) / 0xffff) * 2 - 1;
  return [a, b];
}

function slug(name: string, munId: string, i: number): string {
  return `${munId}-${i}-${hashString(name).toString(36)}`;
}

// --- بناء قائمة المدارس النهائية (دمج + إزالة التكرار بالاسم) ----------------
// ===========================================================================
//  3) قائمة المدارس الرسمية المستوردة من دليل الوزارة (2025-2026).
//     [الاسم, الجنس, المرحلة, البلدية, تقديري؟] — الأسماء/المراحل/الأجناس من
//     أعمدة الدليل؛ والبلدية من عمودَي البلدية/المنطقة أو من اسم المدرسة.
//     ما لم يُذكر له موقع في المصدر يُوسَم approx ويُجمع مبدئيًّا تحت الدوحة
//     ريثما تُعتمد بلديته/إحداثياته من خدمة «أين مدرستي؟»/نظام GIS قطر.
// ===========================================================================
type Official = [
  name: string,
  gender: SchoolGender,
  stage: SchoolStage,
  mun: MunicipalityId,
  approx?: boolean
];

const OFFICIAL_SCHOOLS: Official[] = [
  ['أروى بنت عبد المطلب الثانوية', 'girls', 'secondary', 'doha', true],
  ['أسماء بنت أبي بكر الابتدائية', 'girls', 'primary', 'doha', true],
  ['أسماء بنت يزيد الأنصارية الثانوية', 'girls', 'secondary', 'doha', true],
  ['الاسراء الابتدائية للبنات', 'girls', 'primary', 'doha'],
  ['الأندلس الابتدائية', 'girls', 'primary', 'doha', true],
  ['البيان الابتدائية الأولى', 'girls', 'primary', 'doha', true],
  ['البيان الاعدادية للبنات', 'girls', 'prep', 'doha'],
  ['البيان الاولى للبنات', 'girls', 'primary', 'doha'],
  ['التعاون الابتدائية', 'girls', 'primary', 'doha', true],
  ['الثمامة الابتدائية للبنات', 'girls', 'primary', 'doha'],
  ['الثمامة الثانوية للبنات', 'girls', 'secondary', 'doha'],
  ['الجميلية الابتدائية الإعدادية الثانوية للبنات', 'girls', 'complex', 'shahaniya'],
  ['الخرسعة الابتدائية الإعدادية', 'girls', 'complex', 'rayyan'],
  ['الخرسعة الابتدائية الإعدادية الثانوية للبنات', 'girls', 'complex', 'rayyan'],
  ['الخرسعة الابتدائية للبنات', 'girls', 'primary', 'rayyan'],
  ['الخريطيات الابتدائية للبنات', 'girls', 'primary', 'ummslal'],
  ['الخنساء الابتدائية', 'girls', 'primary', 'doha', true],
  ['الخوارزمي الابتدائية', 'girls', 'primary', 'doha', true],
  ['الرسالة الثانوية للبنات', 'girls', 'secondary', 'doha'],
  ['السيلية الثانوية', 'girls', 'secondary', 'rayyan'],
  ['الشحانية الإعدادية الثانوية للبنات', 'girls', 'complex', 'shahaniya'],
  ['الشحانية الإعدادية للبنات', 'girls', 'prep', 'shahaniya'],
  ['الشفاء بنت عبد الرحمن الأنصارية الابتدائية', 'girls', 'primary', 'doha', true],
  ['الشقب الابتدائية', 'girls', 'primary', 'doha', true],
  ['الشمال الابتدائية للبنات', 'girls', 'primary', 'shamal'],
  ['الشمال الاعدادية الثانوية للبنات', 'girls', 'complex', 'shamal'],
  ['الشيماء الثانوية', 'girls', 'secondary', 'doha', true],
  ['الظعاين الابتدائية', 'girls', 'primary', 'daayen'],
  ['العب الثانوية', 'girls', 'secondary', 'doha', true],
  ['الغويرية الابتدائية الاعدادية الثانوية للبنات', 'girls', 'complex', 'doha'],
  ['الفلاح الابتدائية', 'girls', 'primary', 'doha', true],
  ['الكرعانة الابتدائية الاعدادية الثانوية للبنات', 'girls', 'complex', 'rayyan'],
  ['الكعبان الابتدائية الإعدادية الثانوية للبنات', 'girls', 'complex', 'khor'],
  ['الكوثر الثانوية', 'girls', 'secondary', 'doha', true],
  ['المرخية الابتدائية', 'girls', 'primary', 'doha', true],
  ['النهضة الابتدائية', 'girls', 'primary', 'doha', true],
  ['الهداية لذوي الاحتياجات الخاصة (الثمامة)', 'girls', 'complex', 'doha', true],
  ['الهداية لذوي الاحتياجات الخاصة (الصخامة)', 'girls', 'complex', 'doha', true],
  ['الهدى الابتدائية للبنات', 'girls', 'primary', 'rayyan'],
  ['الوجبة الإعدادية', 'girls', 'prep', 'rayyan'],
  ['الوكير الابتدائية للبنات', 'girls', 'primary', 'wakrah'],
  ['أم ايمن الثانوية', 'girls', 'secondary', 'doha', true],
  ['أم حكيم الثانوية', 'girls', 'secondary', 'doha', true],
  ['أم معبد الإعدادية', 'girls', 'prep', 'doha', true],
  ['أمامه الابتدائية للبنات', 'girls', 'primary', 'rayyan'],
  ['أمامة بنت حمزة الابتدائية', 'girls', 'primary', 'doha', true],
  ['آمنة بنت الأرقم المخزومية الثانوية للبنات', 'girls', 'secondary', 'khor'],
  ['آمنه بنت وهب الثانوية للبنات', 'girls', 'secondary', 'doha'],
  ['آمنة محمود الجيدة الابتدائية', 'girls', 'primary', 'doha', true],
  ['برزان الإعدادية', 'girls', 'prep', 'doha', true],
  ['بروق الابتدائية', 'girls', 'primary', 'doha', true],
  ['جويرية بنت الحارث الابتدائية', 'girls', 'primary', 'doha', true],
  ['دخان الابتدائية الاعدادية الثانوية للبنات', 'girls', 'complex', 'shahaniya'],
  ['رابعة العدوية الثانوية للبنات', 'girls', 'secondary', 'doha'],
  ['رفيدة بنت كعب الاعدادية للبنات', 'girls', 'prep', 'rayyan'],
  ['رقية الاعدادية للبنات', 'girls', 'prep', 'doha'],
  ['رملة بنت أبي سفيان الثانوية للبنات', 'girls', 'secondary', 'ummslal'],
  ['روضة بنت جاسم الثانوية', 'girls', 'secondary', 'doha', true],
  ['روضة بنت محمد الثانوية', 'girls', 'secondary', 'doha', true],
  ['روضة راشد الابتدائية الإعدادية الثانوية للبنات', 'girls', 'complex', 'rayyan'],
  ['زبيدة الثانوية', 'girls', 'secondary', 'doha', true],
  ['زكريت الابتدائية', 'girls', 'primary', 'doha', true],
  ['زينب الإعدادية', 'girls', 'prep', 'doha', true],
  ['زينب بنت جحش الابتدائية', 'girls', 'primary', 'doha', true],
  ['سكينة الاعدادية للبنات', 'girls', 'prep', 'rayyan'],
  ['سكينة بنت الحسين الإعدادية', 'girls', 'prep', 'doha', true],
  ['سودة بنت زمعة الإعدادية', 'girls', 'prep', 'doha', true],
  ['صفية بنت عبد المطلب الابتدائية', 'girls', 'primary', 'doha', true],
  ['طيبة الابتدائية للبنات', 'girls', 'primary', 'doha'],
  ['عائشة بنت أبي بكر الثانوية للبنات', 'girls', 'secondary', 'rayyan'],
  ['فاطمة الزهراء الإعدادية', 'girls', 'prep', 'doha', true],
  ['فاطمة بنت الخطاب الابتدائية', 'girls', 'primary', 'doha', true],
  ['فاطمة بنت الوليد بن المغيرة الإعدادية', 'girls', 'prep', 'doha', true],
  ['قطر الابتدائية', 'girls', 'primary', 'doha', true],
  ['قطر الإعدادية', 'girls', 'prep', 'doha', true],
  ['قطر التقنية الثانوية للبنات - الشمال', 'girls', 'secondary', 'shamal'],
  ['قطر للعلوم المصرفية وإدارة الأعمال الثانوية', 'girls', 'secondary', 'doha', true],
  ['لعبيب الابتدائية', 'girls', 'primary', 'doha', true],
  ['مارية القبطية الإعدادية', 'girls', 'prep', 'doha', true],
  ['مجمع التربية السمعية', 'girls', 'complex', 'doha'],
  ['مدرسة الهداية لذوي الاحتياجات الخاصَّة', 'girls', 'complex', 'doha'],
  ['مريم بنت عمران الابتدائية', 'girls', 'primary', 'doha', true],
  ['مسيعيد الابتدائية الإعدادية الثانوية', 'girls', 'complex', 'doha', true],
  ['معيذر الإعدادية', 'girls', 'prep', 'rayyan'],
  ['معيذر الثانوية للبنات', 'girls', 'secondary', 'rayyan'],
  ['موزة بنت محمد الابتدائية', 'girls', 'primary', 'doha', true],
  ['نسيبة بنت كعب الابتدائية', 'girls', 'primary', 'doha', true],
  ['هاجر الابتدائية', 'girls', 'primary', 'doha', true],
  ['هند بنت أبى سفيان الثانوية', 'girls', 'secondary', 'doha', true],
  ['هند بنت عتبة الإعدادية للبنات', 'girls', 'prep', 'rayyan'],
  ['هند بنت عمرو الأنصارية الإعدادية للبنات', 'girls', 'prep', 'ummslal'],
  ['ابن تيمية الثانوية للبنين', 'boys', 'secondary', 'ummslal'],
  ['أبي عبيدة الاعدادية للبنين', 'boys', 'prep', 'rayyan'],
  ['أحمد بن حنبل الثانوية للبنين', 'boys', 'secondary', 'doha'],
  ['أحمد بن راشد المريخي الابتدائية', 'boys', 'primary', 'doha', true],
  ['أحمد بن محمد الثانوية', 'boys', 'secondary', 'doha', true],
  ['أحمد منصور الابتدائية', 'boys', 'primary', 'doha', true],
  ['أسامة بن زيد الإعدادية', 'boys', 'prep', 'doha', true],
  ['الأحنف بن قيس الإعدادية', 'boys', 'prep', 'doha', true],
  ['الإخلاص النموذجية', 'boys', 'complex', 'doha', true],
  ['الامام الشافعي الاعدادية للبنين', 'boys', 'prep', 'rayyan'],
  ['الخليج العربي النموذجية', 'boys', 'complex', 'doha', true],
  ['الدوحة الإعدادية', 'boys', 'prep', 'doha', true],
  ['الذخيرة النموذجية لبنين', 'boys', 'primary', 'khor'],
  ['الرازي الاعدادية للبنين', 'boys', 'prep', 'doha'],
  ['الرشاد النموذجية', 'boys', 'complex', 'doha', true],
  ['الزبارة الابتدائية الإعدادية الثانوية للبنين', 'boys', 'complex', 'doha', true],
  ['الزبير بن العوام الابتدائية', 'boys', 'primary', 'doha', true],
  ['الشحانية النموذجية', 'boys', 'complex', 'shahaniya'],
  ['الشروق النموذجية', 'boys', 'complex', 'doha', true],
  ['الشمال الابتدائية الإعدادية', 'boys', 'complex', 'shamal'],
  ['الشمال الإعدادية للبنين', 'boys', 'prep', 'shamal'],
  ['الشمال الثانوية للبنين', 'boys', 'secondary', 'shamal'],
  ['القادسية النموذجية للبنين', 'boys', 'complex', 'doha', true],
  ['القدس النموذجية', 'boys', 'complex', 'doha', true],
  ['الكعبان الابتدائية الإعدادية', 'boys', 'complex', 'doha', true],
  ['المثنى بن حارثة النموذجية', 'boys', 'complex', 'doha', true],
  ['المعهد الديني الإعدادي الثانوي', 'boys', 'complex', 'doha', true],
  ['المنار النموذجية للبنين', 'boys', 'complex', 'doha', true],
  ['أم العمد النموذجية', 'boys', 'complex', 'doha', true],
  ['أم القرى الابتدائية', 'boys', 'primary', 'doha', true],
  ['أم صلال محمد النموذجية للبنين', 'boys', 'primary', 'ummslal'],
  ['بلال بن رباح النموذجية للبنين', 'boys', 'primary', 'rayyan'],
  ['جابر بن حيان الابتدائية', 'boys', 'primary', 'doha', true],
  ['جوعان بن جاسم النموذجية', 'boys', 'complex', 'doha', true],
  ['حسان بن ثابت الثانوية', 'boys', 'secondary', 'doha', true],
  ['حمد بن عبد الله بن جاسم الثانوية', 'boys', 'secondary', 'doha', true],
  ['حمزة الاعدادية للبنين', 'boys', 'prep', 'doha'],
  ['حمزة بن عبد المطلب الإعدادية', 'boys', 'prep', 'doha', true],
  ['خالد بن أحمد الاعدادية للبنين', 'boys', 'prep', 'doha'],
  ['خالد بن الوليد الإعدادية', 'boys', 'prep', 'doha', true],
  ['خليفة الثانوية', 'boys', 'secondary', 'doha', true],
  ['سعد بن أبي وقاص النموذجية', 'boys', 'complex', 'doha', true],
  ['سعود بن عبد الرحمن النموذجية', 'boys', 'complex', 'doha', true],
  ['سعيد بن زيد الإعدادية للبنين', 'boys', 'prep', 'wakrah'],
  ['سميسمة الإعدادية', 'boys', 'prep', 'daayen'],
  ['سميسمة الثانوية', 'boys', 'secondary', 'daayen'],
  ['صلاح الدين الايوبي الاعدادية للبنين', 'boys', 'prep', 'rayyan'],
  ['طارق بن زياد الثانوية للبنين', 'boys', 'secondary', 'doha'],
  ['طلحة بن عبيد الله الإعدادية للبنين', 'boys', 'prep', 'daayen'],
  ['عبد الحميد الدايل النموذجية', 'boys', 'complex', 'doha', true],
  ['عبد الرحمن بن جاسم الإعدادية', 'boys', 'prep', 'doha', true],
  ['عبد الرحمن بن عوف الإعدادية', 'boys', 'prep', 'doha', true],
  ['عبد الله بن الزبير النموذجية', 'boys', 'complex', 'doha', true],
  ['عبد الله بن تركي السبيعي النموذجية', 'boys', 'complex', 'doha', true],
  ['عبد الله بن جاسم آل ثاني النموذجية', 'boys', 'complex', 'doha', true],
  ['عبد الله بن رواحة الابتدائية', 'boys', 'primary', 'doha', true],
  ['عبد الله بن زيد آل محمود النموذجية للبنين', 'boys', 'primary', 'rayyan'],
  ['عبدالله بن علي المسند الاعدادية للبنين', 'boys', 'prep', 'khor'],
  ['عبدالله بن علي المسند الثانوية للبنين', 'boys', 'secondary', 'khor'],
  ['عثمان بن عفان النموذجية', 'boys', 'complex', 'doha', true],
  ['علي بن أبي طالب الإعدادية', 'boys', 'prep', 'doha', true],
  ['علي بن جاسم بن محمد آل ثاني الثانوية', 'boys', 'secondary', 'doha', true],
  ['علي بن عبد الله النموذجية', 'boys', 'complex', 'doha', true],
  ['عمر بن الخطاب الابتدائية الأولى', 'boys', 'primary', 'doha', true],
  ['عمر بن الخطاب الابتدائية الثانوية', 'boys', 'complex', 'doha', true],
  ['عمر بن الخطاب الإعدادية', 'boys', 'prep', 'doha', true],
  ['عمر بن عبد العزيز الثانوية للبنين', 'boys', 'secondary', 'doha'],
  ['عمرو بن العاص الثانوية للبنين', 'boys', 'secondary', 'wakrah'],
  ['قطر التقنية الثانوية', 'boys', 'secondary', 'doha', true],
  ['قطر للعلوم والتكنولوجيا الثانوية', 'boys', 'secondary', 'doha', true],
  ['كمال ناجي النموذجية', 'boys', 'complex', 'doha', true],
  ['مالك بن أنس النموذجية', 'boys', 'complex', 'doha', true],
  ['محمد بن جاسم بن محمد آل ثاني الإعدادية', 'boys', 'prep', 'doha', true],
  ['مصعب بن عمير الثانوية', 'boys', 'secondary', 'doha', true],
  ['معاذ بن جبل الابتدائية للبنين', 'boys', 'primary', 'doha', true],
  ['ناصر بن عبد الله العطية الثانوية', 'boys', 'secondary', 'doha', true],
  ['التمكن الشاملة', 'mixed', 'complex', 'doha', true],
  ['مدرسة الهداية للاحتياجات الخاصة', 'mixed', 'complex', 'doha'],
  ['روضة الإسراء للبنات', 'girls', 'kindergarten', 'doha'],
  ['روضة الخوارزمي', 'girls', 'kindergarten', 'ummslal'],
  ['روضة الشفاء بنت عبد الرحمن الأنصارية للبنات', 'girls', 'kindergarten', 'doha', true],
  ['روضة الهدى للبنات', 'girls', 'kindergarten', 'rayyan'],
  ['روضة الوكرة الابتدئية للبنات', 'girls', 'kindergarten', 'wakrah'],
  ['روضة أمامة للبنات', 'girls', 'kindergarten', 'doha', true],
  ['روضة زكريت', 'girls', 'kindergarten', 'daayen'],
  ['روضة فاطمة بنت الخطاب', 'girls', 'kindergarten', 'doha', true],
  ['روضة عبدالله بن زيد آلمحمود للبنين', 'boys', 'kindergarten', 'doha', true],
];

export const QATAR_SCHOOLS: QatarSchool[] = (() => {
  const out: QatarSchool[] = [];
  const seen = new Set<string>();

  const key = (name: string) => normalizeArabic(name);

  // 1) الحقيقية أوّلًا (إحداثيات فعلية).
  REAL_SCHOOLS.forEach(([name, gender, stage, lat, lng], i) => {
    const k = key(name);
    if (seen.has(k)) return;
    seen.add(k);
    const municipalityId = nearestMunicipality(lat, lng);
    out.push({
      id: `real-${i}-${hashString(name).toString(36)}`,
      name,
      municipalityId,
      gender,
      stage,
      lat,
      lng,
      real: true,
    });
  });

  // 2) المنسّقة (إحداثيات من مركز البلدية + إزاحة).
  for (const m of MUNICIPALITIES) {
    const seeds = SCHOOL_SEED[m.id] ?? [];
    seeds.forEach(([name, gender, stage], i) => {
      const k = key(name);
      if (seen.has(k)) return;
      seen.add(k);
      const id = slug(name, m.id, i);
      const [ja, jb] = jitter(id);
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

  // 3) الرسمية المستوردة (إحداثيات من مركز البلدية + إزاحة).
  OFFICIAL_SCHOOLS.forEach(([name, gender, stage, mun, approx], i) => {
    const k = key(name);
    if (seen.has(k)) return;
    seen.add(k);
    const base = MUNICIPALITY_BY_ID[mun];
    const id = `off-${i}-${hashString(name).toString(36)}`;
    const [ja, jb] = jitter(id);
    out.push({
      id,
      name,
      municipalityId: mun,
      gender,
      stage,
      lat: +(base.lat + jb * base.spread * 0.8).toFixed(4),
      lng: +(base.lng + ja * base.spread).toFixed(4),
      ...(approx ? { approx: true } : {}),
    });
  });

  return out;
})();

export const SCHOOL_BY_ID: Record<string, QatarSchool> = Object.fromEntries(
  QATAR_SCHOOLS.map((s) => [s.id, s])
);

export const STAGE_LABEL: Record<SchoolStage, string> = {
  kindergarten: 'روضة أطفال',
  primary: 'ابتدائية',
  prep: 'إعدادية',
  secondary: 'ثانوية',
  complex: 'مجمّع/مستقلة',
};

export const GENDER_LABEL: Record<SchoolGender, string> = {
  boys: 'بنين',
  girls: 'بنات',
  mixed: 'مختلطة',
};

/**
 * تطبيع نص عربي للبحث والمطابقة — يفوّض للدالة المشتركة `normalizeAr` في
 * lib/utils حتى يتّسق التطبيع (والفهرسة/إزالة التكرار) مع بقيّة الموقع
 * (بحث الأنشطة يستخدمها كذلك)، فلا تتباعد المطابقة بين شاشتين.
 */
export function normalizeArabic(s: string): string {
  return normalizeAr(s);
}

/** بحث في المدارس بالاسم أو اسم البلدية (يتحمّل اختلاف التشكيل والهمزات). */
export function searchSchools(query: string, limit = 60): QatarSchool[] {
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
