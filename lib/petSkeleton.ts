/**
 * 四足動物的真骨架：從模型自動量出關節位置、算出每個點跟著哪幾根骨頭（蒙皮），
 * 再用「腳掌踩在指定位置、膝蓋自動彎」（反向運動學）算出每一格的姿勢。
 *
 * 座標（normalizeRig 之後）：腳底 y=0、身高 1、頭朝 +X、左側是 +Z。
 * 所有骨頭在站姿時的旋轉都是 0，所以「世界旋轉」直接就是相對站姿的旋轉。
 */
import * as THREE from "three";
import type { RigInfo } from "@/lib/petRig";

type V = THREE.Vector3;
type Q = THREE.Quaternion;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export const BONES = [
  "pelvis", "spine", "chest", "neck", "head", "tail1", "tail2", "tail3",
  "flUpper", "flLower", "flFoot", "frUpper", "frLower", "frFoot",
  "blUpper", "blLower", "blFoot", "brUpper", "brLower", "brFoot",
] as const;
export const PARENT = [-1, 0, 1, 2, 3, 0, 5, 6, 2, 8, 9, 2, 11, 12, 0, 14, 15, 0, 17, 18];
const PELVIS = 0, SPINE = 1, CHEST = 2, NECK = 3, HEAD = 4, TAIL = 5, LEG = 8;

export type Leg = {
  bone: number;      // 大腿骨的編號（接著是小腿、腳掌）
  front: boolean;
  hip: V; knee: V; ankle: V; paw: V;
  l1: number; l2: number;
  pole: number;      // 膝蓋彎的方向：+1 往前（後腿）、-1 往後（前腿的肘）
  d1: V; d2: V;      // 站姿時大腿、小腿的方向
};

export type Skel = {
  rest: V[];          // 每根骨頭起點（關節）在站姿的位置
  legs: Leg[];        // 前左、前右、後左、後右
  shoulder: V;        // 兩個前肩的中點
  sitY: number;       // 坐下時骨盆的高度
  headYaw: number;    // 模型的頭原本朝哪邊（0 = 正前方）
  face: V;            // 頭朝的方向（水平單位向量）
  mouth: V;           // 嘴巴的位置
  tailDroop: number;  // 尾巴原本垂下的角度
  skinIndex: Uint16Array;
  skinWeight: Float32Array;
};

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/** 兩節骨頭的反向運動學：已知臀部和腳踝位置，算出膝蓋位置。目標太遠或太近時腳踝會被拉回可到達的範圍。 */
export function solveKnee(hip: V, ankle: V, l1: number, l2: number, pole: number, knee: V, ankleOut: V) {
  const dir = ankleOut.copy(ankle).sub(hip);
  let dist = dir.length();
  if (dist < 1e-6) { dir.set(0, -1, 0); dist = 1e-6; } else dir.multiplyScalar(1 / dist);
  dist = clamp(dist, Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-4);
  const a = (l1 * l1 + dist * dist - l2 * l2) / (2 * dist);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  // 膝蓋往 pole（前或後）彎：取 ±X 垂直於腿的那個分量
  const k = dir.x * pole;
  let px = pole - dir.x * k, py = -dir.y * k, pz = -dir.z * k;
  const pl = Math.hypot(px, py, pz);
  if (pl < 1e-5) { px = 0; py = 1; pz = 0; } else { px /= pl; py /= pl; pz /= pl; }
  knee.set(hip.x + dir.x * a + px * h, hip.y + dir.y * a + py * h, hip.z + dir.z * a + pz * h);
  ankleOut.set(hip.x + dir.x * dist, hip.y + dir.y * dist, hip.z + dir.z * dist);
}

