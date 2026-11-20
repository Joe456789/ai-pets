"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { clampDistance, deviceQuaternion, faceYaw, floorHit, fovDeg, stepBall, stepToward, type Ball } from "@/lib/arMath";
import { loadPetModel, type PetModel } from "@/lib/petModel";
import { newAnim, stepAnim, triggerAct, type PetAct } from "@/lib/petAnim";

export type WorldEvent = "tap" | "ball" | "treat" | "come";
export type ArWorldHandle = { throwBall: () => void; treat: () => void; callOver: () => void; snapshot: () => HTMLCanvasElement | null };

/** 動物的畫面來源：AI 動態影片（綠幕去背後的畫布）或去背照片。frame 是動物在畫面中的位置比例。 */
export type WorldSource =
  | { kind: "canvas"; get: () => HTMLCanvasElement | null; aspect: number; animalHeight: number; foot: number }
  | { kind: "image"; url: string; aspect: number }
  /** AI 由照片做成的 3D 模型（GLB）：會走、跑、坐、搖尾巴，可以繞著看 */
  | { kind: "model"; url: string };

type Props = {
  name: string;
  heightM: number;
  scale: number;
  flip: boolean;
  phoneM: number;
  focal: (w: number, h: number) => number;
  source: WorldSource;
  bubble: string | null;
  onEvent: (e: WorldEvent) => void;
  onNoSensor: () => void;
  /** 3D 模型載入失敗（改用影片或照片） */
  onModelFail?: () => void;
  /** 沒有方向感測器：鏡頭固定往前稍微朝下看 */
  fixed?: boolean;
};

/** 沒有方向感測器時，鏡頭固定往下看的角度（弧度） */
const FIXED_PITCH = 0.3;

type Thrown = Ball & { kind: "ball" | "treat"; mesh: THREE.Mesh; shadow: THREE.Mesh; t: number; rest: number; chased: boolean; held: boolean };

function blobTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, "rgba(0,0,0,0.42)");
  r.addColorStop(0.55, "rgba(0,0,0,0.2)");
  r.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/**
 * 相機模式的 3D 場景：動物站在虛擬地板上，手機怎麼轉（包括轉成橫的）都留在原地。
 * 可以拖曳到別的地方、點地板叫牠走過去、往上滑丟球、餵零食。
 * 動物本身是 AI 動態影片，永遠面向手機（網頁讀不到你繞著牠走，所以看不到側面）。
 */
