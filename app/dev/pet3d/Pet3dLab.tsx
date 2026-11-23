"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { jumpCurve, newAnim, stepAnim, triggerAct, type PetAct } from "@/lib/petAnim";
import { loadPetModel } from "@/lib/petModel";
import { BONES, restFrame, type Frame } from "@/lib/petSkeleton";

// 每根骨頭一個顏色（除錯用，看蒙皮分得對不對）
const BONE_COLORS = BONES.map((_, i) => new THREE.Color().setHSL((i * 0.29) % 1, 0.75, i % 2 ? 0.45 : 0.6));

export function Pet3dLab() {
  const host = useRef<HTMLCanvasElement>(null);
  const ctl = useRef({ speed: 0, yaw: 0, look: -1.2, act: null as PetAct | null });
  const [info, setInfo] = useState("載入中…");

  useEffect(() => {
    const el = host.current!;
    const renderer = new THREE.WebGLRenderer({ canvas: el, antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(720, 480, false);
    renderer.setClearColor(0xe8e2d4);
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(35, 720 / 480, 0.05, 50);
    cam.position.set(0, 0.7, 2.6);
    cam.lookAt(0, 0.45, 0);
    scene.add(new THREE.Mesh(new THREE.CircleGeometry(2, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xd8cfbd })));
    const group = new THREE.Group();
    scene.add(group);
    const anim = newAnim();
    let raf = 0;
    let disposed = false;
    let dispose = () => undefined as void;
    loadPetModel(`/models/${new URLSearchParams(location.search).get("f") ?? "afu-v2"}.glb`).then((m) => {
      if (disposed) return m.dispose();
      dispose = m.dispose;
      group.add(m.mesh);
      const helper = new THREE.SkeletonHelper(m.mesh);
      helper.visible = false;
      scene.add(helper);
      const s = m.skel;
      const v = (p: THREE.Vector3) => `(${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`;
      setInfo(`骨盆 ${v(s.rest[0])}・胸 ${v(s.rest[2])}・脖子 ${v(s.rest[3])}・頭 ${v(s.rest[4])}・頭原本朝 ${s.headYaw.toFixed(2)}・坐下骨盆高 ${s.sitY.toFixed(2)}・尾巴下垂 ${s.tailDroop.toFixed(2)}・`
        + s.legs.map((L, k) => `腿${k} 髖${v(L.hip)} 膝${v(L.knee)} 踝${v(L.ankle)} 掌${v(L.paw)}`).join("・"));
      let last = performance.now();
      let frozen = false;
      const draw = (yaw: number) => { group.rotation.y = yaw; renderer.render(scene, cam); };
      // 除錯：直接指定姿勢並畫一張，例如 __lab.pose({ sit: 1 }, 0)
      (window as unknown as { __lab: unknown }).__lab = {
        pose: (over: Partial<Frame>, yaw = 0) => { frozen = true; m.update({ ...restFrame(), ...over }); draw(yaw); },
        play: () => { frozen = false; last = performance.now(); },
        jumpAt: (t: number, yaw = 0) => { frozen = true; const j = jumpCurve(t); m.update({ ...restFrame(), lift: j.lift, crouch: j.crouch, rock: j.rock, tuck: j.tuck }); draw(yaw); },
        view: (z: number, y: number, lookY: number) => { cam.position.set(0, y, z); cam.lookAt(0, lookY, 0); },
        bones: (on: boolean) => { helper.visible = on; },
        // 用顏色顯示每個點主要跟著哪根骨頭
        colors: (on: boolean, yaw = 0) => {
          const g = m.mesh.geometry;
          const idx = g.getAttribute("skinIndex"), w = g.getAttribute("skinWeight");
          const col = new Float32Array(idx.count * 3);
          for (let i = 0; i < idx.count; i++) {
            let r = 0, gg = 0, b = 0;
            for (let j = 0; j < 4; j++) {
              const c = BONE_COLORS[idx.getComponent(i, j)], k = w.getComponent(i, j);
              r += c.r * k; gg += c.g * k; b += c.b * k;
            }
            col.set([r, gg, b], i * 3);
          }
          g.setAttribute("color", new THREE.BufferAttribute(col, 3));
          const mat = m.mesh.material as THREE.MeshBasicMaterial;
          if (!("map" in mat.userData)) mat.userData.map = mat.map;
          mat.vertexColors = on;
          mat.map = on ? null : mat.userData.map;
          mat.needsUpdate = true;
          frozen = true;
          m.update(restFrame());
          draw(yaw);
        },
      };
      const tick = (now: number) => {
        if (disposed) return;
        raf = requestAnimationFrame(tick);
        if (frozen) return;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const c = ctl.current;
        if (c.act) { triggerAct(anim, c.act); c.act = null; }
        m.update(stepAnim(anim, dt, { speed: c.speed, look: c.look, restLook: s.headYaw }));
        draw(c.yaw);
      };
      raf = requestAnimationFrame(tick);
    }).catch((e) => setInfo(`載入失敗：${e}`));
    return () => { disposed = true; cancelAnimationFrame(raf); dispose(); renderer.dispose(); };
  }, []);

  const b = (label: string, f: () => void) => <button className="btn small" onClick={f}>{label}</button>;
  return (
    <div style={{ padding: 16 }}>
      <canvas ref={host} style={{ width: 720, height: 480, borderRadius: 10 }} />
      <p className="muted small" id="rig-info">{info}</p>
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        {b("站著", () => { ctl.current.speed = 0; })}
        {b("走路", () => { ctl.current.speed = 0.75; })}
        {b("小跑", () => { ctl.current.speed = 2.2; })}
        {b("奔跑", () => { ctl.current.speed = 4.5; })}
        {b("往前跳", () => { ctl.current.act = "jump"; })}
        {b("坐下", () => { ctl.current.speed = 0; ctl.current.act = "sit"; })}
        {b("跳兩下", () => { ctl.current.act = "hop"; })}
        {b("開心搖尾", () => { ctl.current.act = "wag"; })}
        {b("歪頭", () => { ctl.current.act = "tilt"; })}
        {b("看前面", () => { ctl.current.look = 0; })}
        {b("看鏡頭", () => { ctl.current.look = -1.2; })}
        {b("側面", () => { ctl.current.yaw = 0; })}
        {b("斜前", () => { ctl.current.yaw = -0.6; })}
        {b("正面", () => { ctl.current.yaw = -Math.PI / 2; })}
        {b("背面", () => { ctl.current.yaw = Math.PI; })}
      </div>
    </div>
  );
}