/** pos 必須已經 normalizeRig 過；rig 是 analyzeRig 的結果。 */
export function buildSkeleton(pos: Float32Array, rig: RigInfo): Skel {
  const n = pos.length / 3;
  const W = rig.weights;
  const X = (i: number) => pos[i * 3], Y = (i: number) => pos[i * 3 + 1], Z = (i: number) => pos[i * 3 + 2];
  const belly = rig.hipY - 0.12;
  const centroid = (pick: (i: number) => boolean) => {
    let x = 0, y = 0, z = 0, c = 0;
    for (let i = 0; i < n; i++) if (pick(i)) { x += X(i); y += Y(i); z += Z(i); c++; }
    return c >= 3 ? V3(x / c, y / c, z / c) : null;
  };
  const rest: V[] = BONES.map(() => V3());

  // ── 四條腿：在幾個高度切一刀，取截面中心當關節
  const kneeY = Math.max(0.12, belly - 0.01);
  const ankleY = kneeY * 0.42;
  const legs: Leg[] = [];
  const scratchK = V3(), scratchA = V3();
  for (let k = 0; k < 4; k++) {
    const id = k + 1, front = k < 2, side = k % 2 === 0 ? 1 : -1;
    const legX = front ? rig.frontX : rig.backX;
    const mine = (i: number) => Math.round(W[i * 4]) === id;
    const at = (yc: number, half: number, fb: V) => {
      const c = centroid((i) => mine(i) && W[i * 4 + 1] > 0.25 && Math.abs(Y(i) - yc) < half);
      return c ? c.setY(yc) : fb;
    };
    const paw = at(0.03, 0.035, V3(legX, 0, side * rig.width * 0.22)).setY(0);
    const ankle = at(ankleY, 0.03, V3(paw.x, ankleY, paw.z));
    const kneeM = at(kneeY, 0.03, V3(legX, kneeY, paw.z));
    const top = centroid((i) => mine(i) && Y(i) > belly && Y(i) < rig.hipY);
    const hip = V3(top ? top.x : legX, rig.hipY + (front ? 0.07 : 0.05), (top ? top.z : kneeM.z) * 0.85);
    const l1 = hip.distanceTo(kneeM), l2 = kneeM.distanceTo(ankle);
    const pole = front ? -1 : 1;
    // 站姿的膝蓋改用同一套算法算出來的位置，這樣站著時模型跟原本一模一樣
    solveKnee(hip, ankle, l1, l2, pole, scratchK, scratchA);
    const knee = scratchK.clone();
    const b = LEG + k * 3;
    rest[b].copy(hip); rest[b + 1].copy(knee); rest[b + 2].copy(ankle);
    legs.push({ bone: b, front, hip, knee, ankle, paw, l1, l2, pole, d1: knee.clone().sub(hip).normalize(), d2: ankle.clone().sub(knee).normalize() });
  }

  // ── 身體：骨盆（後腿上方）→ 脊椎 → 胸（前腿上方）
  const span = rig.frontX - rig.backX;
  const xs = rig.backX + 0.36 * span, xc = rig.backX + 0.72 * span;
  const isTorso = (i: number) => W[i * 4 + 1] < 0.1 && W[i * 4 + 2] < 0.1 && W[i * 4 + 3] < 0.1;
  const torsoY = (x: number) => centroid((i) => isTorso(i) && Math.abs(X(i) - x) < 0.05 && Y(i) > belly)?.y ?? rig.hipY + 0.1;
  rest[PELVIS].set(rig.backX, torsoY(rig.backX), 0);
  rest[SPINE].set(xs, torsoY(xs), 0);
  rest[CHEST].set(xc, torsoY(xc), 0);

  // ── 脖子和頭：離脖子根部越遠越屬於頭
  const N = V3(rig.neck[0], rig.neck[1], 0);
  const headD = new Float32Array(n);
  const ds: number[] = [];
  for (let i = 0; i < n; i++) {
    // 脖子根部下面的是胸口，不算往頭的方向
    headD[i] = Math.hypot(X(i) - N.x, Y(i) - N.y, Z(i) - N.z) * smooth(N.y - 0.1, N.y + 0.02, Y(i));
    if (W[i * 4 + 3] > 0.5 && Y(i) > N.y) ds.push(headD[i]);
  }
  ds.sort((a, b) => a - b);
  const headR = ds.length ? ds[Math.floor(ds.length * 0.95)] : 0.3;
  const skull = centroid((i) => W[i * 4 + 3] > 0.5 && headD[i] > 0.45 * headR) ?? V3(N.x + 0.08, N.y + 0.15, 0);
  const headJ = N.clone().add(skull.clone().sub(N).setLength(0.4 * headR));
  rest[NECK].copy(N);
  rest[HEAD].copy(headJ);
  // 頭朝哪邊：嘴巴和下巴在頭的下半部、而且比頭頂（含耳朵）更往前
  const isHead = (i: number) => W[i * 4 + 3] > 0.5 && headD[i] > 0.52 * headR;
  const upper = centroid((i) => isHead(i) && Y(i) >= skull.y) ?? skull;
  const lower = centroid((i) => isHead(i) && Y(i) < skull.y - 0.02) ?? skull.clone().add(V3(0.08, -0.05, 0));
  const face = V3(lower.x - upper.x, 0, lower.z - upper.z);
  if (face.length() < 0.015) face.set(1, 0, 0);
  face.normalize();
  // 更準的方法：兩個耳尖的連線跟臉的方向垂直。取頭頂最高的那些點（耳尖），看它們水平上往哪個方向排開
  let top = 0;
  for (let i = 0; i < n; i++) if (isHead(i)) top = Math.max(top, Y(i));
  let ex = 0, ez = 0, ec = 0;
  for (let i = 0; i < n; i++) if (isHead(i) && Y(i) > top - 0.07) { ex += X(i); ez += Z(i); ec++; }
  if (ec >= 6) {
    ex /= ec; ez /= ec;
    let cxx = 0, cxz = 0, czz = 0;
    for (let i = 0; i < n; i++) if (isHead(i) && Y(i) > top - 0.07) { const dx = X(i) - ex, dz = Z(i) - ez; cxx += dx * dx; cxz += dx * dz; czz += dz * dz; }
    const ang = 0.5 * Math.atan2(2 * cxz, cxx - czz); // 耳朵排開的方向
    const along = cxx * Math.cos(ang) ** 2 + 2 * cxz * Math.sin(ang) * Math.cos(ang) + czz * Math.sin(ang) ** 2;
    const across = cxx + czz - along;
    if (along > across * 2.5) { // 兩個耳朵分得夠開才採用
      const px = -Math.sin(ang), pz = Math.cos(ang);
      const sign = px * face.x + pz * face.z >= 0 ? 1 : -1;
      face.set(px * sign, 0, pz * sign);
    }
  }
  // 嘴巴：頭下半部最往前的那一群點
  const fwd: { i: number; d: number }[] = [];
  for (let i = 0; i < n; i++) if (isHead(i) && Y(i) < skull.y) fwd.push({ i, d: (X(i) - upper.x) * face.x + (Z(i) - upper.z) * face.z });
  fwd.sort((a, b) => b.d - a.d);
  const tip = fwd.slice(0, Math.max(3, Math.floor(fwd.length * 0.12)));
  const mouth = V3();
  for (const t of tip) mouth.add(V3(X(t.i), Y(t.i), Z(t.i)));
  if (tip.length) mouth.multiplyScalar(1 / tip.length); else mouth.copy(skull).addScaledVector(face, 0.12);
  const headYaw = Math.atan2(-face.z, face.x);

  // ── 尾巴：沿著尾巴分三節
  const T = V3(rig.tail[0], rig.tail[1], 0);
  const tailD = new Float32Array(n);
  const td: number[] = [];
  for (let i = 0; i < n; i++) {
    tailD[i] = Math.hypot(X(i) - T.x, Y(i) - T.y, Z(i) - T.z);
    if (W[i * 4 + 2] > 0.4) td.push(tailD[i]);
  }
  td.sort((a, b) => a - b);
  const tailR = td.length ? Math.max(0.08, td[Math.floor(td.length * 0.95)]) : 0.25;
  const band = (a: number, b: number, fb: V) => centroid((i) => W[i * 4 + 2] > 0.4 && tailD[i] > a * tailR && tailD[i] < b * tailR) ?? fb;
  const t2 = band(0.27, 0.4, V3(T.x - tailR * 0.33, T.y - tailR * 0.1, 0));
  const t3 = band(0.6, 0.73, V3(T.x - tailR * 0.66, T.y - tailR * 0.2, 0));
  const tEnd = band(0.88, 1.2, V3(T.x - tailR, T.y - tailR * 0.3, 0));
  rest[TAIL].copy(T); rest[TAIL + 1].copy(t2); rest[TAIL + 2].copy(t3);
  const tailDroop = clamp(Math.atan2(T.y - tEnd.y, Math.max(0.02, T.x - tEnd.x)), 0, 1.4);

  // ── 蒙皮：每個點最多跟四根骨頭
  const skinIndex = new Uint16Array(n * 4);
  const skinWeight = new Float32Array(n * 4);
  const acc = new Float32Array(BONES.length);
  for (let i = 0; i < n; i++) {
    acc.fill(0);
    const x = X(i), y = Y(i);
    let lw = W[i * 4 + 1], tw = W[i * 4 + 2], hw = W[i * 4 + 3];
    const sum = lw + tw + hw;
    if (sum > 1) { lw /= sum; tw /= sum; hw /= sum; }
    const id = Math.round(W[i * 4]);
    if (lw > 0 && id > 0) {
      const b = LEG + (id - 1) * 3;
      const up = smooth(kneeY - 0.03, kneeY + 0.03, y);
      const foot = 1 - smooth(ankleY - 0.025, ankleY + 0.025, y);
      acc[b] += lw * up; acc[b + 2] += lw * foot; acc[b + 1] += lw * Math.max(0, 1 - up - foot);
    }
    if (tw > 0) {
      const t = tailD[i] / tailR;
      const a = smooth(1 / 3 - 0.08, 1 / 3 + 0.08, t), b = smooth(2 / 3 - 0.08, 2 / 3 + 0.08, t);
      acc[TAIL] += tw * (1 - a); acc[TAIL + 1] += tw * (a - b); acc[TAIL + 2] += tw * b;
    }
    if (hw > 0) {
      const h = smooth(0.32, 0.52, headD[i] / headR);
      acc[NECK] += hw * (1 - h); acc[HEAD] += hw * h;
    }
    const body = Math.max(0, 1 - lw - tw - hw);
    if (body > 0) {
      const s = smooth(xs - 0.07, xs + 0.07, x), c = smooth(xc - 0.07, xc + 0.07, x);
      acc[PELVIS] += body * (1 - s); acc[SPINE] += body * (s - c); acc[CHEST] += body * c;
    }
    let total = 0;
    for (let j = 0; j < 4; j++) {
      let best = 0;
      for (let b = 1; b < acc.length; b++) if (acc[b] > acc[best]) best = b;
      skinIndex[i * 4 + j] = best;
      skinWeight[i * 4 + j] = acc[best];
      total += acc[best];
      acc[best] = -1;
    }
    if (total <= 0) { skinIndex[i * 4] = PELVIS; skinWeight[i * 4] = 1; total = 1; }
    for (let j = 0; j < 4; j++) skinWeight[i * 4 + j] = Math.max(0, skinWeight[i * 4 + j]) / total;
  }

  // ── 坐下時骨盆要降到多低：身體後半往上仰之後，屁股最低點剛好碰到地板
  const P0 = rest[PELVIS];
  const sitTh = 0.6;
  let low = 0;
  for (let i = 0; i < n; i++) {
    if (W[i * 4 + 2] > 0.3 || Y(i) < kneeY || X(i) > xs || X(i) < P0.x - 0.15) continue;
    const yy = (X(i) - P0.x) * Math.sin(sitTh) + (Y(i) - P0.y) * Math.cos(sitTh);
    low = Math.min(low, yy);
  }
  const sitY = clamp(-low + 0.01, 0.14, P0.y - 0.15);
  const shoulder = legs[0].hip.clone().add(legs[1].hip).multiplyScalar(0.5);
  return { rest, legs, shoulder, sitY, headYaw, face, mouth, tailDroop, skinIndex, skinWeight };
}

