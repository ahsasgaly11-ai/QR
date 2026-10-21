// ---------------------------------------------------------------------------
// يبني ملفات «المعرفة» لمشروع Claude الخاص بألعاب السبورة الذكية من الكود الحقيقي:
//   node scripts/build-claude-project.mjs   (أو: npm run claude:project)
// الناتج في docs/claude-project-board-games/knowledge/ — أعد تشغيله كلما تغيّر
// board-kit أو القالب أو لعبة المثال، ثم ارفع الملفات المحدّثة إلى المشروع.
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs/claude-project-board-games/knowledge');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const LANG = { '.js': 'js', '.mjs': 'js', '.ts': 'ts', '.css': 'css', '.html': 'html', '.json': 'json', '.md': 'md' };

/** ملف معرفة: مقدّمة ثم كل ملف مصدري في كتلة كود معنونة بمساره. */
function bundle(name, intro, files) {
  const parts = [intro.trim(), '', NOTE, ''];
  for (const f of files) {
    const fence = f.endsWith('.md') ? '````' : '```';
    parts.push(`## \`${f}\``, '', `${fence}${LANG[path.extname(f)] || ''}`, read(f).trimEnd(), fence, '');
  }
  fs.writeFileSync(path.join(OUT, name), parts.join('\n'));
  return name;
}

fs.mkdirSync(OUT, { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);
/** تنبيه في أول كل ملف مولَّد: مستوى الرسوميات يحدّده الملف 10 */
const NOTE = `> **مستوى الرسوميات لكل لعبة يحدّده الملف 10** (تقنية «دانة الصف» و«مختبر العدسة المكبّرة»): three.js الكلاسيكي (\`three.module.min.js\` مع \`three/addons/\`)، وإضاءة بيئية PMREM، ومواد فيزيائية، وعالم بالمظلِّلات، و\`EffectComposer\` للتوهّج والتدرّج اللوني. أي عبارة هنا تقدّم WebGPU على أنه المسار الأساسي، أو تمنع \`ShaderMaterial\` و\`EffectComposer\`، يحلّ محلّها الملف 10. مثال مطبَّق: \`public/germ-hunters/\`.`;
const made = [];

made.push(
  bundle(
    '03-engine-api.md',
    `# واجهة محرّك board-kit (مولَّد ${stamp} من public/board-kit/README_AR.md)
هذا هو المرجع الملزم لعقد اللعبة ومكوّنات التصميم. لا تخالفه ولا تعِد كتابة ما يقدّمه المحرّك.`,
    ['public/board-kit/README_AR.md']
  )
);

made.push(
  bundle(
    '04-engine-source.md',
    `# مصدر محرّك board-kit كاملًا (مولَّد ${stamp})
للاطلاع فقط: الألعاب **تستورد** هذه الوحدات من \`/board-kit/js/…\` ولا تنسخها ولا تعدّلها.
إن احتاجت لعبة سلوكًا عامًّا جديدًا فاقترح تعديل المحرّك صراحة (مع اختباراته) بدل الالتفاف عليه في اللعبة.`,
    [
      'public/board-kit/js/app.js',
      'public/board-kit/js/input.js',
      'public/board-kit/js/audio.js',
      'public/board-kit/js/settings.js',
      'public/board-kit/js/tracker.js',
      'public/board-kit/js/tracking.js',
      'public/board-kit/js/calibrate.js',
      'public/board-kit/js/geometry.js',
      'public/board-kit/css/kit.css',
    ]
  )
);

made.push(
  bundle(
    '05-template-source.md',
    `# قالب البداية «صنّف» (مولَّد ${stamp} من public/board-kit/template/)
نقطة البداية لكل لعبة جديدة: انسخ هذه الملفات إلى \`public/<slug>/\` وعدّلها. يطبّق العقد كاملًا:
القائمة، اللعب، السباق بأدوات لكل فريق، الخطأ يبقي العنصر في اليد، التلميح بعد خطأين، النتيجة.
لصنع لعبة تصنيف لدرس آخر يكفي غالبًا تعديل \`content.js\` وحده.`,
    [
      'public/board-kit/template/index.html',
      'public/board-kit/template/js/main.js',
      'public/board-kit/template/js/content.js',
      'public/board-kit/template/js/game.js',
      'public/board-kit/template/css/game.css',
    ]
  )
);

made.push(
  bundle(
    '06-example-asnan.md',
    `# مثال لعبة كاملة: «ركّب الأسنان» (مولَّد ${stamp} من public/asnan/)
لعبة أغنى من القالب: رسم SVG مخصّص (فكّان بقوسين وخانات على امتدادهما)، وضعان (ركّب/تعرّف)،
سباق فريقين لكل فريق فكّه وبطاقاته، معلومة عن كل نوع، نطق الاسم، خريطة ألوان في النتيجة.
استرشد بها حين تحتاج اللعبة رسمًا علميًا تُوضع عليه العناصر (مخطط، خريطة، جسم، دائرة كهربائية…).`,
    ['public/asnan/index.html', 'public/asnan/js/main.js', 'public/asnan/js/teeth.js', 'public/asnan/js/game.js', 'public/asnan/css/app.css']
  )
);

made.push(
  bundle(
    '07-site-integration.md',
    `# دمج لعبة جديدة في الموقع (مولَّد ${stamp})
خطوات إضافة لعبة إلى قسم «ألعاب السبورة الذكية» \`/board-games\` في منصة مناهج قطر (Next.js):

1. **مجلد اللعبة:** \`public/<slug>/\` (\`index.html\`، \`js/main.js\`، \`js/game.js\`، \`js/content.js\`، \`css/game.css\`،
   و\`cover.jpg\` لقطة 1280×800 من اللعبة أثناء اللعب).
2. **التحويل:** في \`next.config.ts\` داخل \`redirects()\` أضف:
   \`{ source: '/<slug>', destination: '/<slug>/index.html', permanent: false }\` والسطر نفسه مع \`'/<slug>/'\`.
3. **الفهرس:** أضف كائن اللعبة إلى \`BOARD_GAMES\` في \`src/data/board-games.ts\` (الحقول موثّقة في الملف أدناه).
4. **التجربة:** \`/<slug>/index.html?sim\` (الماوس يتصرف كيد)، ثم شاشة هاتف أفقية، ثم الجهاز الحقيقي في الصف.
5. **لا تكرّر** \`vendor/\` ولا \`models/\` ولا ملفات المحرّك داخل مجلد اللعبة: كلها في \`/board-kit/\`.

الملفات الحالية للمرجع:`,
    ['src/data/board-games.ts']
  )
);

console.log(`كُتبت ${made.length} ملفات في ${path.relative(ROOT, OUT)}:`);
for (const m of made) console.log(`  ${m}  (${(fs.statSync(path.join(OUT, m)).size / 1024).toFixed(0)} ك.ب)`);