export const ArWorld = forwardRef<ArWorldHandle, Props>(function ArWorld(props, ref) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const bubbleEl = useRef<HTMLDivElement>(null);
  const arrowEl = useRef<HTMLDivElement>(null);
  const fx = useRef<HTMLDivElement>(null);
  const p = useRef(props);
  p.current = props;
  const api = useRef<ArWorldHandle>({ throwBall: () => undefined, treat: () => undefined, callOver: () => undefined, snapshot: () => null });
  useImperativeHandle(ref, () => ({
    throwBall: () => api.current.throwBall(),
    treat: () => api.current.treat(),
    callOver: () => api.current.callOver(),
    snapshot: () => api.current.snapshot(),
  }), []);

  useEffect(() => {
    const el = canvas.current!;
    const box = host.current!;
    const renderer = new THREE.WebGLRenderer({ canvas: el, alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(60, 1, 0.05, 50);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a66, 2.4));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(1, 3, 1);
    scene.add(sun);
    const blob = blobTexture();

    // 動物：一張永遠面向手機的平面，底部在地板上
    const petGroup = new THREE.Group();
    const petGeo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    const petMat = new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false, premultipliedAlpha: true, visible: false });
    const petMesh = new THREE.Mesh(petGeo, petMat);
    petMesh.renderOrder = 2;
    petGroup.add(petMesh);
    const petShadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false }));
    petShadow.position.y = 0.002;
    petShadow.renderOrder = 1;
    petGroup.add(petShadow);
    petGroup.visible = false;
    scene.add(petGroup);

    // 3D 模型
    let disposed = false;
    let model: PetModel | null = null;
    const anim = newAnim();
    let yaw = 0;
    let yawSet = false;
    let turning = false;
    const act = (a: PetAct) => triggerAct(anim, a);
    if (p.current.source.kind === "model") {
      loadPetModel(p.current.source.url).then((m) => {
        if (disposed) return m.dispose();
        model = m;
        petGroup.add(m.mesh);
      }).catch(() => p.current.onModelFail?.());
    }

    let tex: THREE.Texture | null = null;
    let texSrc: HTMLCanvasElement | null = null;
    const src0 = p.current.source;
    if (src0.kind === "image") {
      new THREE.TextureLoader().load(src0.url, (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.premultiplyAlpha = true;
        tex = t;
        petMat.map = t;
        petMat.visible = true;
        petMat.needsUpdate = true;
      });
    }

    // 方向感測器
    const target = new THREE.Quaternion();
    let gotOrient = false;
    const screenAngle = () => (screen.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0);
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.beta === null || e.gamma === null) return;
      deviceQuaternion(e.alpha ?? 0, e.beta, e.gamma, screenAngle(), target);
      if (!gotOrient) cam.quaternion.copy(target);
      gotOrient = true;
    };
    const fixed = Boolean(p.current.fixed);
    if (fixed) {
      target.setFromEuler(new THREE.Euler(-FIXED_PITCH, 0, 0, "YXZ"));
      cam.quaternion.copy(target);
      gotOrient = true;
    } else window.addEventListener("deviceorientation", onOrient);
    const noSensor = setTimeout(() => { if (!gotOrient) p.current.onNoSensor(); }, 2500);

    // 狀態
    const pet = new THREE.Vector3();
    let placed = false;
    let walkTo: THREE.Vector3 | null = null;
    let walkSpeed = 1.4;
    let onArrive: (() => void) | null = null;
    let walkPhase = 0;
    let wanderAt = performance.now() + 8000;
    let thrown: Thrown | null = null;
    let w = 0;
    let h = 0;

    const camFlat = () => {
      const f = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
      f.y = 0;
      if (f.lengthSq() < 1e-4) f.set(0, 0, -1);
      return f.normalize();
    };
    const camXZ = () => ({ x: cam.position.x, z: cam.position.z });
    const ray = (nx: number, ny: number) => {
      const r = new THREE.Raycaster();
      r.setFromCamera(new THREE.Vector2(nx, ny), cam);
      return r.ray;
    };
    const ndc = (cx: number, cy: number) => {
      const r = el.getBoundingClientRect();
      return { x: ((cx - r.left) / r.width) * 2 - 1, y: -((cy - r.top) / r.height) * 2 + 1 };
    };
    const petSize = () => {
      const s = p.current.source;
      const H = p.current.heightM * p.current.scale;
      if (s.kind === "model") {
        const L = model?.rig.length ?? 1.2;
        return { H, frameH: H, frameW: H * L, drop: 0, bodyW: H * L };
      }
      if (s.kind === "image") return { H, frameH: H, frameW: H * s.aspect, drop: 0, bodyW: H * s.aspect };
      const frameH = H / s.animalHeight;
      return { H, frameH, frameW: frameH * s.aspect, drop: frameH * (1 - s.foot), bodyW: H * 1.15 };
    };
    /**
     * 鏡頭固定時（沒有方向感測器）不能轉手機去找牠，所以地板上的點一律限制在看得到的範圍內。
     * body：要留多少身體寬度的邊（公尺）；nearOk：不限制最近距離（剛丟出去的球）。
     */
    const keepInView = (v: THREE.Vector3, body = 0, nearOk = false) => {
      if (!fixed) return v;
      const H = cam.position.y || p.current.phoneM;
      const t = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
      const sin = Math.sin(FIXED_PITCH), cos = Math.cos(FIXED_PITCH);
      // 腳要在畫面下緣上方一點
      const near = (H * (cos - 0.72 * t * sin)) / (sin + 0.72 * t * cos);
      let d = Math.min(3.2, -v.z);
      if (!nearOk) d = Math.max(near, d);
      const depth = H * sin + d * cos;
      const maxX = Math.max(0, depth * t * cam.aspect * 0.9 - body);
      v.set(Math.max(-maxX, Math.min(maxX, v.x)), v.y, -d);
      return v;
    };
    const home = new THREE.Vector3(); // 自己亂走時不會離這裡太遠
    const walk = (to: THREE.Vector3, speed: number, then: (() => void) | null, wander = false) => {
      walkTo = keepInView(clampDistance(to.clone(), camXZ(), 0.6, 8), petSize().bodyW * 0.55);
      walkSpeed = speed;
      onArrive = then;
      if (!wander) home.copy(walkTo);
    };
    const heart = (text = "❤") => {
      const v = pet.clone();
      v.y = petSize().H * 1.05;
      v.project(cam);
      if (v.z > 1 || !fx.current) return;
      const s = document.createElement("span");
      s.className = "ar3d-heart";
      s.textContent = text;
      s.style.left = `${((v.x + 1) / 2) * w + (Math.random() - 0.5) * 40}px`;
      s.style.top = `${((1 - v.y) / 2) * h}px`;
      fx.current.appendChild(s);
      setTimeout(() => s.remove(), 1300);
    };

    const removeThrown = () => {
      if (!thrown) return;
      scene.remove(thrown.mesh, thrown.shadow);
      thrown.mesh.geometry.dispose();
      thrown = null;
    };
    const launch = (kind: "ball" | "treat", speedH: number, speedV: number, side = 0) => {
      if (!placed) return;
      removeThrown();
      const r = kind === "ball" ? 0.034 : 0.02;
      const geo = kind === "ball" ? new THREE.SphereGeometry(r, 24, 16) : new THREE.CapsuleGeometry(0.014, 0.05, 4, 8).rotateZ(Math.PI / 2);
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: kind === "ball" ? 0xd4e53c : 0xb8763e, roughness: 0.65 }));
      const shadow = new THREE.Mesh(new THREE.PlaneGeometry(r * 3, r * 3).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false }));
      const start = new THREE.Vector3(0.04, -0.12, -0.25).applyQuaternion(cam.quaternion).add(cam.position);
      start.y = Math.max(start.y, 0.3);
      const dir = camFlat().applyAxisAngle(new THREE.Vector3(0, 1, 0), -side);
      thrown = { kind, mesh, shadow, p: start, v: dir.multiplyScalar(speedH).setY(speedV), r, t: 0, rest: 0, chased: false, held: false };
      mesh.position.copy(start);
      scene.add(mesh, shadow);
      walkTo = null;
    };
    const fetchIt = () => {
      if (!thrown) return;
      const it = thrown;
      it.chased = true;
      const stop = it.p.clone().setY(0);
      walk(stop, 1.8, () => {
        if (it.kind === "treat") {
          removeThrown();
          act("sit");
          heart();
          p.current.onEvent("treat");
          return;
        }
        it.held = true;
        // 叼著球回到你面前
        const back = camFlat().multiplyScalar(model ? 1.7 : 1.4).add(new THREE.Vector3(cam.position.x, 0, cam.position.z));
        walk(back, 1.5, () => {
          it.held = false;
          it.p.copy(pet).addScaledVector(camFlat(), -0.12).setY(it.r);
          it.v.set(0, 0, 0);
          heart();
          setTimeout(heart, 220);
          act("wag");
          p.current.onEvent("ball");
          setTimeout(() => { if (thrown === it) removeThrown(); }, 2500);
        });
      });
    };

    api.current = {
      throwBall: () => launch("ball", 2.2, 2.0),
      treat: () => launch("treat", 1.3, 1.6),
      callOver: () => {
        if (!placed) return;
        walk(camFlat().multiplyScalar(model ? 1.5 : 1.2).add(new THREE.Vector3(cam.position.x, 0, cam.position.z)), 1.3, () => { heart(); act("tilt"); p.current.onEvent("come"); });
      },
      snapshot: () => el,
    };

    // 觸控：點動物＝互動、拖動物＝換位置、點地板＝叫牠過去、往上滑＝丟球
    type Press = { id: number; x: number; y: number; t: number; onPet: boolean; moved: boolean; lastX: number; spin: boolean };
    let spinHold = 0;
    let press: Press | null = null;
    const hitPet = (cx: number, cy: number) => {
      if (!petGroup.visible) return false;
      const n = ndc(cx, cy);
      const r = new THREE.Raycaster();
      r.setFromCamera(new THREE.Vector2(n.x, n.y), cam);
      if (p.current.source.kind === "model") {
        if (!model) return false;
        // 模型會動，用稍微放大的範圍判斷比較好點到
        const box = new THREE.Box3().setFromObject(model.mesh).expandByScalar(0.04);
        return r.ray.intersectsBox(box);
      }
      const hit = r.intersectObject(petMesh)[0];
      if (!hit?.uv) return false;
      if (p.current.source.kind === "image") return true;
      const s = p.current.source;
      const halfW = (s.animalHeight * 0.9) / s.aspect; // 動物身體大約占畫面中間這一段
      return Math.abs(hit.uv.x - 0.5) < Math.max(0.18, halfW) && hit.uv.y > 1 - s.foot - 0.02 && hit.uv.y < 1 - s.foot + s.animalHeight;
    };
    const down = (e: PointerEvent) => {
      if (press) return;
      try { el.setPointerCapture(e.pointerId); } catch { /* 部分瀏覽器不支援，拖曳仍可運作 */ }
      press = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), onPet: hitPet(e.clientX, e.clientY), moved: false, lastX: e.clientX, spin: false };
    };
    const move = (e: PointerEvent) => {
      if (!press || e.pointerId !== press.id) return;
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) press.moved = true;
      // 在地板上左右滑：轉動動物（3D 模型才有意義）
      if (!press.onPet && press.moved && model && (press.spin || Math.abs(e.clientX - press.x) > Math.abs(e.clientY - press.y) * 1.5)) {
        press.spin = true;
        yaw += (e.clientX - press.lastX) * 0.012;
        spinHold = performance.now() + 5000;
      }
      press.lastX = e.clientX;
      if (press.onPet && press.moved) {
        const n = ndc(e.clientX, e.clientY);
        const r = ray(n.x, n.y);
        const f = floorHit(r.origin, r.direction);
        if (f) { pet.copy(keepInView(clampDistance(f, camXZ(), 0.5, 8), petSize().bodyW * 0.55)); home.copy(pet); walkTo = null; wanderAt = performance.now() + 9000; }
      }
    };
    const up = (e: PointerEvent) => {
      if (!press || e.pointerId !== press.id) return;
      const pr = press;
      press = null;
      const dt = performance.now() - pr.t;
      const dy = pr.y - e.clientY;
      const dx = e.clientX - pr.x;
      if (pr.onPet) {
        if (!pr.moved && dt < 400) { heart(); act("hop"); p.current.onEvent("tap"); }
        return;
      }
      if (pr.spin) return;
      if (dy > 40 && dt < 800) {
        // 滑得越快丟越遠，往左右滑會偏一點
        const speed = Math.min(3, Math.max(1.2, (dy / dt) * 1.6));
        launch("ball", speed, 1.2 + speed * 0.3, Math.atan2(dx, dy) * 0.6);
        return;
      }
      if (!pr.moved && dt < 400) {
        const n = ndc(e.clientX, e.clientY);
        const r = ray(n.x, n.y);
        const f = floorHit(r.origin, r.direction);
        if (f) walk(f, 1.1, null);
      }
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);

    const resize = () => {
      const r = box.getBoundingClientRect();
      w = r.width;
      h = r.height;
      renderer.setSize(w, h, false);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(box);

    let raf = 0;
    let last = performance.now();
    let lastFov = 0;
    const tick = (now: number) => {
      if (disposed) return; // 元件已卸載：不要再畫（兩個場景搶同一塊畫布會讓動物閃爍或消失）
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!w || !h) return;
      const props = p.current;
      cam.position.set(0, props.phoneM, 0);
      cam.quaternion.slerp(target, 0.35);
      const fov = fovDeg(h, props.focal(w, h));
      if (Math.abs(fov - lastFov) > 0.01 || cam.aspect !== w / h) { cam.fov = fov; cam.aspect = w / h; cam.updateProjectionMatrix(); lastFov = fov; }
      cam.updateMatrixWorld();

      // 第一次放：畫面中下方對到的地板
      if (!placed && gotOrient) {
        const r = ray(0, -0.55);
        const f = floorHit(r.origin, r.direction);
        pet.copy(keepInView(f ? clampDistance(f, camXZ(), 0.9, 3.5) : camFlat().multiplyScalar(1.8), petSize().bodyW * 0.55));
        home.copy(pet);
        placed = true;
      }

      // 動態影片的畫面每一格更新
      const s = props.source;
      if (s.kind === "canvas") {
        const c = s.get();
        if (c && c !== texSrc) {
          tex?.dispose();
          const t = new THREE.CanvasTexture(c);
          t.colorSpace = THREE.SRGBColorSpace;
          t.premultiplyAlpha = true;
          tex = t;
          texSrc = c;
          petMat.map = t;
          petMat.visible = true;
          petMat.needsUpdate = true;
        }
        if (tex) tex.needsUpdate = true;
      }

      // 丟出去的東西
      if (thrown && !thrown.held) {
        const stopped = stepBall(thrown, dt);
        // 室內丟球：超過 5 公尺就當作撞到牆停下來
        if (Math.hypot(thrown.p.x - cam.position.x, thrown.p.z - cam.position.z) > 5) { thrown.v.x = 0; thrown.v.z = 0; }
        if (fixed) {
          // 鏡頭固定：球滾到畫面邊緣就停下來
          const k = keepInView(thrown.p.clone(), 0.05, true);
          if (Math.abs(k.x - thrown.p.x) > 1e-3 || Math.abs(k.z - thrown.p.z) > 1e-3) { thrown.p.x = k.x; thrown.p.z = k.z; thrown.v.x = 0; thrown.v.z = 0; }
        }
        thrown.t += dt;
        thrown.rest = stopped ? thrown.rest + dt : 0;
        if (!thrown.chased && (thrown.rest > 0.25 || (thrown.t > 3 && thrown.p.y <= thrown.r + 0.01))) fetchIt();
      }

      // 走路
      let bob = 0;
      if (walkTo && !(press?.onPet && press.moved)) {
        const arrived = stepToward(pet, walkTo, walkSpeed * dt);
        walkPhase += dt * walkSpeed * 9;
        bob = Math.abs(Math.sin(walkPhase)) * 0.05 * petSize().H;
        if (arrived) {
          walkTo = null;
          const cb = onArrive;
          onArrive = null;
          cb?.();
        }
      } else if (placed && !thrown && !press && now > wanderAt) {
        // 偶爾自己走兩步，看起來比較像活的
        // 3D 模型：主要左右走（從側面看最像照片），不朝著鏡頭走
        const f = camFlat();
        const side = new THREE.Vector3(-f.z, 0, f.x).multiplyScalar((Math.random() < 0.5 ? -1 : 1) * (0.2 + Math.random() * 0.3));
        const a = Math.random() * Math.PI * 2;
        const r = 0.15 + Math.random() * 0.3;
        const step = model ? side.addScaledVector(f, (Math.random() - 0.5) * 0.15) : new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
        walk(home.clone().add(step), 0.45, null, true);
        wanderAt = now + 7000 + Math.random() * 7000;
      }

      if (thrown) {
        if (thrown.held && model) {
          model.mouth(thrown.p); // 叼在嘴邊
        } else if (thrown.held) thrown.p.copy(pet).addScaledVector(camFlat(), -0.06).setY(petSize().H * 0.5 + bob);
        thrown.mesh.position.copy(thrown.p);
        if (thrown.kind === "ball") thrown.mesh.rotation.x += Math.hypot(thrown.v.x, thrown.v.z) * dt * 20;
        thrown.shadow.position.set(thrown.p.x, 0.003, thrown.p.z);
      }

      // 動物
      const sz = petSize();
      petGroup.visible = placed;
      petGroup.position.copy(pet);
      if (model) {
        // 3D：走路時朝前進方向；停下來時用照片拍到的那一面（側面）對著你，最像原本的照片
        const moving = Boolean(walkTo) && !(press?.onPet && press.moved);
        const toCam = Math.atan2(-(cam.position.z - pet.z), cam.position.x - pet.x);
        let want = toCam + Math.PI / 2 - 0.3;
        if (moving && walkTo) want = Math.atan2(-(walkTo.z - pet.z), walkTo.x - pet.x);
        if (!yawSet) { yaw = want; yawSet = true; }
        let d = Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw));
        // 站著時：偏差大才開始轉身，一轉就轉到位（側面對著你）；剛被你轉過就先不轉回來
        if (moving) turning = false;
        else if (now < spinHold || press?.spin) { turning = false; d = 0; }
        else {
          if (Math.abs(d) > 0.5) turning = true;
          if (Math.abs(d) < 0.04) turning = false;
          if (!turning) d = 0;
        }
        yaw += d * Math.min(1, dt * (moving ? 8 : 3));
        const look = Math.atan2(Math.sin(toCam - yaw), Math.cos(toCam - yaw));
        // 走路時頭看前方，停下來頭會轉向你；原地轉身時腳會跟著踏步
        model.update(stepAnim(anim, dt, { speed: (moving ? walkSpeed : 0) / sz.H, look, restLook: model.skel.headYaw, turning }));
        model.mesh.scale.setScalar(sz.H);
        model.mesh.rotation.y = yaw;
        model.mesh.position.y = 0;
        petMesh.visible = false;
        petGroup.rotation.y = 0;
        petShadow.rotation.y = yaw;
        petShadow.scale.set(sz.bodyW * 0.85, 1, sz.H * 0.45);
      } else {
        petGroup.rotation.y = faceYaw(pet, cam.position);
        petMesh.scale.set(sz.frameW * (props.flip ? -1 : 1), sz.frameH, 1);
        petMesh.position.y = -sz.drop + bob;
        petShadow.scale.set(sz.bodyW * 0.9, 1, sz.H * 0.5);
      }
      renderer.render(scene, cam);

      // 對話框跟著頭頂；看不到動物時，畫面邊緣出現箭頭指出牠在哪
      const head = pet.clone().setY(sz.H + 0.04).project(cam);
      const center = pet.clone().setY(sz.H / 2);
      const inView = placed && head.z < 1 && Math.abs(center.clone().project(cam).x) < 1.05 && Math.abs(center.clone().project(cam).y) < 1.1;
      if (bubbleEl.current) {
        bubbleEl.current.style.display = inView && props.bubble ? "block" : "none";
        bubbleEl.current.style.left = `${Math.max(60, Math.min(w - 60, ((head.x + 1) / 2) * w))}px`;
        bubbleEl.current.style.top = `${Math.max(56, ((1 - head.y) / 2) * h)}px`;
      }
      if (arrowEl.current) {
        arrowEl.current.style.display = placed && !inView ? "flex" : "none";
        if (placed && !inView) {
          const v = center.applyMatrix4(cam.matrixWorldInverse);
          const ang = Math.atan2(-v.y, v.x); // 螢幕座標：右為 x、下為 y
          const R = Math.min(w, h) / 2 - 46;
          arrowEl.current.style.left = `${w / 2 + Math.cos(ang) * R}px`;
          arrowEl.current.style.top = `${h / 2 + Math.sin(ang) * R}px`;
          arrowEl.current.style.setProperty("--ang", `${ang}rad`);
        }
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      model?.dispose();
      cancelAnimationFrame(raf);
      clearTimeout(noSensor);
      if (!fixed) window.removeEventListener("deviceorientation", onOrient);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      ro.disconnect();
      removeThrown();
      tex?.dispose();
      blob.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div ref={host} className="ar3d">
      <canvas ref={canvas} className="ar3d-canvas" />
      <div ref={fx} className="ar3d-fx" />
      <div ref={bubbleEl} className="ar-bubble ar3d-bubble">{props.bubble}</div>
      <div ref={arrowEl} className="ar3d-arrow"><span className="ar3d-arrow-icon">➜</span><span>{props.name}在這邊</span></div>
    </div>
  );
});