/** 一格的姿勢參數（都已經平滑過）。長度以身高為 1，角度是弧度。 */
export type Frame = {
  sit: number;      // 0 站著 ~ 1 坐下
  phase: number;    // 步伐（圈數）
  amp: number;      // 0 站著 ~ 1 邁開步伐
  stride: number;   // 一步的長度
  trot: number;     // 0 走路的腳步順序 ~ 1 小跑步
  lift: number;     // 跳起來的高度
  crouch: number;   // 蹲低
  look: number;     // 頭比原本多轉多少（正值＝往左轉）
  tilt: number;     // 歪頭
  nod: number;      // 低頭（負值＝抬頭）
  wag: number; wagAmp: number; tailUp: number;
  breath: number;
};
export const restFrame = (): Frame => ({ sit: 0, phase: 0, amp: 0, stride: 0, trot: 0, lift: 0, crouch: 0, look: 0, tilt: 0, nod: 0, wag: 0, wagAmp: 0, tailUp: 0, breath: 0 });

export type Solved = { pos: V[]; q: Q[] };
export const newSolved = (): Solved => ({ pos: BONES.map(() => V3()), q: BONES.map(() => new THREE.Quaternion()) });

const AY = V3(0, 1, 0), AZ = V3(0, 0, 1);
const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
const va = V3(), vb = V3(), vc = V3(), vd = V3(), ve = V3();
const rotY = (q: Q, a: number) => q.setFromAxisAngle(AY, a);
const frac = (x: number) => x - Math.floor(x);
const TAU = Math.PI * 2;
// 每條腿在步伐裡的起點：走路是後左→前左→後右→前右，小跑是對角線的兩隻腳一起
const WALK_OFF = [0.25, 0.75, 0, 0.5];
const TROT_OFF = [0.5, 1.0, 0, 0.5];

