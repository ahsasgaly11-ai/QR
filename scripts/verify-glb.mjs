#!/usr/bin/env node
// فحص سلامة ملفات GLB المولّدة: الترويسة، المقاطع، المراجع، حدود الفهارس، والاتجاهات.
// الاستخدام: node scripts/verify-glb.mjs models/*.glb

import { readFile } from "node:fs/promises";
import { basename } from "node:path";

const COMPONENT_SIZE = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const TYPE_COUNT = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function parseGlb(buffer, problems) {
  if (buffer.subarray(0, 4).toString("ascii") !== "glTF") problems.push("الترويسة ليست glTF");
  if (buffer.readUInt32LE(4) !== 2) problems.push("إصدار glTF ليس 2");
  if (buffer.readUInt32LE(8) !== buffer.length) problems.push("الطول المعلن لا يطابق حجم الملف");

  let offset = 12;
  let json = null;
  let bin = null;
  while (offset < buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    if (chunkLength % 4 !== 0) problems.push(`مقطع ${chunkType.trim()} غير محاذى على 4 بايت`);
    const data = buffer.subarray(offset + 8, offset + 8 + chunkLength);
    if (chunkType === "JSON") json = JSON.parse(data.toString("utf8"));
    if (chunkType.startsWith("BIN")) bin = data;
    offset += 8 + chunkLength;
  }
  if (!json) problems.push("لا يوجد مقطع JSON");
  if (!bin) problems.push("لا يوجد مقطع BIN");
  return { json, bin };
}

function readAccessor(gltf, bin, index) {
  const accessor = gltf.accessors[index];
  const view = gltf.bufferViews[accessor.bufferView];
  const components = TYPE_COUNT[accessor.type];
  const start = view.byteOffset ?? 0;
  const values = [];
  for (let i = 0; i < accessor.count * components; i++) {
    const at = start + i * COMPONENT_SIZE[accessor.componentType];
    values.push(
      accessor.componentType === 5126 ? bin.readFloatLE(at)
        : accessor.componentType === 5125 ? bin.readUInt32LE(at)
          : bin.readUInt16LE(at),
    );
  }
  return { accessor, values, components };
}

function verify(name, buffer) {
  const problems = [];
  const { json: gltf, bin } = parseGlb(buffer, problems);
  if (problems.length > 0 || !gltf || !bin) return problems;

  const declared = gltf.buffers[0].byteLength;
  if (declared > bin.length || bin.length - declared > 3) {
    problems.push(`طول المخزن المعلن (${declared}) لا يطابق مقطع BIN (${bin.length})`);
  }

  for (const [index, view] of gltf.bufferViews.entries()) {
    if ((view.byteOffset ?? 0) + view.byteLength > bin.length) problems.push(`bufferView ${index} يتجاوز حدود المخزن`);
    if ((view.byteOffset ?? 0) % 4 !== 0) problems.push(`bufferView ${index} غير محاذى على 4 بايت`);
  }

  for (const [index, accessor] of gltf.accessors.entries()) {
    const view = gltf.bufferViews[accessor.bufferView];
    const needed = accessor.count * TYPE_COUNT[accessor.type] * COMPONENT_SIZE[accessor.componentType];
    if (needed !== view.byteLength) problems.push(`accessor ${index} حجمه ${needed} بينما bufferView ${view.byteLength}`);
  }

  let morphTargets = 0;
  for (const mesh of gltf.meshes) {
    const counts = new Set(mesh.primitives.map((primitive) => primitive.targets?.length ?? 0));
    if (counts.size > 1) problems.push(`الشبكة "${mesh.name}" لبدائياتها أعداد مختلفة من أهداف التشويه`);
    const targetCount = mesh.primitives[0].targets?.length ?? 0;
    morphTargets += targetCount;
    if (targetCount > 0 && (mesh.weights?.length ?? 0) !== targetCount) {
      problems.push(`الشبكة "${mesh.name}" أوزان التشويه لا تطابق عدد الأهداف`);
    }

    for (const primitive of mesh.primitives) {
      if (gltf.materials[primitive.material] === undefined) problems.push(`خامة غير موجودة في "${mesh.name}"`);

      const position = readAccessor(gltf, bin, primitive.attributes.POSITION);
      const { values: indices } = readAccessor(gltf, bin, primitive.indices);
      const vertexCount = position.accessor.count;

      const outOfRange = indices.find((value) => value >= vertexCount);
      if (outOfRange !== undefined) problems.push(`فهرس ${outOfRange} خارج عدد الرؤوس (${vertexCount}) في "${mesh.name}"`);
      if (indices.length % 3 !== 0) problems.push(`عدد الفهارس ليس من مضاعفات 3 في "${mesh.name}"`);

      // التحقق من صحة min/max المعلنة لمواضع الرؤوس.
      for (let axis = 0; axis < 3; axis++) {
        let min = Infinity;
        let max = -Infinity;
        for (let i = axis; i < position.values.length; i += 3) {
          min = Math.min(min, position.values[i]);
          max = Math.max(max, position.values[i]);
        }
        if (Math.abs(min - position.accessor.min[axis]) > 1e-5 || Math.abs(max - position.accessor.max[axis]) > 1e-5) {
          problems.push(`min/max خاطئة على المحور ${axis} في "${mesh.name}"`);
        }
      }

      const { values: normals } = readAccessor(gltf, bin, primitive.attributes.NORMAL);
      for (let i = 0; i < normals.length; i += 3) {
        const len = Math.hypot(normals[i], normals[i + 1], normals[i + 2]);
        if (Math.abs(len - 1) > 1e-3) {
          problems.push(`اتجاه غير موحّد الطول (${len.toFixed(4)}) في "${mesh.name}"`);
          break;
        }
      }
    }
  }

  process.stdout.write(
    `${basename(name).padEnd(20)} ${String(gltf.meshes.length).padStart(2)} شبكة  ` +
    `${String(gltf.materials.length).padStart(2)} خامة  ${String(morphTargets).padStart(2)} هدف تشويه  ` +
    `${problems.length === 0 ? "سليم" : `${problems.length} مشكلة`}\n`,
  );
  return problems;
}

const files = process.argv.slice(2);
if (files.length === 0) {
  process.stderr.write("الاستخدام: node scripts/verify-glb.mjs <file.glb> ...\n");
  process.exit(1);
}

let failed = 0;
for (const file of files) {
  const problems = verify(file, await readFile(file));
  for (const problem of problems) process.stderr.write(`  - ${problem}\n`);
  if (problems.length > 0) failed++;
}
process.exit(failed > 0 ? 1 : 0);
