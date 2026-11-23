// 相機模式的 3D 場景計算：用手機的方向感測器轉動虛擬相機，地板是 y = 0，相機在手機離地高度。
// 網頁讀不到手機在房間裡的移動，只讀得到轉動，所以距離是用「手機高度 ÷ 往下看的角度」推算，誤差約兩到三成。
import { Euler, Quaternion, Vector3 } from "three";

const DEG = Math.PI / 180;

/** 相機長邊視角約 63°（多數手機主鏡頭錄影時）。依 object-fit: cover 的縮放換算成畫面上的焦距像素。 */
export function focalPx(stageW: number, stageH: number, videoW: number, videoH: number, longSideFovDeg = 63) {
  if (!videoW || !videoH) return stageH / 2 / Math.tan((longSideFovDeg / 2) * DEG);
  const s = Math.max(stageW / videoW, stageH / videoH);
  return ((Math.max(videoW, videoH) / 2) * s) / Math.tan((longSideFovDeg / 2) * DEG);
}

/** 畫面高度和焦距換算成垂直視角（度），給 three.js 的相機用。 */
export const fovDeg = (stageH: number, f: number) => (2 * Math.atan(stageH / 2 / f)) / DEG;

const Z = new Vector3(0, 0, 1);
const BACK = new Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // 相機從手機背面往外看
const euler = new Euler();
const qs = new Quaternion();

/**
 * 手機方向（deviceorientation 的 alpha/beta/gamma）加上螢幕旋轉角度，換算成相機的朝向。
 * 直拿、橫拿、倒拿都適用，所以手機轉成橫的動物也不會消失。
 */
export function deviceQuaternion(alpha: number, beta: number, gamma: number, screenAngle: number, out = new Quaternion()) {
  euler.set(beta * DEG, alpha * DEG, -gamma * DEG, "YXZ");
  out.setFromEuler(euler);
  out.multiply(BACK);
  out.multiply(qs.setFromAxisAngle(Z, -screenAngle * DEG));
  return out;
}

/** 從相機射出的視線打到地板的位置。往上看或太接近水平時回傳 null。 */
export function floorHit(origin: Vector3, dir: Vector3, maxDist = 8): Vector3 | null {
  if (dir.y > -0.04 || origin.y <= 0) return null;
  const t = -origin.y / dir.y;
  const p = origin.clone().addScaledVector(dir, t);
  const d = Math.hypot(p.x - origin.x, p.z - origin.z);
  if (d > maxDist) p.set(origin.x + ((p.x - origin.x) / d) * maxDist, 0, origin.z + ((p.z - origin.z) / d) * maxDist);
  p.y = 0;
  return p;
}

/** 讓平面（正面朝 +Z）轉向看著某一點，只轉水平方向，動物不會往後倒。 */
export const faceYaw = (from: { x: number; z: number }, to: { x: number; z: number }) => Math.atan2(to.x - from.x, to.z - from.z);

/** 地板上的點限制在離相機 min～max 公尺之間。 */
export function clampDistance(p: Vector3, cam: { x: number; z: number }, min: number, max: number) {
  const dx = p.x - cam.x;
  const dz = p.z - cam.z;
  const d = Math.hypot(dx, dz) || 1e-6;
  const k = Math.min(max, Math.max(min, d)) / d;
  p.set(cam.x + dx * k, 0, cam.z + dz * k);
  return p;
}

/** 往目標走一步，回傳是否已經走到。 */
export function stepToward(p: Vector3, target: Vector3, maxStep: number) {
  const dx = target.x - p.x;
  const dz = target.z - p.z;
  const d = Math.hypot(dx, dz);
  if (d <= maxStep) { p.set(target.x, 0, target.z); return true; }
  p.set(p.x + (dx / d) * maxStep, 0, p.z + (dz / d) * maxStep);
  return false;
}

export type Ball = { p: Vector3; v: Vector3; r: number };
const GRAVITY = 9.8;

/** 球的簡單物理：重力、落地反彈、地面摩擦。回傳球是否已經停下來。 */
export function stepBall(b: Ball, dt: number) {
  b.v.y -= GRAVITY * dt;
  b.p.addScaledVector(b.v, dt);
  const onFloor = b.p.y <= b.r;
  if (onFloor) {
    b.p.y = b.r;
    b.v.y = b.v.y < -0.6 ? -b.v.y * 0.45 : 0;
    const f = Math.max(0, 1 - 3.5 * dt);
    b.v.x *= f;
    b.v.z *= f;
  }
  return onFloor && b.v.y === 0 && Math.hypot(b.v.x, b.v.z) < 0.08;
}