/** 由姿勢參數算出每根骨頭的位置和旋轉（相對站姿）。 */
export function solvePose(s: Skel, f: Frame, out: Solved): Solved {
  const { rest, legs } = s;
  const { pos: p, q } = out;
  const P0 = rest[PELVIS], S0 = s.shoulder;

  // 身體：骨盆高度決定身體仰角，讓前肩一直留在前腳正上方（坐下時前腳自然撐直）
  const vx = S0.x - P0.x, vy = S0.y - P0.y;
  const D = Math.hypot(vx, vy), a0 = Math.atan2(vy, vx);
  const bob = f.amp * (-0.006 + 0.008 * Math.sin(f.phase * 2 * TAU));
  const common = f.lift - f.crouch + bob;
  const py = P0.y + (s.sitY - P0.y) * f.sit + common;
  const sy = S0.y - 0.02 * f.sit + common - f.crouch * 0.3;
  const ang = Math.asin(clamp((sy - py) / D, -1, 1));
  const th = ang - a0;
  const px = S0.x - D * Math.cos(ang);
  const sway = 0.05 * f.amp * Math.sin(f.phase * TAU);

  rotY(q[PELVIS], -sway).multiply(qa.setFromAxisAngle(AZ, th));
  q[SPINE].setFromAxisAngle(AZ, th);
  rotY(q[CHEST], sway).multiply(qa.setFromAxisAngle(AZ, th + 0.012 * Math.sin(f.breath)));
  p[PELVIS].set(px, py, P0.z);
  p[SPINE].copy(va.copy(rest[SPINE]).sub(P0).applyQuaternion(q[PELVIS])).add(p[PELVIS]);
  p[CHEST].copy(va.copy(rest[CHEST]).sub(rest[SPINE]).applyQuaternion(q[SPINE])).add(p[SPINE]);
  p[NECK].copy(va.copy(rest[NECK]).sub(rest[CHEST]).applyQuaternion(q[CHEST])).add(p[CHEST]);

  // 脖子和頭：身體仰起來時頭保持水平；轉頭由脖子和頭分擔
  const look = clamp(f.look, -1.7, 1.7);
  rotY(q[NECK], look * 0.4).multiply(qa.setFromAxisAngle(AZ, th * 0.35));
  vb.set(s.face.z, 0, -s.face.x); // 繞這個軸轉＝低頭
  rotY(q[HEAD], look).multiply(qa.setFromAxisAngle(s.face, f.tilt)).multiply(qb.setFromAxisAngle(vb, f.nod));
  p[HEAD].copy(va.copy(rest[HEAD]).sub(rest[NECK]).applyQuaternion(q[NECK])).add(p[NECK]);

  // 尾巴：一節一節接力擺動；坐下時抬平才不會插進地板
  const raise = f.tailUp + s.tailDroop * 0.9 * f.sit;
  const base = th * (1 - f.sit);
  const w1 = f.wagAmp * Math.sin(f.wag), w2 = w1 + f.wagAmp * 0.9 * Math.sin(f.wag - 0.8), w3 = w2 + f.wagAmp * 0.9 * Math.sin(f.wag - 1.6);
  rotY(q[TAIL], w1).multiply(qa.setFromAxisAngle(AZ, base - raise * 0.6));
  rotY(q[TAIL + 1], w2).multiply(qa.setFromAxisAngle(AZ, base - raise * 0.9));
  rotY(q[TAIL + 2], w3).multiply(qa.setFromAxisAngle(AZ, base - raise));
  p[TAIL].copy(va.copy(rest[TAIL]).sub(P0).applyQuaternion(q[PELVIS])).add(p[PELVIS]);
  p[TAIL + 1].copy(va.copy(rest[TAIL + 1]).sub(rest[TAIL]).applyQuaternion(q[TAIL])).add(p[TAIL]);
  p[TAIL + 2].copy(va.copy(rest[TAIL + 2]).sub(rest[TAIL + 1]).applyQuaternion(q[TAIL + 1])).add(p[TAIL + 1]);

  // 腿：先決定腳掌要踩在哪，再反推膝蓋
  const beta = 0.62 - 0.12 * f.trot; // 一圈裡腳踩在地上的比例
  const air = Math.max(0, f.lift - 0.02) * 0.85;
  for (let k = 0; k < 4; k++) {
    const L = legs[k];
    const b = L.bone;
    const parent = L.front ? CHEST : PELVIS;
    const hip = p[b].copy(va.copy(L.hip).sub(rest[parent]).applyQuaternion(q[parent])).add(p[parent]);
    const ph = frac(f.phase + WALK_OFF[k] + (TROT_OFF[k] - WALK_OFF[k]) * f.trot);
    let dx: number, dy = 0, swing = 0;
    if (ph < beta) dx = 0.5 - ph / beta; // 踩在地上：隨身體前進而往後
    else {
      const u = (ph - beta) / (1 - beta);
      dx = -0.5 + (0.5 - 0.5 * Math.cos(Math.PI * u)); // 抬起來往前跨
      swing = Math.sin(Math.PI * u);
      dy = (0.035 + 0.12 * f.stride + 0.02 * f.trot) * swing;
    }
    const paw = vc.copy(L.paw);
    paw.x += dx * f.stride * f.amp;
    paw.y += dy * f.amp + air;
    // 腳掌的角度：跨步時腳尖往後垂；後腳坐下時整個腳掌平貼地板、往前伸
    let pitch = -0.55 * swing * f.amp - 0.35 * Math.min(1, air / 0.08);
    if (!L.front) {
      pitch += 1.15 * f.sit;
      paw.x += (px + 0.17 - L.paw.x) * f.sit;
      paw.y += 0.012 * f.sit;
    }
    q[b + 2].setFromAxisAngle(AZ, pitch);
    const ankle = vd.copy(L.paw).sub(L.ankle).applyQuaternion(q[b + 2]).negate().add(paw);
    solveKnee(hip, ankle, L.l1, L.l2, L.pole, p[b + 1], p[b + 2]);
    q[b].setFromUnitVectors(L.d1, ve.copy(p[b + 1]).sub(hip).normalize());
    q[b + 1].setFromUnitVectors(L.d2, ve.copy(p[b + 2]).sub(p[b + 1]).normalize());
  }
  return out;
}

/** 腳掌實際落在哪（測試和除錯用）。 */
export function pawPosition(s: Skel, out: Solved, k: number, target = V3()) {
  const L = s.legs[k];
  return target.copy(L.paw).sub(L.ankle).applyQuaternion(out.q[L.bone + 2]).add(out.pos[L.bone + 2]);
}
