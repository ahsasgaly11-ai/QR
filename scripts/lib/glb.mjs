// كاتب ملفات glTF 2.0 الثنائية (GLB) بلا أي اعتماديات خارجية.
// يدعم الخامات، الشبكات متعددة الأجزاء، وأهداف التشويه (morph targets) اللازمة لمحاكاة الانقباض.

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const FLOAT = 5126;
const UNSIGNED_SHORT = 5123;
const UNSIGNED_INT = 5125;
const ARRAY_BUFFER = 34962;
const ELEMENT_ARRAY_BUFFER = 34963;

const pad4 = (value) => (value + 3) & ~3;

export class GlbBuilder {
  constructor(generator = "scripts/build-anatomy-models.mjs") {
    this.generator = generator;
    this.materials = [];
    this.meshes = [];
    this.nodes = [];
    this.accessors = [];
    this.bufferViews = [];
    this.chunks = [];
    this.byteLength = 0;
  }

  // كتابة مصفوفة ثنائية في المخزن مع محاذاة 4 بايت.
  #writeBuffer(typedArray, target) {
    const padding = pad4(this.byteLength) - this.byteLength;
    if (padding > 0) {
      this.chunks.push(Buffer.alloc(padding));
      this.byteLength += padding;
    }
    const buffer = Buffer.from(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
    const view = { buffer: 0, byteOffset: this.byteLength, byteLength: buffer.length };
    if (target !== undefined) view.target = target;
    this.chunks.push(buffer);
    this.byteLength += buffer.length;
    this.bufferViews.push(view);
    return this.bufferViews.length - 1;
  }

  addVec3Accessor(values, { target = ARRAY_BUFFER, normalized = false } = {}) {
    const data = Float32Array.from(values);
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < data.length; i += 3) {
      for (let axis = 0; axis < 3; axis++) {
        min[axis] = Math.min(min[axis], data[i + axis]);
        max[axis] = Math.max(max[axis], data[i + axis]);
      }
    }
    this.accessors.push({
      bufferView: this.#writeBuffer(data, target),
      componentType: FLOAT,
      count: data.length / 3,
      type: "VEC3",
      min,
      max,
      ...(normalized ? { normalized: true } : {}),
    });
    return this.accessors.length - 1;
  }

  addIndexAccessor(indices) {
    const maxIndex = indices.reduce((a, b) => Math.max(a, b), 0);
    const useShort = maxIndex < 65536;
    const data = useShort ? Uint16Array.from(indices) : Uint32Array.from(indices);
    this.accessors.push({
      bufferView: this.#writeBuffer(data, ELEMENT_ARRAY_BUFFER),
      componentType: useShort ? UNSIGNED_SHORT : UNSIGNED_INT,
      count: data.length,
      type: "SCALAR",
    });
    return this.accessors.length - 1;
  }

  addMaterial({ name, color = [0.8, 0.8, 0.8], alpha = 1, roughness = 0.7, metallic = 0 }) {
    this.materials.push({
      name,
      doubleSided: true,
      ...(alpha < 1 ? { alphaMode: "BLEND" } : {}),
      pbrMetallicRoughness: {
        baseColorFactor: [...color, alpha],
        metallicFactor: metallic,
        roughnessFactor: roughness,
      },
    });
    return this.materials.length - 1;
  }

  // primitives: [{ positions, indices, material, targets: [{ positions, name }] }]
  addMesh({ name, primitives }) {
    const targetNames = [];
    const built = primitives.map((primitive) => {
      const attributes = {
        POSITION: this.addVec3Accessor(primitive.positions),
        NORMAL: this.addVec3Accessor(primitive.normals),
      };
      const result = {
        attributes,
        indices: this.addIndexAccessor(primitive.indices),
        material: primitive.material,
      };

      if (primitive.targets?.length) {
        result.targets = primitive.targets.map((target) => {
          if (!targetNames.includes(target.name)) targetNames.push(target.name);
          return {
            // أهداف التشويه تُخزَّن كإزاحات نسبية عن الوضع الأساسي.
            POSITION: this.addVec3Accessor(target.positions, { target: undefined }),
            NORMAL: this.addVec3Accessor(target.normals, { target: undefined }),
          };
        });
      }
      return result;
    });

    const mesh = { name, primitives: built };
    if (targetNames.length > 0) {
      mesh.weights = targetNames.map(() => 0);
      mesh.extras = { targetNames };
    }
    this.meshes.push(mesh);
    return this.meshes.length - 1;
  }

  addNode({ name, mesh, translation, rotation, scale, children }) {
    this.nodes.push({
      name,
      ...(mesh !== undefined ? { mesh } : {}),
      ...(translation ? { translation } : {}),
      ...(rotation ? { rotation } : {}),
      ...(scale ? { scale } : {}),
      ...(children ? { children } : {}),
    });
    return this.nodes.length - 1;
  }

  toBuffer(rootNodes) {
    const binary = Buffer.concat(this.chunks);
    const gltf = {
      asset: { version: "2.0", generator: this.generator },
      scene: 0,
      scenes: [{ nodes: rootNodes ?? this.nodes.map((_, index) => index) }],
      nodes: this.nodes,
      meshes: this.meshes,
      materials: this.materials,
      accessors: this.accessors,
      bufferViews: this.bufferViews,
      buffers: [{ byteLength: binary.length }],
    };

    const jsonChunk = Buffer.from(JSON.stringify(gltf), "utf8");
    const jsonPadded = Buffer.concat([jsonChunk, Buffer.alloc(pad4(jsonChunk.length) - jsonChunk.length, 0x20)]);
    const binPadded = Buffer.concat([binary, Buffer.alloc(pad4(binary.length) - binary.length, 0)]);

    const header = Buffer.alloc(12);
    header.write("glTF", 0, "ascii");
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(12 + 8 + jsonPadded.length + 8 + binPadded.length, 8);

    const jsonHeader = Buffer.alloc(8);
    jsonHeader.writeUInt32LE(jsonPadded.length, 0);
    jsonHeader.write("JSON", 4, "ascii");

    const binHeader = Buffer.alloc(8);
    binHeader.writeUInt32LE(binPadded.length, 0);
    binHeader.write("BIN\0", 4, "ascii");

    return Buffer.concat([header, jsonHeader, jsonPadded, binHeader, binPadded]);
  }

  async write(file, rootNodes) {
    const buffer = this.toBuffer(rootNodes);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, buffer);
    return buffer.length;
  }
}
