#!/usr/bin/env node
// توليد مجسمات GLB تشريحية جاهزة من ملف المعاملات models/anatomy-parts.json
// عدّل الأرقام في ذلك الملف ثم أعد التشغيل للحصول على نسخة معدّلة من المجسمات.
// التوثيق: docs/tripo-3d-models.md

import { readFile } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";

import { GlbBuilder } from "./lib/glb.mjs";
import { box, computeNormals, smoothPath, sphere, transform, tube, unweld } from "./lib/geometry.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const HELP = `
توليد المجسمات التشريحية الجاهزة

  npm run models:build                 توليد كل الأجزاء والتجميعات
  npm run models:build -- --only biceps توليد جزء واحد
  npm run models:build -- --out build   مجلد إخراج آخر

  --config <file>  ملف المعاملات (الافتراضي: models/anatomy-parts.json)
  --out <dir>      مجلد الإخراج (الافتراضي: models)
  --only <name>    توليد جزء أو تجميعة واحدة (يقبل التكرار)
  --help           عرض هذه المساعدة
`.trim();

// بناء قطعة هندسية واحدة، مع إمكانية استبدال قيمها بقيم حالة أخرى (مثل "contracted").
function buildPiece(piece, variant) {
  const spec = variant && piece[variant] ? { ...piece, ...piece[variant] } : piece;
  let geometry;

  switch (spec.type) {
    case "tube": {
      const path = spec.smooth ? smoothPath(spec.path, spec.smooth) : spec.path;
      geometry = tube({
        path,
        radii: spec.radii,
        segments: spec.segments ?? 20,
        capStart: spec.capStart ?? true,
        capEnd: spec.capEnd ?? true,
      });
      break;
    }
    case "sphere":
      geometry = sphere({
        center: spec.center,
        radius: spec.radius,
        segments: spec.segments ?? 24,
        rings: spec.rings ?? 16,
        scaleXYZ: spec.scale ?? [1, 1, 1],
      });
      break;
    case "box":
      geometry = box({ center: spec.center, size: spec.size });
      break;
    default:
      throw new Error(`نوع قطعة غير معروف: ${spec.type}`);
  }

  if (spec.flat || spec.type === "box") geometry = unweld(geometry);
  if (spec.transform) geometry = { ...geometry, positions: transform(geometry, spec.transform) };
  return geometry;
}

// دمج قطع الجزء الواحد في بدائيات (primitives) مجمّعة حسب الخامة.
function buildPart(part, materialIndex) {
  const groups = new Map();

  for (const piece of part.pieces) {
    const base = buildPiece(piece, null);
    const morphed = part.morph ? buildPiece(piece, part.morph) : null;

    if (morphed && morphed.positions.length !== base.positions.length) {
      throw new Error("حالة التشويه غيّرت عدد الرؤوس؛ حافظ على نفس عدد نقاط المسار و segments");
    }

    if (!groups.has(piece.material)) {
      groups.set(piece.material, { positions: [], indices: [], morphPositions: [] });
    }
    const group = groups.get(piece.material);
    const offset = group.positions.length / 3;

    group.positions.push(...base.positions);
    // القطع بلا حالة تشويه تبقى ثابتة: إزاحتها صفر.
    group.morphPositions.push(...(morphed ? morphed.positions : base.positions));
    for (const index of base.indices) group.indices.push(index + offset);
  }

  return [...groups.entries()].map(([material, group]) => {
    const normals = computeNormals(group.positions, group.indices);
    const primitive = {
      positions: group.positions,
      normals,
      indices: group.indices,
      material: materialIndex[material],
    };

    if (part.morph) {
      const morphNormals = computeNormals(group.morphPositions, group.indices);
      primitive.targets = [{
        name: part.morph,
        // أهداف التشويه في glTF تُخزَّن كفروق عن الوضع الأساسي.
        positions: group.morphPositions.map((value, i) => value - group.positions[i]),
        normals: morphNormals.map((value, i) => value - normals[i]),
      }];
    }
    return primitive;
  });
}

function registerMaterials(builder, materials) {
  const index = {};
  for (const [name, material] of Object.entries(materials)) {
    index[name] = builder.addMaterial({
      name,
      color: material.color,
      roughness: material.roughness,
      metallic: material.metallic ?? 0,
      alpha: material.alpha ?? 1,
    });
  }
  return index;
}

async function writeGlb({ config, names, file, generator }) {
  const builder = new GlbBuilder(generator);
  const materialIndex = registerMaterials(builder, config.materials);

  for (const name of names) {
    const part = config.parts[name];
    if (!part) throw new Error(`جزء غير معرّف في ملف المعاملات: ${name}`);
    const mesh = builder.addMesh({ name: part.label ?? name, primitives: buildPart(part, materialIndex) });
    builder.addNode({ name, mesh });
  }

  return builder.write(file);
}

async function main() {
  const { values } = parseArgs({
    options: {
      config: { type: "string", default: join("models", "anatomy-parts.json") },
      out: { type: "string", default: "models" },
      only: { type: "string", multiple: true, default: [] },
      help: { type: "boolean", default: false },
    },
  });

  if (values.help) {
    process.stdout.write(`${HELP}\n`);
    return;
  }

  const config = JSON.parse(await readFile(resolve(ROOT, values.config), "utf8"));
  const outDir = resolve(ROOT, values.out);
  const generator = "scripts/build-anatomy-models.mjs";

  const targets = [
    ...Object.keys(config.parts).map((name) => ({ name, names: [name] })),
    ...Object.entries(config.assemblies ?? {}).map(([name, assembly]) => ({ name, names: assembly.parts })),
  ].filter(({ name }) => values.only.length === 0 || values.only.includes(name));

  if (targets.length === 0) {
    throw new Error(`لا يوجد هدف مطابق لـ --only ${values.only.join("، ")}`);
  }

  for (const target of targets) {
    const file = join(outDir, `${target.name}.glb`);
    const bytes = await writeGlb({ config, names: target.names, file, generator });
    const label = config.parts[target.name]?.label ?? config.assemblies[target.name]?.label ?? target.name;
    process.stdout.write(`${target.name.padEnd(16)} ${String(Math.round(bytes / 1024)).padStart(4)} ك.ب  ${label}\n`);
  }

  process.stdout.write(`\nتم توليد ${targets.length} ملف في ${outDir}\n`);
}

main().catch((error) => {
  process.stderr.write(`خطأ: ${error.message}\n`);
  process.exit(1);
});
