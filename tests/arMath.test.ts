import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { clampDistance, deviceQuaternion, faceYaw, floorHit, focalPx, fovDeg, stepBall, stepToward } from "@/lib/arMath";

const DEG = Math.PI / 180;
const forward = (a: number, b: number, g: number, s = 0) => new Vector3(0, 0, -1).applyQuaternion(deviceQuaternion(a, b, g, s));
const up = (a: number, b: number, g: number, s = 0) => new Vector3(0, 1, 0).applyQuaternion(deviceQuaternion(a, b, g, s));

describe("相機模式的 3D 場景", () => {
  it("手機直立是看水平，往前傾 30 度就往下看 30 度", () => {
    expect(forward(0, 90, 0).y).toBeCloseTo(0, 5);
    expect(up(0, 90, 0).y).toBeCloseTo(1, 5);
    expect(forward(0, 60, 0).y).toBeCloseTo(-Math.sin(30 * DEG), 5);
  });

  it("手機轉成橫的（螢幕旋轉 90 度）時，畫面依然是正的、看著前方", () => {
    for (const [g, s] of [[-90, 90], [90, -90]] as const) {
      expect(forward(0, 0, g, s).y).toBeCloseTo(0, 5);
      expect(up(0, 0, g, s).y).toBeCloseTo(1, 5);
    }
  });

  it("手機往左轉，相機的方向跟著往左", () => {
    const f = forward(30, 90, 0);
    expect(f.x).toBeCloseTo(-Math.sin(30 * DEG), 5);
  });

  it("視線打到地板：離地 1.3 公尺往下 30 度，距離約 2.25 公尺", () => {
    const o = new Vector3(0, 1.3, 0);
    const p = floorHit(o, forward(0, 60, 0))!;
    expect(Math.hypot(p.x, p.z)).toBeCloseTo(1.3 / Math.tan(30 * DEG), 3);
    expect(p.y).toBe(0);
    expect(floorHit(o, forward(0, 90, 0))).toBeNull();
    expect(Math.hypot(...(({ x, z }) => [x, z])(floorHit(o, new Vector3(0, -0.05, -1).normalize(), 8)!))).toBeCloseTo(8, 5);
  });

  it("動物轉向看著相機、距離限制、往目標走", () => {
    expect(faceYaw({ x: 0, z: -2 }, { x: 0, z: 0 })).toBeCloseTo(0);
    expect(faceYaw({ x: 0, z: 2 }, { x: 0, z: 0 })).toBeCloseTo(Math.PI);
    const p = clampDistance(new Vector3(0, 0, -20), { x: 0, z: 0 }, 0.5, 8);
    expect(p.z).toBeCloseTo(-8);
    const q = new Vector3(0, 0, 0);
    expect(stepToward(q, new Vector3(1, 0, 0), 0.4)).toBe(false);
    expect(q.x).toBeCloseTo(0.4);
    expect(stepToward(q, new Vector3(1, 0, 0), 0.7)).toBe(true);
  });

  it("丟出去的球會落地、彈跳，最後停下來", () => {
    const b = { p: new Vector3(0, 1.1, 0), v: new Vector3(0, 2, -3), r: 0.035 };
    let maxY = 0;
    let stopped = false;
    for (let i = 0; i < 600 && !stopped; i++) { stopped = stepBall(b, 1 / 60); maxY = Math.max(maxY, b.p.y); }
    expect(stopped).toBe(true);
    expect(maxY).toBeGreaterThan(1.1);
    expect(b.p.y).toBeCloseTo(0.035);
    expect(b.p.z).toBeLessThan(-1.5);
  });

  it("相機焦距和視角換算", () => {
    expect(focalPx(390, 600, 1080, 1920, 63)).toBeCloseTo(((1920 / 2) * Math.max(390 / 1080, 600 / 1920)) / Math.tan(31.5 * DEG), 3);
    expect(fovDeg(600, 300)).toBeCloseTo(90, 5);
  });
});
