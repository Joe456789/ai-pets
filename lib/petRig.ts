/**
 * 四足動物 3D 模型的自動骨架（不用另外綁骨頭）。
 *
 * 從模型的點位置找出：四隻腳、尾巴、頭，給每個點一組分區權重。
 * 真正的骨架和蒙皮在 petSkeleton.ts，動作在 petAnim.ts。
 *
 * 座標約定（normalizeRig 之後）：腳底 y=0、身高 1、頭朝 +X、身體中心 x=z=0。
 */

export type RigInfo = {
  /** 每個點 4 個數：腳編號（0 不是腳；1 前左、2 前右、3 後左、4 後右）、腳權重、尾巴權重、頭權重 */
  weights: Float32Array;
  hipY: number;
  frontX: number;
  backX: number;
  tail: [number, number];
  neck: [number, number];
  length: number;
  width: number;
  /** 模型原本頭朝 -X，已經轉過來 */
  flipped: boolean;
};

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** 把模型放正：腳底在 0、高度 1、中心在原點、頭朝 +X。直接改 pos。 */
export function normalizeRig(pos: Float32Array): { flipped: boolean; scale: number } {
  const n = pos.length / 3;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
  }
  const s = 1 / (y1 - y0);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const L = x1 - x0;
  // 頭那一端比較高（耳朵、頭頂），尾巴那端比較低
  let topPlus = -Infinity, topMinus = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1];
    if (x > x1 - 0.22 * L) topPlus = Math.max(topPlus, y);
    if (x < x0 + 0.22 * L) topMinus = Math.max(topMinus, y);
  }
  const flipped = topMinus > topPlus;
  for (let i = 0; i < n; i++) {
    let x = (pos[i * 3] - cx) * s;
    let z = (pos[i * 3 + 2] - cz) * s;
    if (flipped) { x = -x; z = -z; }
    pos[i * 3] = x;
    pos[i * 3 + 1] = (pos[i * 3 + 1] - y0) * s;
    pos[i * 3 + 2] = z;
  }
  return { flipped, scale: s };
}

/** pos 必須已經 normalizeRig 過。 */
export function analyzeRig(pos: Float32Array, flipped = false): RigInfo {
  const n = pos.length / 3;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < n; i++) {
    x0 = Math.min(x0, pos[i * 3]); x1 = Math.max(x1, pos[i * 3]);
    z0 = Math.min(z0, pos[i * 3 + 2]); z1 = Math.max(z1, pos[i * 3 + 2]);
  }
  const L = x1 - x0;

  // 肚子：身體中段最低的點；比這低的就是腳
  let belly = Infinity;
  for (let i = 0; i < n; i++) if (Math.abs(pos[i * 3]) < 0.1 * L) belly = Math.min(belly, pos[i * 3 + 1]);
  belly = Math.min(0.6, Math.max(0.2, Number.isFinite(belly) ? belly : 0.4));

  // 腳掌：貼近地板的點。腳的前後範圍以腳掌為準（垂下來的尾巴不會碰到地板）
  let lx0 = Infinity, lx1 = -Infinity;
  for (let i = 0; i < n; i++) if (pos[i * 3 + 1] < 0.06) { lx0 = Math.min(lx0, pos[i * 3]); lx1 = Math.max(lx1, pos[i * 3]); }
  if (!Number.isFinite(lx0)) { lx0 = x0 + 0.15 * L; lx1 = x1 - 0.15 * L; }
  const legMid = (lx0 + lx1) / 2;
  const inLegs = (x: number) => x > lx0 - 0.03 && x < lx1 + 0.03;

  // 腳：前後用 x 分、左右用 z 分
  const legPts: number[] = [];
  for (let i = 0; i < n; i++) if (pos[i * 3 + 1] < belly && inLegs(pos[i * 3])) legPts.push(i);
  const groupX = [0, 0];
  const groupN = [0, 0];
  const zSum = [0, 0];
  for (const i of legPts) {
    const g = pos[i * 3] > legMid ? 0 : 1;
    const y = pos[i * 3 + 1];
    zSum[g] += pos[i * 3 + 2];
    if (y > belly * 0.5) { groupX[g] += pos[i * 3]; groupN[g]++; }
  }
  const frontX = groupN[0] ? groupX[0] / groupN[0] : lx1 - 0.1 * L;
  const backX = groupN[1] ? groupX[1] / groupN[1] : lx0 + 0.1 * L;
  const zMid = [0, 1].map((g) => {
    const c = legPts.filter((i) => (pos[i * 3] > legMid ? 0 : 1) === g).length;
    return c ? zSum[g] / c : 0;
  });
  const hipY = belly + 0.12;
  const reach = Math.max(0.08, (lx1 - lx0) * 0.22);

  // 尾巴：在後腳掌後面
  const tailStart = lx0 - 0.02;
  let tailY = 0, tailN = 0;
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3];
    if (x < tailStart && x > tailStart - 0.06 && pos[i * 3 + 1] > belly * 0.6) { tailY += pos[i * 3 + 1]; tailN++; }
  }
  const tail: [number, number] = [tailStart, tailN ? tailY / tailN : hipY + 0.15];

  // 頭：在前腳前面、比肩膀高
  const neck: [number, number] = [frontX + 0.06 * L, hipY + 0.28];

  const weights = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    const g = x > legMid ? 0 : 1;
    const legX = g === 0 ? frontX : backX;
    // 腳：肚子以下全權重，到臀部高度慢慢淡出；只算靠近腳的那一段 x
    const nearLeg = smooth(reach * 1.6, reach, Math.abs(x - legX));
    const legW = smooth(hipY, belly - 0.04, y) * nearLeg * smooth(lx0 - 0.06, lx0 - 0.01, x);
    const side = z > zMid[g] ? 0 : 1;
    const id = legW > 0.001 ? 1 + g * 2 + side : 0;
    // 尾巴根部附近只算比較高的點（避開後腳跟）；再往後就不管高度都是尾巴（垂到地上的尾巴尖）
    const tailW = smooth(tail[0], tail[0] - 0.12 * L, x) * Math.max(smooth(belly * 0.4, belly * 0.8, y), smooth(tail[0] - 0.05, tail[0] - 0.12, x));
    const headW = smooth(neck[0] - 0.04 * L, neck[0] + 0.1 * L, x) * smooth(belly, hipY + 0.05, y);
    weights[i * 4] = id;
    weights[i * 4 + 1] = legW;
    weights[i * 4 + 2] = tailW;
    weights[i * 4 + 3] = headW;
  }
  return { weights, hipY, frontX, backX, tail, neck, length: L, width: z1 - z0, flipped };
}
