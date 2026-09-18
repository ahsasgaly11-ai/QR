#!/usr/bin/env node
// أداة سطر أوامر لجلب مجسمات ثلاثية الأبعاد من Tripo Studio (tripo3d.ai)
// تُنشئ مهمة توليد، تنتظر انتهاءها، ثم تُنزّل ملف GLB إلى مجلد محلي.
// التوثيق: docs/tripo-3d-models.md

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PRESETS_FILE = join(ROOT, "scripts", "tripo-presets.json");

// نقاط النهاية. الإصدار v3 هو الافتراضي، و v2 يبقى للتوافق حتى إيقافه من Tripo.
const API = {
  v3: process.env.TRIPO_API_BASE_V3 || "https://openapi.tripo3d.ai/v3",
  v2: process.env.TRIPO_API_BASE_V2 || "https://api.tripo3d.ai/v2/openapi",
};

// امتدادات الملفات حسب صيغة التصدير المطلوبة من Tripo.
const FORMAT_EXT = {
  GLTF: ".glb",
  GLB: ".glb",
  FBX: ".fbx",
  OBJ: ".zip",
  USDZ: ".usdz",
  STL: ".stl",
  "3MF": ".3mf",
};

const HELP = `
جلب مجسمات 3D من Tripo Studio

  npm run tripo -- --preset arm-muscles
  npm run tripo -- --prompt "human heart anatomy model" --name heart
  npm run tripo -- --all --face-limit 30000
  node scripts/tripo-fetch.mjs --list-presets

الخيارات:
  --preset <key>       استخدام وصف جاهز من scripts/tripo-presets.json (يمكن تكراره)
  --prompt <text>      وصف نصي حر (يمكن تكراره)
  --all                توليد كل الأوصاف الجاهزة
  --list-presets       عرض الأوصاف الجاهزة ثم الخروج
  --name <slug>        اسم ملف المخرجات (يصلح مع --prompt واحد فقط)
  --out <dir>          مجلد الحفظ (الافتراضي: models)
  --api <v3|v2>        إصدار واجهة Tripo (الافتراضي: v3)
  --model <version>    إصدار نموذج التوليد (الافتراضي في v3: v3.1-20260211)
  --format <FMT>       تحويل الناتج إلى GLTF|FBX|OBJ|USDZ|STL|3MF (v3 فقط)
  --face-limit <n>     حد أقصى لعدد المضلعات (مفيد لخفة العرض في المتصفح)
  --no-texture         توليد بلا خامات
  --no-pbr             تعطيل خامات PBR
  --quad               إخراج شبكة رباعية الأضلاع بدل المثلثات
  --seed <n>           بذرة ثابتة لإعادة إنتاج نفس النتيجة
  --poll-interval <s>  ثواني بين كل استعلام عن حالة المهمة (الافتراضي: 2)
  --timeout <s>        أقصى انتظار لإنجاز المهمة (الافتراضي: 600)
  --force              إعادة التوليد حتى لو كان الملف موجوداً
  --dry-run            عرض ما سيُرسل دون استدعاء الواجهة
  --help               عرض هذه المساعدة

مفتاح الواجهة يُقرأ من متغير البيئة TRIPO_API_KEY أو من ملف .env
`.trim();

// ---------- أدوات مساعدة ----------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

function fail(msg) {
  process.stderr.write(`خطأ: ${msg}\n`);
  process.exit(1);
}

function slugify(text) {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9ء-ي]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "model"
  );
}

