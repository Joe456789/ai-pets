"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { clampDistance, deviceQuaternion, floorHit, focalPx, fovDeg, stepBall, stepToward, type Ball } from "@/lib/arMath";
import { jumpTravel, newAnim, stepAnim, triggerAct, type PetAct } from "@/lib/petAnim";
import { loadPetModel, type PetModel } from "@/lib/petModel";
import { temperOf } from "@/lib/personality";
import type { Trait } from "@/lib/types";

/** 沒有方向感測器時，鏡頭固定往下看的角度（弧度）。 */
const FIXED_PITCH = 0.32;
/** 三種速度（身高／秒）：走路、小跑、奔跑。 */
const PACE = { walk: 0.9, trot: 2.2, run: 4.6 } as const;
type Pace = keyof typeof PACE;

type Cmd = "come" | "ball" | "jump" | "sit";
type Thrown = Ball & { mesh: THREE.Mesh; shadow: THREE.Mesh; t: number; rest: number; chased: boolean; held: boolean };

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
 * 在 LINE 裡打開鏡頭，讓 3D 的牠出現在你身邊：站在地板上、會走會跑會跳，點地板叫牠過去、丟球給牠撿。
 * 用手機的方向感測器轉動虛擬鏡頭，所以手機轉開再轉回來，牠還在原地。沒有感測器時鏡頭固定，牠留在畫面裡。
 * 網頁讀不到你在房間裡走動，只讀得到手機轉動；距離是用手機高度推算的，會有誤差。
 */
