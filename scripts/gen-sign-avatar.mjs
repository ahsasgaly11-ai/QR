// ---------------------------------------------------------------------------
// يولّد شخصية «مرشد لغة الإشارة» من مكتبة DiceBear مفتوحة المصدر،
// بأسلوب Open Peeps (رسوم Pablo Stanley — رخصة CC0 / ملكية عامة).
// النتيجة تُحفَظ كـ SVG ثابت في src/components/sign-avatar-art.ts، فلا تُشحَن
// أي مكتبة للمتصفّح (DiceBear أداة تطوير فقط). لإعادة التوليد: node هذا الملف.
// ---------------------------------------------------------------------------

import { createAvatar } from '@dicebear/core';
import { openPeeps } from '@dicebear/collection';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src', 'components', 'sign-avatar-art.ts');

// شخصية ودودة محايدة بهوية المنصّة (زيّ عنّابي)، بلا إكسسوارات مشتّتة.
const svg = createAvatar(openPeeps, {
  seed: 'maha',
  backgroundColor: ['transparent'],
  clothingColor: ['8a1538'],
  skinColor: ['e9b892'],
  face: ['calm'],
  accessoriesProbability: 0,
  maskProbability: 0,
  facialHairProbability: 0,
})
  .toString()
  .replace(/\s+xmlns:xlink="[^"]*"/, '')
  .trim();

const banner =
  '// مولَّد آليًّا بواسطة scripts/gen-sign-avatar.mjs — لا تحرّره يدويًّا.\n' +
  '// شخصية Open Peeps (Pablo Stanley) — رخصة CC0 / ملكية عامة، عبر DiceBear (MIT).\n';

writeFileSync(
  OUT,
  `${banner}export const SIGN_AVATAR_SVG = ${JSON.stringify(svg)};\n`,
  'utf8'
);

console.log('✅ تم توليد شخصية المرشد →', OUT.replace(ROOT + '/', ''));
console.log('   طول الـ SVG:', svg.length, 'حرفًا');
