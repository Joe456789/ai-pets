// 產生一張「立在地上的照片卡」的 GLB 模型：寬高依真實尺寸（公尺），貼上去背後的透明 PNG。
// 給手機內建 AR（iPhone 快速查看、Android）使用，系統會自動偵測地板並以真實大小擺放。
// 瀏覽器和伺服器都能用（只用到 Uint8Array 和 DataView）。

const pad4 = (n: number) => (n + 3) & ~3;

export function cardGlb(png: Uint8Array, pxWidth: number, pxHeight: number, heightM: number): Uint8Array {
  const h = heightM;
  const w = (heightM * pxWidth) / pxHeight;
  // 頂點：左下、右下、右上、左上，正面朝 +Z（朝向使用者）
  const positions = new Float32Array([-w / 2, 0, 0, w / 2, 0, 0, w / 2, h, 0, -w / 2, h, 0]);
  const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
  const uvs = new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]);
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);

  const parts = [positions, normals, uvs, indices, png].map((p) => new Uint8Array(p.buffer, p.byteOffset, p.byteLength));
  const offsets: number[] = [];
  let total = 0;
  for (const p of parts) { offsets.push(total); total = pad4(total + p.byteLength); }
  const bin = new Uint8Array(total);
  parts.forEach((p, i) => bin.set(p, offsets[i]));

  const view = (i: number, target?: number) => ({ buffer: 0, byteOffset: offsets[i], byteLength: parts[i].byteLength, ...(target ? { target } : {}) });
  const gltf = {
    asset: { version: "2.0", generator: "langlang-partner" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: "pet-card" }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0 }] }],
    materials: [{
      pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 1 },
      alphaMode: "MASK", alphaCutoff: 0.5, doubleSided: true,
    }],
    textures: [{ source: 0, sampler: 0 }],
    samplers: [{ magFilter: 9729, minFilter: 9729, wrapS: 33071, wrapT: 33071 }],
    images: [{ bufferView: 4, mimeType: "image/png" }],
    buffers: [{ byteLength: bin.byteLength }],
    bufferViews: [view(0, 34962), view(1, 34962), view(2, 34962), view(3, 34963), view(4)],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 4, type: "VEC3", min: [-w / 2, 0, 0], max: [w / 2, h, 0] },
      { bufferView: 1, componentType: 5126, count: 4, type: "VEC3" },
      { bufferView: 2, componentType: 5126, count: 4, type: "VEC2" },
      { bufferView: 3, componentType: 5123, count: 6, type: "SCALAR" },
    ],
  };

  let json = new TextEncoder().encode(JSON.stringify(gltf));
  const jsonLen = pad4(json.byteLength);
  const padded = new Uint8Array(jsonLen).fill(0x20);
  padded.set(json);
  json = padded;

  const length = 12 + 8 + jsonLen + 8 + bin.byteLength;
  const out = new Uint8Array(length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true); // "glTF"
  dv.setUint32(4, 2, true);
  dv.setUint32(8, length, true);
  dv.setUint32(12, jsonLen, true);
  dv.setUint32(16, 0x4e4f534a, true); // "JSON"
  out.set(json, 20);
  dv.setUint32(20 + jsonLen, bin.byteLength, true);
  dv.setUint32(24 + jsonLen, 0x004e4942, true); // "BIN"
  out.set(bin, 28 + jsonLen);
  return out;
}
