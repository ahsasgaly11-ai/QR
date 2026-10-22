// ---------------------------------------------------------------------------
// بيئة الانعكاسات الحقيقية: بانوراما مختبر مصوّرة (Poly Haven «lab»، CC0، عبر @pmndrs/assets، EXR 512×256).
// تُقصّ أضواؤها الساطعة عند التحميل (مع الحفاظ على لونها): فتلمع المعادن والزجاج بانعكاس مختبر حقيقي،
// ولا تتجاوز لمعة على النحاس عتبة التوهّج فتغطي العدسة بهالة (هذا ما فعله RoomEnvironment).
// حتى يكتمل التحميل (أو إن فشل) يبقى «الاستوديو» المرسوم بالكود (studioEnvScene).
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';

const URL = '/germ-hunters/assets/lab.exr';
const CLIP = 1.5; // أقصى سطوع بعد القصّ (قيمة خطية)
const GAIN = 1.25; // رفع عام بسيط: البانوراما داخلية خافتة

let pending = null;

/** يحمّل البانوراما مرة واحدة (تُشارك بين المشهد والبطاقات) */
export function loadLab() {
  pending ||= new Promise((resolve, reject) => {
    new EXRLoader().setDataType(THREE.FloatType).load(
      URL,
      (tex) => {
        const d = tex.image.data;
        const ch = d.length / (tex.image.width * tex.image.height);
        for (let i = 0; i < d.length; i += ch) {
          const r = d[i] * GAIN;
          const g = d[i + 1] * GAIN;
          const b = d[i + 2] * GAIN;
          const m = Math.max(r, g, b);
          // قصّ ناعم: ما فوق CLIP يقترب منه تدريجيًا (لا حافة حادة)
          const k = m > CLIP * 0.7 ? (CLIP * 0.7 + (CLIP * 0.3) * (1 - Math.exp(-(m - CLIP * 0.7) / (CLIP * 0.3)))) / m : 1;
          d[i] = r * k;
          d[i + 1] = g * k;
          d[i + 2] = b * k;
        }
        tex.mapping = THREE.EquirectangularReflectionMapping;
        tex.needsUpdate = true;
        resolve(tex);
      },
      undefined,
      reject,
    );
  });
  return pending;
}

/** خريطة بيئة جاهزة لمحرّك معيّن (PMREM)، أو null إن تعذّر التحميل */
export async function labEnvironment(renderer) {
  try {
    const tex = await loadLab();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const rt = pmrem.fromEquirectangular(tex);
    pmrem.dispose();
    return rt;
  } catch (e) {
    console.warn('تعذّر تحميل بانوراما المختبر، يبقى الاستوديو', e);
    return null;
  }
}
