import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { newAnim, spring, stepAnim, triggerAct } from "@/lib/petAnim";
import { analyzeRig, normalizeRig } from "@/lib/petRig";
import { BONES, buildSkeleton, newSolved, pawPosition, restFrame, solvePose } from "@/lib/petSkeleton";

// 用方塊拼一隻假狗：身體、四隻腳、頭（+X 端、比較高）、下垂的尾巴（-X 端、不碰地）
type Box = [number, number, number, number, number, number];
const parts: Record<string, Box> = {
  body: [-0.5, 0.45, -0.15, 0.5, 0.8, 0.15],
  fl: [0.3, 0, 0.05, 0.4, 0.45, 0.13],
  fr: [0.3, 0, -0.13, 0.4, 0.45, -0.05],
  bl: [-0.4, 0, 0.05, -0.3, 0.45, 0.13],
  br: [-0.4, 0, -0.13, -0.3, 0.45, -0.05],
  head: [0.5, 0.7, -0.1, 0.75, 1.1, 0.1],
  tail: [-0.8, 0.25, -0.03, -0.5, 0.6, 0.03],
};
function dog(mirror = false) {
  const pts: number[] = [];
  const tags: string[] = [];
  for (const [name, [x0, y0, z0, x1, y1, z1]] of Object.entries(parts)) {
    for (let i = 0; i <= 6; i++) for (let j = 0; j <= 6; j++) for (let k = 0; k <= 3; k++) {
      const x = x0 + ((x1 - x0) * i) / 6;
      pts.push(mirror ? -x : x, y0 + ((y1 - y0) * j) / 6, z0 + ((z1 - z0) * k) / 3);
      tags.push(name);
    }
  }
  return { pos: new Float32Array(pts), tags };
}

function rigOf(mirror = false) {
  const { pos, tags } = dog(mirror);
  const { flipped } = normalizeRig(pos);
  return { rig: analyzeRig(pos, flipped), tags, pos };
}

describe("自動骨架", () => {
  it("放正：腳底在 0、高度 1", () => {
    const { pos } = rigOf();
    let y0 = Infinity, y1 = -Infinity;
    for (let i = 1; i < pos.length; i += 3) { y0 = Math.min(y0, pos[i]); y1 = Math.max(y1, pos[i]); }
    expect(y0).toBeCloseTo(0);
    expect(y1).toBeCloseTo(1);
  });

  it("找得到四隻腳，而且左右前後分開", () => {
    const { rig, tags, pos } = rigOf();
    const ids: Record<string, Set<number>> = {};
    tags.forEach((t, i) => {
      if (pos[i * 3 + 1] < 0.2 && rig.weights[i * 4 + 1] > 0.9) (ids[t] ??= new Set()).add(rig.weights[i * 4]);
    });
    for (const leg of ["fl", "fr", "bl", "br"]) expect(ids[leg]?.size).toBe(1);
    const one = (t: string) => [...ids[t]][0];
    expect(new Set([one("fl"), one("fr"), one("bl"), one("br")]).size).toBe(4);
    expect(one("fl")).toBeLessThan(3);
    expect(one("bl")).toBeGreaterThan(2);
  });

  it("下垂的尾巴算尾巴、不算腳；頭算頭", () => {
    const { rig, tags } = rigOf();
    const avg = (t: string, k: number) => {
      const w = tags.flatMap((x, i) => (x === t ? [rig.weights[i * 4 + k]] : []));
      return w.reduce((a, b) => a + b, 0) / w.length;
    };
    expect(avg("tail", 2)).toBeGreaterThan(0.4);
    expect(avg("tail", 1)).toBeLessThan(0.05);
    expect(avg("head", 3)).toBeGreaterThan(0.6);
    expect(avg("body", 3)).toBeLessThan(0.2);
  });

  it("頭朝 -X 的模型會自動轉過來", () => {
    expect(rigOf(false).rig.flipped).toBe(false);
    const m = rigOf(true);
    expect(m.rig.flipped).toBe(true);
    expect(m.rig.neck[0]).toBeGreaterThan(0);
    expect(m.rig.tail[0]).toBeLessThan(0);
  });
});

function skelOf() {
  const { pos } = dog();
  const { flipped } = normalizeRig(pos);
  return { skel: buildSkeleton(pos, analyzeRig(pos, flipped)), pos };
}