// قارئ .env بسيط حتى لا يعتمد السكربت على تثبيت الحزم.
async function loadDotEnv() {
  const file = join(ROOT, ".env");
  if (!existsSync(file)) return;
  const text = await readFile(file, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/i.exec(line);
    if (!match) continue;
    const key = match[1];
    if (process.env[key] !== undefined) continue;
    let value = match[2].trim();
    if (/^(['"]).*\1$/s.test(value)) value = value.slice(1, -1);
    process.env[key] = value;
  }
}

// إعادة المحاولة مع تراجع أسّي على أخطاء الشبكة و 429 و 5xx.
async function requestWithRetry(url, options = {}, { retries = 4, label = "الطلب" } = {}) {
  let delay = 2000;
  for (let attempt = 0; ; attempt++) {
    let response;
    try {
      response = await fetch(url, options);
    } catch (error) {
      if (attempt >= retries) throw new Error(`${label}: فشل الاتصال (${error.message})`);
      log(`  تعذّر الاتصال، إعادة المحاولة بعد ${delay / 1000}ث...`);
      await sleep(delay);
      delay *= 2;
      continue;
    }
    if ((response.status === 429 || response.status >= 500) && attempt < retries) {
      log(`  استجابة ${response.status}، إعادة المحاولة بعد ${delay / 1000}ث...`);
      await sleep(delay);
      delay *= 2;
      continue;
    }
    return response;
  }
}

async function apiJson(url, options, label) {
  const response = await requestWithRetry(url, options, { label });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`${label}: استجابة غير متوقعة (${response.status}) ${text.slice(0, 200)}`);
  }
  if (!response.ok || (body.code !== undefined && body.code !== 0)) {
    const detail = body.message || body.suggestion || text.slice(0, 200);
    throw new Error(`${label}: ${response.status} ${detail}`);
  }
  return body.data ?? body;
}

// ---------- استدعاءات Tripo ----------

function authHeaders(apiKey) {
  return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
}

function buildBody(job, opts) {
  // الخيار الصريح من سطر الأوامر يتقدّم على قيمة الوصف الجاهز.
  const faceLimit = opts.faceLimit ?? job.faceLimit;
  if (opts.api === "v2") {
    return {
      type: "text_to_model",
      prompt: job.prompt,
      ...(opts.model ? { model_version: opts.model } : {}),
      texture: opts.texture,
      pbr: opts.pbr,
      ...(opts.quad ? { quad: true } : {}),
      ...(faceLimit ? { face_limit: faceLimit } : {}),
      ...(opts.seed !== undefined ? { model_seed: opts.seed } : {}),
    };
  }
  return {
    prompt: job.prompt,
    model: opts.model,
    texture: opts.texture,
    pbr: opts.pbr,
    ...(opts.quad ? { quad: true } : {}),
    ...(faceLimit ? { face_limit: faceLimit } : {}),
    ...(opts.seed !== undefined ? { model_seed: opts.seed } : {}),
  };
}

async function createTask(job, opts) {
  const base = API[opts.api];
  const url = opts.api === "v2" ? `${base}/task` : `${base}/generation/text-to-model`;
  const data = await apiJson(
    url,
    { method: "POST", headers: authHeaders(opts.apiKey), body: JSON.stringify(buildBody(job, opts)) },
    "إنشاء المهمة",
  );
  const taskId = data.task_id || data.id;
  if (!taskId) throw new Error("إنشاء المهمة: لم تُعِد الواجهة معرّف مهمة");
  return taskId;
}

async function createConvertTask(taskId, opts) {
  const data = await apiJson(
    `${API.v3}/models/convert`,
    {
      method: "POST",
      headers: authHeaders(opts.apiKey),
      body: JSON.stringify({ input: taskId, format: opts.format }),
    },
    "تحويل الصيغة",
  );
  const convertId = data.task_id || data.id;
  if (!convertId) throw new Error("تحويل الصيغة: لم تُعِد الواجهة معرّف مهمة");
  return convertId;
}

function extractModelUrl(output = {}) {
  return (
    output.model_url ||
    output.pbr_model_url ||
    output.pbr_model ||
    output.model ||
    output.base_model_url ||
    output.base_model ||
    null
  );
}

// الاستعلام عن حالة المهمة حتى النجاح أو الفشل أو انتهاء المهلة.
async function waitForTask(taskId, opts) {
  const base = API[opts.api];
  const url = opts.api === "v2" ? `${base}/task/${taskId}` : `${base}/tasks/${taskId}`;
  const deadline = Date.now() + opts.timeout * 1000;
  let lastProgress = -1;

  while (Date.now() < deadline) {
    const data = await apiJson(url, { headers: authHeaders(opts.apiKey) }, "حالة المهمة");
    const status = String(data.status || "").toLowerCase();
    const progress = Number(data.progress ?? 0);

    if (progress !== lastProgress) {
      log(`  الحالة: ${status || "غير معروفة"} (${progress}%)`);
      lastProgress = progress;
    }

    if (status === "success" || status === "succeeded") {
      const modelUrl = extractModelUrl(data.output);
      if (!modelUrl) throw new Error("انتهت المهمة دون رابط مجسم");
      return modelUrl;
    }
    if (["failed", "cancelled", "banned", "expired", "unknown"].includes(status)) {
      throw new Error(`المهمة انتهت بالحالة "${status}"`);
    }

    await sleep(opts.pollInterval * 1000);
  }
  throw new Error(`انتهت المهلة (${opts.timeout}ث) قبل اكتمال المهمة ${taskId}`);
}

// روابط Tripo تنتهي صلاحيتها خلال دقائق، لذا يُنزَّل الملف فور نجاح المهمة.
async function downloadModel(url, destination) {
  const response = await requestWithRetry(url, {}, { label: "تنزيل المجسم" });
  if (!response.ok) throw new Error(`تنزيل المجسم: ${response.status} ${response.statusText}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0) throw new Error("تنزيل المجسم: الملف فارغ");
  if (destination.endsWith(".glb") && buffer.subarray(0, 4).toString("ascii") !== "glTF") {
    throw new Error("تنزيل المجسم: المحتوى ليس ملف GLB صالحاً");
  }
  const temp = `${destination}.part`;
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(temp, buffer);
  await rename(temp, destination);
  return { bytes: buffer.length, sha256: createHash("sha256").update(buffer).digest("hex") };
}

// ---------- سجل المجسمات ----------

async function readManifest(file) {
  if (!existsSync(file)) return { generated_by: "scripts/tripo-fetch.mjs", items: [] };
  try {
    const parsed = JSON.parse(await readFile(file, "utf8"));
    return { generated_by: "scripts/tripo-fetch.mjs", items: parsed.items ?? [], ...parsed };
  } catch {
    return { generated_by: "scripts/tripo-fetch.mjs", items: [] };
  }
}

async function saveManifest(file, manifest) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(manifest, null, 2)}\n`);
}

// ---------- البرنامج الرئيسي ----------

function parseOptions(argv) {
  const { values } = parseArgs({
    args: argv,
    allowPositionals: false,
    options: {
      preset: { type: "string", multiple: true, default: [] },
      prompt: { type: "string", multiple: true, default: [] },
      all: { type: "boolean", default: false },
      "list-presets": { type: "boolean", default: false },
      name: { type: "string" },
      out: { type: "string", default: "models" },
      api: { type: "string", default: "v3" },
      model: { type: "string" },
      format: { type: "string" },
      "face-limit": { type: "string" },
      texture: { type: "boolean", default: true },
      "no-texture": { type: "boolean", default: false },
      pbr: { type: "boolean", default: true },
      "no-pbr": { type: "boolean", default: false },
      quad: { type: "boolean", default: false },
      seed: { type: "string" },
      "poll-interval": { type: "string", default: "2" },
      timeout: { type: "string", default: "600" },
      force: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  });

  const number = (value, label) => {
    if (value === undefined) return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) fail(`قيمة غير صالحة للخيار ${label}: ${value}`);
    return parsed;
  };

  return {
    presets: values.preset,
    prompts: values.prompt,
    all: values.all,
    listPresets: values["list-presets"],
    name: values.name,
    out: values.out,
    api: values.api,
    model: values.model,
    format: values.format ? values.format.toUpperCase() : undefined,
    faceLimit: number(values["face-limit"], "--face-limit"),
    texture: values.texture && !values["no-texture"],
    pbr: values.pbr && !values["no-pbr"],
    quad: values.quad,
    seed: number(values.seed, "--seed"),
    pollInterval: number(values["poll-interval"], "--poll-interval"),
    timeout: number(values.timeout, "--timeout"),
    force: values.force,
    dryRun: values["dry-run"],
    help: values.help,
  };
}

async function main() {
  const opts = parseOptions(process.argv.slice(2));
  if (opts.help) return log(HELP);

  const { presets } = JSON.parse(await readFile(PRESETS_FILE, "utf8"));

  if (opts.listPresets) {
    log("الأوصاف الجاهزة:\n");
    for (const [key, preset] of Object.entries(presets)) {
      log(`  ${key.padEnd(18)} ${preset.label}`);
    }
    return;
  }

  if (!["v2", "v3"].includes(opts.api)) fail(`إصدار واجهة غير مدعوم: ${opts.api} (المتاح v3 أو v2)`);
  if (opts.format && opts.api !== "v3") fail("تحويل الصيغة عبر --format متاح في الإصدار v3 فقط");
  if (opts.format && !FORMAT_EXT[opts.format]) {
    fail(`صيغة غير مدعومة: ${opts.format} (المتاح ${Object.keys(FORMAT_EXT).join("، ")})`);
  }
  if (!opts.model && opts.api === "v3") opts.model = "v3.1-20260211";

  // بناء قائمة المهام من الأوصاف الجاهزة و/أو الأوصاف الحرة.
  const jobs = [];
  const selectedPresets = opts.all ? Object.keys(presets) : opts.presets;
  for (const key of selectedPresets) {
    const preset = presets[key];
    if (!preset) fail(`وصف جاهز غير موجود: ${key} (جرّب --list-presets)`);
    jobs.push({ name: key, label: preset.label, prompt: preset.prompt, faceLimit: preset.face_limit, preset: key });
  }
  for (const [index, prompt] of opts.prompts.entries()) {
    const name = opts.prompts.length === 1 && opts.name ? slugify(opts.name) : slugify(prompt);
    jobs.push({ name, label: prompt, prompt, preset: null, index });
  }

  if (jobs.length === 0) {
    log(HELP);
    fail("لم تحدد أي مجسم. استخدم --preset أو --prompt أو --all");
  }
  if (opts.name && opts.prompts.length > 1) {
    fail("--name يصلح مع وصف واحد فقط");
  }

  const outDir = resolve(ROOT, opts.out);
  const manifestFile = join(outDir, "manifest.json");
  const extension = opts.format ? FORMAT_EXT[opts.format] : ".glb";

  if (opts.dryRun) {
    log(`عرض تجريبي (${jobs.length} مجسم) — لن يُستدعى Tripo:\n`);
    for (const job of jobs) {
      log(`  ${job.name}${extension}`);
      log(`    ${JSON.stringify(buildBody(job, { ...opts, apiKey: "" }))}`);
    }
    return;
  }

  const apiKey = process.env.TRIPO_API_KEY;
  if (!apiKey) {
    fail("متغير البيئة TRIPO_API_KEY غير مضبوط. أنشئ مفتاحاً من platform.tripo3d.ai ثم ضعه في ملف .env");
  }
  opts.apiKey = apiKey;

  const manifest = await readManifest(manifestFile);
  let succeeded = 0;
  const failures = [];

  for (const [index, job] of jobs.entries()) {
    const destination = join(outDir, `${job.name}${extension}`);
    log(`\n[${index + 1}/${jobs.length}] ${job.label}`);

    if (existsSync(destination) && !opts.force) {
      log(`  موجود مسبقاً: ${destination} (استخدم --force لإعادة التوليد)`);
      succeeded++;
      continue;
    }

    try {
      let taskId = await createTask(job, opts);
      log(`  المهمة: ${taskId}`);
      let modelUrl = await waitForTask(taskId, opts);

      if (opts.format) {
        const convertId = await createConvertTask(taskId, opts);
        log(`  مهمة التحويل إلى ${opts.format}: ${convertId}`);
        taskId = convertId;
        modelUrl = await waitForTask(convertId, opts);
      }

      const { bytes, sha256 } = await downloadModel(modelUrl, destination);
      log(`  حُفظ: ${destination} (${(bytes / 1024 / 1024).toFixed(2)} ميجابايت)`);

      manifest.items = manifest.items.filter((item) => item.file !== `${job.name}${extension}`);
      manifest.items.push({
        name: job.name,
        label: job.label,
        file: `${job.name}${extension}`,
        preset: job.preset,
        prompt: job.prompt,
        task_id: taskId,
        api: opts.api,
        model: opts.model ?? null,
        format: opts.format ?? "GLB",
        bytes,
        sha256,
        created_at: new Date().toISOString(),
      });
      await saveManifest(manifestFile, manifest);
      succeeded++;
    } catch (error) {
      process.stderr.write(`  فشل: ${error.message}\n`);
      failures.push({ name: job.name, message: error.message });
      await rm(`${destination}.part`, { force: true });
    }
  }

  log(`\nالنتيجة: ${succeeded} نجحت، ${failures.length} فشلت.`);
  if (failures.length > 0) {
    for (const failure of failures) process.stderr.write(`  - ${failure.name}: ${failure.message}\n`);
    process.exit(1);
  }
  log(`سجل المجسمات: ${manifestFile}`);
}

await loadDotEnv();
main().catch((error) => fail(error.message));