export function PetCamera({ url, name, heightCm, traits, backHref }: { url: string; name: string; heightCm: number; traits: Trait[]; backHref: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const fx = useRef<HTMLDivElement>(null);
  const arrow = useRef<HTMLDivElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const cmd = useRef<(c: Cmd) => void>(() => undefined);
  const [phase, setPhase] = useState<"intro" | "starting" | "on">("intro");
  const [cameraOk, setCameraOk] = useState(true);
  const [gyro, setGyro] = useState<boolean | null>(null);
  const [sitting, setSitting] = useState(false);
  const [loaded, setLoaded] = useState<"loading" | "ready" | "error">("loading");
  const phoneM = sitting ? 0.75 : 1.25;
  const phoneRef = useRef(phoneM);
  phoneRef.current = phoneM;

  useEffect(() => () => stream.current?.getTracks().forEach((t) => t.stop()), []);

  const start = async () => {
    setPhase("starting");
    // iPhone 要在按下按鈕的當下詢問「動作與方向」權限
    const DOE = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
    const askGyro: Promise<boolean> = typeof DOE?.requestPermission === "function"
      ? DOE.requestPermission().then((r) => r === "granted").catch(() => false)
      : Promise.resolve(Boolean(DOE));
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("no camera");
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      stream.current = s;
      if (video.current) { video.current.srcObject = s; await video.current.play().catch(() => undefined); }
    } catch {
      setCameraOk(false);
    }
    setGyro(await askGyro);
    setPhase("on");
  };

  useEffect(() => {
    if (phase !== "on" || gyro === null) return;
    const el = canvas.current!;
    const box = el.parentElement!;
    const renderer = new THREE.WebGLRenderer({ canvas: el, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a66, 2.4));
    const cam = new THREE.PerspectiveCamera(60, 1, 0.05, 50);
    const blob = blobTexture();
    const temper = temperOf(traits);
    const H = heightCm / 100;

    const group = new THREE.Group();
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false }));
    shadow.position.y = 0.002;
    group.add(shadow);
    group.visible = false;
    scene.add(group);

    let disposed = false;
    let model: PetModel | null = null;
    const anim = newAnim();
    loadPetModel(url).then((m) => {
      if (disposed) return m.dispose();
      model = m;
      m.mesh.scale.setScalar(H);
      group.add(m.mesh);
      setLoaded("ready");
    }).catch(() => { if (!disposed) setLoaded("error"); });

    // 方向感測器
    const fixed = !gyro;
    const target = new THREE.Quaternion();
    let gotOrient = fixed;
    if (fixed) target.setFromEuler(new THREE.Euler(-FIXED_PITCH, 0, 0, "YXZ"));
    const screenAngle = () => (screen.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0);
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.beta === null || e.gamma === null) return;
      deviceQuaternion(e.alpha ?? 0, e.beta, e.gamma, screenAngle(), target);
      if (!gotOrient) cam.quaternion.copy(target);
      gotOrient = true;
    };
    if (!fixed) window.addEventListener("deviceorientation", onOrient);
    cam.quaternion.copy(target);
    // 有權限但一直沒有資料（電腦、部分手機）：改成鏡頭固定
    let fixedNow = fixed;
    const noSensor = setTimeout(() => {
      if (gotOrient) return;
      fixedNow = true;
      target.setFromEuler(new THREE.Euler(-FIXED_PITCH, 0, 0, "YXZ"));
      cam.quaternion.copy(target);
      gotOrient = true;
    }, 2500);

    // 狀態
    const pet = new THREE.Vector3();
    let placed = false;
    let yaw = 0, yawSet = false, turning = false;
    let walkTo: THREE.Vector3 | null = null;
    let pace: Pace = "walk";
    let onArrive: (() => void) | null = null;
    let route: THREE.Vector3[] = [];
    let thrown: Thrown | null = null;
    let nextIdle = performance.now() + 6000;
    let w = 0, h = 0;

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
    const bodyW = () => H * (model?.rig.length ?? 1.2);
    /** 鏡頭固定時不能轉手機找牠，地板上的點一律限制在看得到的範圍內。 */
    const keepInView = (v: THREE.Vector3, body = 0) => {
      if (!fixedNow) return v;
      const ch = cam.position.y;
      const t = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
      const sin = Math.sin(FIXED_PITCH), cos = Math.cos(FIXED_PITCH);
      const near = (ch * (cos - 0.72 * t * sin)) / (sin + 0.72 * t * cos);
      const d = Math.max(near, Math.min(3.2, -v.z));
      const depth = ch * sin + d * cos;
      const maxX = Math.max(0, depth * t * cam.aspect * 0.85 - body);
      v.set(Math.max(-maxX, Math.min(maxX, v.x)), 0, -d);
      return v;
    };
    const inFront = (dist: number) => camFlat().multiplyScalar(dist).add(new THREE.Vector3(cam.position.x, 0, cam.position.z));
    /** 依距離決定走、小跑或奔跑；活潑的毛孩比較常用跑的。 */
    const paceFor = (to: THREE.Vector3): Pace => {
      const d = Math.hypot(to.x - pet.x, to.z - pet.z) / H;
      const boost = temper.energy > 0.6 ? 1.6 : temper.energy < 0.3 ? 0.7 : 1;
      if (d * boost > 7) return "run";
      if (d * boost > 3) return "trot";
      return "walk";
    };
    const go = (to: THREE.Vector3, p: Pace | null, then: (() => void) | null = null) => {
      walkTo = keepInView(clampDistance(to.clone(), camXZ(), 0.6, 7), bodyW() * 0.55);
      pace = p ?? paceFor(walkTo);
      onArrive = then;
    };
    const act = (a: PetAct) => triggerAct(anim, a);
    const heart = () => {
      if (!fx.current) return;
      const v = pet.clone().setY(H * 1.05).project(cam);
      if (v.z > 1) return;
      const s = document.createElement("span");
      s.className = "ar3d-heart";
      s.textContent = "❤";
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
    const throwBall = (speedH = 2.4, speedV = 2.0, side = 0) => {
      if (!placed) return;
      removeThrown();
      const r = Math.max(0.025, H * 0.07);
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), new THREE.MeshStandardMaterial({ color: 0xd4e53c, roughness: 0.65 }));
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(r * 3, r * 3).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false }));
      const startP = new THREE.Vector3(0.04, -0.12, -0.25).applyQuaternion(cam.quaternion).add(cam.position);
      startP.y = Math.max(startP.y, 0.3);
      const dir = camFlat().applyAxisAngle(new THREE.Vector3(0, 1, 0), -side);
      thrown = { mesh, shadow: sh, p: startP, v: dir.multiplyScalar(speedH).setY(speedV), r, t: 0, rest: 0, chased: false, held: false };
      mesh.position.copy(startP);
      scene.add(mesh, sh);
      walkTo = null;
      route = [];
    };
    const fetchBall = () => {
      if (!thrown) return;
      const it = thrown;
      it.chased = true;
      go(it.p.clone().setY(0), "run", () => {
        it.held = true;
        act("wag");
        go(inFront(Math.max(1.1, H * 3)), "trot", () => {
          it.held = false;
          it.p.copy(pet).addScaledVector(camFlat(), -H * 0.3).setY(it.r);
          it.v.set(0, 0, 0);
          heart();
          setTimeout(heart, 220);
          act("wag");
          setTimeout(() => { if (thrown === it) removeThrown(); }, 2500);
        });
      });
    };

    cmd.current = (c) => {
      if (!placed) return;
      nextIdle = performance.now() + 9000;
      route = [];
      if (c === "come") go(inFront(Math.max(1.0, H * 3)), null, () => { heart(); act(temper.affection > 0.55 ? "hop" : "wag"); });
      if (c === "ball") throwBall();
      if (c === "jump") { walkTo = null; act("jump"); }
      if (c === "sit") { walkTo = null; act("sit"); }
    };

    /** 沒人理牠的時候，依個性自己找事做。 */
    const idle = (now: number) => {
      const r = Math.random() * (temper.energy + temper.calm + temper.affection + 0.5);
      const side = new THREE.Vector3(-camFlat().z, 0, camFlat().x);
      if (r < temper.energy) {
        // 暴衝：繞兩三個點跑一圈再回來
        const home = pet.clone();
        const n = 2 + Math.floor(Math.random() * 2);
        route = Array.from({ length: n }, () => home.clone().addScaledVector(side, (Math.random() - 0.5) * 2.4).addScaledVector(camFlat(), (Math.random() - 0.3) * 1.6));
        route.push(home);
        if (Math.random() < temper.energy) act("jump");
      } else if (r < temper.energy + temper.calm) {
        act("sit");
      } else if (r < temper.energy + temper.calm + temper.affection) {
        go(inFront(Math.max(1.0, H * 3)), null, () => act("wag"));
      } else {
        go(pet.clone().addScaledVector(side, (Math.random() < 0.5 ? -1 : 1) * (0.3 + Math.random() * 0.4)), "walk");
      }
      nextIdle = now + (12000 - 7000 * temper.energy) * (0.7 + Math.random() * 0.6);
    };

    // 觸控：點牠＝摸摸、點地板＝叫牠過去、往上滑＝丟球
    let press: { id: number; x: number; y: number; t: number; onPet: boolean } | null = null;
    const hitPet = (cx: number, cy: number) => {
      if (!model || !group.visible) return false;
      const n = ndc(cx, cy);
      const r = new THREE.Raycaster();
      r.setFromCamera(new THREE.Vector2(n.x, n.y), cam);
      return r.ray.intersectsBox(new THREE.Box3().setFromObject(model.mesh).expandByScalar(H * 0.1));
    };
    const down = (e: PointerEvent) => { if (!press) press = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), onPet: hitPet(e.clientX, e.clientY) }; };
    const up = (e: PointerEvent) => {
      if (!press || e.pointerId !== press.id) return;
      const pr = press;
      press = null;
      const dt = performance.now() - pr.t, dy = pr.y - e.clientY, dx = e.clientX - pr.x;
      nextIdle = performance.now() + 9000;
      if (dy > 40 && dt < 800) {
        const sp = Math.min(3, Math.max(1.2, (dy / dt) * 1.6));
        throwBall(sp, 1.2 + sp * 0.3, Math.atan2(dx, dy) * 0.6);
        return;
      }
      if (Math.hypot(dx, dy) > 12 || dt > 500) return;
      if (pr.onPet) { heart(); act(Math.random() < 0.5 ? "hop" : "wag"); return; }
      const n = ndc(e.clientX, e.clientY);
      const r = ray(n.x, n.y);
      const f = floorHit(r.origin, r.direction);
      if (f) { route = []; go(f, null); }
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    const cancel = () => { press = null; };
    el.addEventListener("pointercancel", cancel);

    const resize = () => {
      const r = box.getBoundingClientRect();
      w = r.width; h = r.height;
      renderer.setSize(w, h, false);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(box);

    let raf = 0, last = performance.now(), lastFov = 0;
    const tick = (now: number) => {
      if (disposed) return;
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!w || !h) return;
      cam.position.set(0, phoneRef.current, 0);
      cam.quaternion.slerp(target, 0.35);
      const v = video.current;
      const fov = fovDeg(h, focalPx(w, h, v?.videoWidth ?? 0, v?.videoHeight ?? 0));
      if (Math.abs(fov - lastFov) > 0.01 || cam.aspect !== w / h) { cam.fov = fov; cam.aspect = w / h; cam.updateProjectionMatrix(); lastFov = fov; }
      cam.updateMatrixWorld();

      if (!placed && gotOrient && model) {
        const r = ray(0, -0.45);
        const f = floorHit(r.origin, r.direction);
        pet.copy(keepInView(f ? clampDistance(f, camXZ(), 0.9, 3) : inFront(1.6), bodyW() * 0.55));
        placed = true;
        nextIdle = now + 5000;
      }
      if (!placed || !model) { renderer.render(scene, cam); return; }

      // 球
      if (thrown && !thrown.held) {
        const stopped = stepBall(thrown, dt);
        if (Math.hypot(thrown.p.x - cam.position.x, thrown.p.z - cam.position.z) > 5) { thrown.v.x = 0; thrown.v.z = 0; }
        if (fixedNow) {
          const k = keepInView(thrown.p.clone().setY(0), 0.05);
          if (Math.abs(k.x - thrown.p.x) > 1e-3 || Math.abs(k.z - thrown.p.z) > 1e-3) { thrown.p.x = k.x; thrown.p.z = k.z; thrown.v.x = 0; thrown.v.z = 0; }
        }
        thrown.t += dt;
        thrown.rest = stopped ? thrown.rest + dt : 0;
        if (!thrown.chased && (thrown.rest > 0.25 || (thrown.t > 3 && thrown.p.y <= thrown.r + 0.01))) fetchBall();
      }

      // 跑一圈的路線
      if (!walkTo && route.length) go(route.shift()!, "run");
      // 移動
      const speedM = walkTo ? PACE[pace] * H : 0;
      if (walkTo) {
        if (stepToward(pet, walkTo, speedM * dt)) {
          walkTo = null;
          const cb = onArrive;
          onArrive = null;
          cb?.();
        }
      }
      // 往前跳：沿著牠面向的方向移動
      const jv = jumpTravel(anim) * H;
      if (jv > 0) {
        pet.x += Math.cos(yaw) * jv * dt;
        pet.z -= Math.sin(yaw) * jv * dt;
        keepInView(clampDistance(pet, camXZ(), 0.5, 7), bodyW() * 0.5);
      }
      if (!walkTo && !route.length && !thrown && !press && now > nextIdle) idle(now);

      if (thrown) {
        if (thrown.held) model.mouth(thrown.p);
        thrown.mesh.position.copy(thrown.p);
        thrown.mesh.rotation.x += Math.hypot(thrown.v.x, thrown.v.z) * dt * 20;
        thrown.shadow.position.set(thrown.p.x, 0.003, thrown.p.z);
      }

      // 方向：移動時朝前進方向；停下來時用照片拍到的側面對著你
      const moving = Boolean(walkTo);
      const toCam = Math.atan2(-(cam.position.z - pet.z), cam.position.x - pet.x);
      let want = toCam + Math.PI / 2 - 0.3;
      if (walkTo) want = Math.atan2(-(walkTo.z - pet.z), walkTo.x - pet.x);
      if (!yawSet) { yaw = want; yawSet = true; }
      let d = Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw));
      if (moving || jv > 0) turning = false;
      else {
        if (Math.abs(d) > 0.5) turning = true;
        if (Math.abs(d) < 0.04) turning = false;
        if (!turning) d = 0;
      }
      if (jv > 0) d = 0;
      yaw += d * Math.min(1, dt * (moving ? (pace === "run" ? 5 : 8) : 3));
      const look = Math.atan2(Math.sin(toCam - yaw), Math.cos(toCam - yaw));
      model.update(stepAnim(anim, dt, { speed: speedM / H, look, restLook: model.skel.headYaw, turning }));
      group.visible = true;
      group.position.copy(pet);
      model.mesh.rotation.y = yaw;
      shadow.rotation.y = yaw;
      shadow.scale.set(bodyW() * 0.85, 1, H * 0.45);
      renderer.render(scene, cam);

      // 看不到牠時，畫面邊緣出現箭頭指出牠在哪
      const center = pet.clone().setY(H / 2);
      const pc = center.clone().project(cam);
      const inView = pc.z < 1 && Math.abs(pc.x) < 1.05 && Math.abs(pc.y) < 1.1;
      if (arrow.current) {
        arrow.current.style.display = inView ? "none" : "flex";
        if (!inView) {
          const vv = center.applyMatrix4(cam.matrixWorldInverse);
          const ang = Math.atan2(-vv.y, vv.x);
          const R = Math.min(w, h) / 2 - 46;
          arrow.current.style.left = `${w / 2 + Math.cos(ang) * R}px`;
          arrow.current.style.top = `${h / 2 + Math.sin(ang) * R}px`;
          arrow.current.style.setProperty("--ang", `${ang}rad`);
        }
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      clearTimeout(noSensor);
      if (!fixed) window.removeEventListener("deviceorientation", onOrient);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", cancel);
      ro.disconnect();
      removeThrown();
      model?.dispose();
      blob.dispose();
      renderer.dispose();
    };
  }, [phase, gyro, url, heightCm, traits]);

  return (
    <div className={`petcam ${cameraOk ? "" : "room"}`}>
      <video ref={video} className="petcam-video" playsInline muted autoPlay style={{ display: cameraOk ? "block" : "none" }} />
      {!cameraOk && <div className="petcam-room" />}
      {phase === "on" && (
        <div className="ar3d">
          <canvas ref={canvas} className="ar3d-canvas" aria-label={`${name}的 3D 模型。點地板叫牠過去，點牠摸摸牠，往上滑丟球`} />
          <div ref={fx} className="ar3d-fx" />
          <div ref={arrow} className="ar3d-arrow"><span className="ar3d-arrow-icon">➜</span><span>{name}在這邊</span></div>
        </div>
      )}

      <div className="petcam-top">
        <Link className="btn small" href={backHref}>‹ 返回</Link>
        {phase === "on" && <button className="btn small" onClick={() => setSitting(!sitting)}>{sitting ? "我坐著" : "我站著"}</button>}
      </div>

      {phase !== "on" ? (
        <div className="petcam-intro card stack">
          <h1 style={{ margin: 0 }}>讓{name}來陪你</h1>
          <p className="small">打開鏡頭，{name}會出現在你身邊的地板上。點地板叫牠過去、點牠摸摸牠、往上滑丟球給牠撿。</p>
          <p className="tiny">畫面只在你的手機上，不會錄影或上傳。iPhone 會再問一次「動作與方向」，允許後轉動手機牠會留在原地。</p>
          <button className="btn primary" disabled={phase === "starting"} onClick={() => void start()}>{phase === "starting" ? "打開中…" : "打開鏡頭"}</button>
        </div>
      ) : (
        <>
          <p className="petcam-hint">
            {loaded === "loading" ? `${name}正在過來…` : loaded === "error" ? "模型載入失敗，請返回再試一次" : !cameraOk ? "沒有取得相機權限，先在這裡陪牠玩" : gyro === false ? "點地板叫牠過去・往上滑丟球" : "轉動手機找牠・點地板叫牠過去・往上滑丟球"}
          </p>
          <div className="ar3d-play">
            <button className="btn" onClick={() => cmd.current("come")}>叫牠過來</button>
            <button className="btn" onClick={() => cmd.current("ball")}>丟球</button>
            <button className="btn" onClick={() => cmd.current("jump")}>跳一下</button>
            <button className="btn" onClick={() => cmd.current("sit")}>坐下</button>
          </div>
        </>
      )}
    </div>
  );
}