describe("真骨架", () => {
  it("每條腿：髖在上、膝在中間、踝在下、腳掌在地板，左右分開", () => {
    const { skel } = skelOf();
    expect(skel.legs).toHaveLength(4);
    for (const L of skel.legs) {
      expect(L.hip.y).toBeGreaterThan(L.knee.y);
      expect(L.knee.y).toBeGreaterThan(L.ankle.y);
      expect(L.ankle.y).toBeGreaterThan(L.paw.y);
      expect(L.paw.y).toBeCloseTo(0);
      expect(L.l1).toBeGreaterThan(0.05);
      expect(L.l2).toBeGreaterThan(0.05);
    }
    expect(skel.legs[0].paw.z * skel.legs[1].paw.z).toBeLessThan(0);
    expect(skel.legs[0].paw.x).toBeGreaterThan(skel.legs[2].paw.x);
  });

  it("蒙皮：每個點的權重加起來是 1，腳掌跟腳掌骨、頭跟頭骨", () => {
    const { skel, pos } = skelOf();
    const n = pos.length / 3;
    for (let i = 0; i < n; i++) {
      const w = skel.skinWeight;
      expect(w[i * 4] + w[i * 4 + 1] + w[i * 4 + 2] + w[i * 4 + 3]).toBeCloseTo(1, 4);
    }
    const main = (i: number) => BONES[skel.skinIndex[i * 4]];
    let foot = 0, footAll = 0, head = 0, headAll = 0;
    for (let i = 0; i < n; i++) {
      const x = pos[i * 3], y = pos[i * 3 + 1];
      if (y < 0.03 && Math.abs(x) < 0.45) { footAll++; if (main(i).endsWith("Foot")) foot++; }
      if (y > 0.97) { headAll++; if (main(i) === "head") head++; }
    }
    expect(foot / footAll).toBeGreaterThan(0.9);
    expect(head / headAll).toBeGreaterThan(0.9);
  });

  it("站姿：所有骨頭都不旋轉，腳掌在原位", () => {
    const { skel } = skelOf();
    const out = solvePose(skel, restFrame(), newSolved());
    for (const q of out.q) expect(Math.abs(q.w)).toBeGreaterThan(0.9999);
    for (let k = 0; k < 4; k++) expect(pawPosition(skel, out, k).distanceTo(skel.legs[k].paw)).toBeLessThan(1e-3);
  });

  it("坐下：屁股降低、身體仰起、前腳掌留在原地、後腿膝蓋往前彎", () => {
    const { skel } = skelOf();
    const out = solvePose(skel, { ...restFrame(), sit: 1 }, newSolved());
    expect(out.pos[0].y).toBeLessThan(skel.rest[0].y - 0.1);
    const fwd = new THREE.Vector3(1, 0, 0).applyQuaternion(out.q[0]);
    expect(fwd.y).toBeGreaterThan(0.2);
    for (const k of [0, 1]) expect(pawPosition(skel, out, k).distanceTo(skel.legs[k].paw)).toBeLessThan(0.02);
    for (const k of [2, 3]) {
      const L = skel.legs[k];
      expect(out.pos[L.bone + 1].x).toBeGreaterThan(out.pos[L.bone].x); // 膝蓋在髖的前面
      expect(pawPosition(skel, out, k).y).toBeLessThan(0.05);
    }
  });

  it("走路：踩在地上的腳貼著地板，抬起來的腳離地", () => {
    const { skel } = skelOf();
    let lifted = 0;
    for (let i = 0; i < 20; i++) {
      const out = solvePose(skel, { ...restFrame(), amp: 1, stride: 0.25, phase: i / 20 }, newSolved());
      for (let k = 0; k < 4; k++) {
        const y = pawPosition(skel, out, k).y;
        expect(y).toBeGreaterThan(-0.01);
        if (y > 0.02) lifted++;
      }
    }
    expect(lifted).toBeGreaterThan(10);
    expect(lifted).toBeLessThan(50); // 大部分時間腳是踩著的
  });

  it("轉頭只動脖子和頭，身體和腳不動", () => {
    const { skel } = skelOf();
    const out = solvePose(skel, { ...restFrame(), look: 0.8 }, newSolved());
    expect(Math.abs(out.q[4].w)).toBeLessThan(0.95);
    expect(Math.abs(out.q[0].w)).toBeGreaterThan(0.9999);
    expect(Math.abs(out.q[8].w)).toBeGreaterThan(0.9999);
  });
});

describe("動作", () => {
  const input = (speed: number) => ({ speed, look: 0, restLook: 0 });
  it("彈簧平順追上目標、不會晃過頭", () => {
    const s = { x: 0, v: 0 };
    let max = 0;
    for (let i = 0; i < 200; i++) max = Math.max(max, spring(s, 1, 6, 0.016));
    expect(s.x).toBeCloseTo(1, 3);
    expect(max).toBeLessThanOrEqual(1.0001);
  });

  it("移動時邁步、停下來腳收回", () => {
    const s = newAnim();
    for (let i = 0; i < 40; i++) stepAnim(s, 0.033, input(1));
    expect(s.frame.amp).toBeGreaterThan(0.9);
    expect(s.frame.stride).toBeGreaterThan(0.15);
    for (let i = 0; i < 80; i++) stepAnim(s, 0.033, input(0));
    expect(s.frame.amp).toBeLessThan(0.02);
  });

  it("坐下是慢慢坐下去的、移動就站起來；跳的時候會離地", () => {
    const s = newAnim();
    triggerAct(s, "sit");
    stepAnim(s, 0.033, input(0));
    expect(s.frame.sit).toBeLessThan(0.1); // 第一格還沒坐下去
    for (let i = 0; i < 40; i++) stepAnim(s, 0.033, input(0));
    expect(s.frame.sit).toBeGreaterThan(0.95);
    stepAnim(s, 0.033, input(1));
    expect(s.act).toBeNull();
    triggerAct(s, "hop");
    let top = 0;
    for (let i = 0; i < 15; i++) top = Math.max(top, stepAnim(s, 0.033, input(0)).lift);
    expect(top).toBeGreaterThan(0.1);
  });

  it("頭會看著你，走路時也是；你在正後方時看前面", () => {
    const s = newAnim();
    for (let i = 0; i < 80; i++) stepAnim(s, 0.033, { speed: 1, look: 0.7, restLook: 0 });
    expect(s.frame.look).toBeCloseTo(0.7, 1);
    for (let i = 0; i < 80; i++) stepAnim(s, 0.033, { speed: 1, look: 3.0, restLook: 0 });
    expect(Math.abs(s.frame.look)).toBeLessThan(0.05);
    // 模型的頭原本就轉向一邊時，只補上差的角度
    for (let i = 0; i < 80; i++) stepAnim(s, 0.033, { speed: 1, look: -1.2, restLook: -1.5 });
    expect(s.frame.look).toBeCloseTo(0.3, 1);
  });
});
