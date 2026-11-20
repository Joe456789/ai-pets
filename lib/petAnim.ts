/**
 * 動作控制：依移動速度和觸發的動作，算出每一格的姿勢參數（Frame）。
 * 所有數值都經過彈簧平滑，動作之間不會跳。
 */
import { restFrame, type Frame } from "@/lib/petSkeleton";

export type PetAct = "sit" | "hop" | "wag" | "tilt";
type Spring = { x: number; v: number };
const sp = (x = 0): Spring => ({ x, v: 0 });

/** 臨界阻尼彈簧：平順地追上目標、不會晃過頭。omega 越大越快。 */
export function spring(s: Spring, target: number, omega: number, dt: number) {
  const d = s.x - target;
  const e = Math.exp(-omega * dt);
  const t = (s.v + omega * d) * dt;
  s.x = target + (d + t) * e;
  s.v = (s.v - omega * t) * e;
  return s.x;
}

export type AnimState = {
  t: number; act: PetAct | null; actT: number;
  sit: Spring; amp: Spring; trot: Spring; stride: Spring; look: Spring; tilt: Spring; nod: Spring; tailUp: Spring; wagAmp: Spring;
  phase: number; freq: number; wag: number; breath: number;
  tiltDir: number; nextTilt: number; nextGlance: number; glance: number; glanceUntil: number;
  frame: Frame;
};

export const newAnim = (): AnimState => ({
  t: 0, act: null, actT: 0,
  sit: sp(), amp: sp(), trot: sp(), stride: sp(), look: sp(), tilt: sp(), nod: sp(), tailUp: sp(), wagAmp: sp(0.15),
  phase: 0, freq: 1.6, wag: 0, breath: 0,
  tiltDir: 1, nextTilt: 5, nextGlance: 3, glance: 0, glanceUntil: 0,
  frame: restFrame(),
});

const ACT_LEN: Record<PetAct, number> = { sit: 3.4, hop: 1.1, wag: 1.8, tilt: 1.5 };

export function triggerAct(s: AnimState, act: PetAct) {
  s.act = act;
  s.actT = 0;
  if (act === "tilt") s.tiltDir = Math.random() < 0.5 ? -1 : 1;
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

export type AnimInput = {
  /** 移動速度，單位是「身高／秒」（公尺／秒 ÷ 身高） */
  speed: number;
  /** 你（鏡頭）在牠的哪個方向：0 = 正前方，正值 = 牠的左手邊 */
  look: number;
  /** 模型的頭原本朝的方向（Skel.headYaw） */
  restLook: number;
  /** 正在原地轉身（腳要跟著踏步） */
  turning?: boolean;
};

export function stepAnim(s: AnimState, dt: number, o: AnimInput): Frame {
  s.t += dt;
  const moving = o.speed > 0.05;
  if (s.act) {
    s.actT += dt;
    if ((moving && s.act === "sit") || s.actT > ACT_LEN[s.act]) s.act = null;
  }
  const act = s.act;
  const f = s.frame;

  // 步伐：走路四隻腳輪流，快了變成對角線小跑；步長＝速度 × 腳踩地的時間，腳才不會滑
  const trot = spring(s.trot, o.speed > 1.5 ? 1 : 0, 6, dt);
  const beta = 0.62 - 0.12 * trot;
  if (moving) {
    s.freq = Math.min(3.4, (1.0 + 0.6 * o.speed) * (1 - trot) + (2.3 + 0.3 * o.speed) * trot);
    spring(s.stride, Math.min(0.42, (o.speed * beta) / s.freq), 14, dt);
  } else {
    spring(s.stride, 0, 8, dt);
    if (o.turning) s.freq = 2.2;
  }
  const amp = spring(s.amp, moving ? 1 : o.turning ? 0.5 : 0, moving ? 12 : 9, dt);
  if (amp > 0.03) s.phase += s.freq * dt;

  // 坐下
  const sit = spring(s.sit, act === "sit" ? 1 : 0, act === "sit" ? 5.5 : 7, dt);

  // 頭：偶爾自己左右張望、歪頭
  if (!moving && !act && s.t > s.nextGlance) {
    s.glance = (Math.random() - 0.5) * 0.9;
    s.glanceUntil = s.t + 1.2 + Math.random();
    s.nextGlance = s.glanceUntil + 3 + Math.random() * 4;
  }
  const glance = s.t < s.glanceUntil && !moving ? s.glance : 0;
  // 頭一直看著你（走路時也是）；你在牠正後方時轉不過去，就看前面。頭最多左右各轉約 85 度
  const toYou = Math.abs(wrap(o.look)) < 2.1 ? clamp(wrap(o.look), -1.5, 1.5) : 0;
  const want = clamp(toYou + glance, -1.5, 1.5);
  f.look = spring(s.look, clamp(want - o.restLook, -1.7, 1.7), moving ? 6 : 4.5, dt);
  if (!moving && !act && s.t > s.nextTilt) {
    triggerAct(s, "tilt");
    s.nextTilt = s.t + 6 + Math.random() * 6;
  }
  const tilting = s.act === "tilt" ? Math.sin(Math.min(1, s.actT / ACT_LEN.tilt) * Math.PI) : 0;
  f.tilt = spring(s.tilt, tilting * 0.42 * s.tiltDir, 9, dt);
  f.nod = spring(s.nod, act === "sit" ? -0.12 : moving ? 0.06 : 0, 5, dt) + amp * 0.03 * Math.sin(s.phase * Math.PI * 4);

  // 尾巴：平常慢慢搖，開心時翹起來快速搖
  const happy = act === "wag" || act === "hop";
  const run = trot > 0.5;
  f.wagAmp = spring(s.wagAmp, happy ? 0.5 : run ? 0.22 : 0.14, 6, dt);
  s.wag += dt * (happy ? 14 : run ? 8 : 3);
  f.tailUp = spring(s.tailUp, happy ? 0.6 : run ? 0.45 : 0.05, 5, dt);
  f.wag = s.wag;

  // 跳兩下：先蹲、再跳
  let lift = 0, crouch = 0;
  if (act === "hop" && s.actT < 1.0) {
    const k = s.actT % 0.5;
    if (k < 0.12) crouch = 0.045 * Math.sin((Math.PI * k) / 0.12);
    else lift = 0.13 * Math.sin((Math.PI * (k - 0.12)) / 0.38);
  }
  f.lift = lift;
  f.crouch = crouch;

  s.breath += dt * (run ? 8 : moving ? 5 : 2.2);
  f.breath = s.breath;
  f.sit = sit;
  f.amp = amp;
  f.trot = trot;
  f.stride = s.stride.x;
  f.phase = s.phase;
  return f;
}
