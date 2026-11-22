"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { newAnim, stepAnim, triggerAct, type PetAct } from "@/lib/petAnim";
import { loadPetModel } from "@/lib/petModel";

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * 3D 紀念：用照片重建的模型，加上自動綁好的骨架，讓牠安靜地站著呼吸、偶爾歪頭搖尾巴、轉頭看你。
 * 左右拖曳可以轉動；點一下就像摸摸牠。
 */
export function MemorialViewer({ url, name }: { url: string; name: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const canvas = canvasRef.current!;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(32, 1, 0.05, 50);
    cam.position.set(0, 0.62, 2.7);
    cam.lookAt(0, 0.42, 0);

    // 腳下一圈柔和的影子
    const shadowTex = (() => {
      const c = document.createElement("canvas");
      c.width = c.height = 128;
      const g = c.getContext("2d")!;
      const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
      grad.addColorStop(0, "rgba(20,16,24,.45)");
      grad.addColorStop(1, "rgba(20,16,24,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    })();
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    scene.add(shadow);
    const group = new THREE.Group();
    scene.add(group);

    const resize = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      cam.aspect = w / h;
      // 直式手機畫面較窄，鏡頭退後一點才放得下整隻
      cam.position.z = w / h < 0.9 ? 3.6 : 2.7;
      cam.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const anim = newAnim();
    let yaw = -0.55, yawVel = 0, dragging = false, lastX = 0, moved = 0;
    let nextAct = 6, actIdx = 0;
    const ACTS: PetAct[] = ["tilt", "wag", "sit", "tilt", "wag"];
    let raf = 0, disposed = false, dispose = () => undefined as void;

    const down = (e: PointerEvent) => { dragging = true; lastX = e.clientX; moved = 0; canvas.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      moved += Math.abs(dx);
      yawVel = dx * 0.01;
      yaw += yawVel;
    };
    const up = () => {
      if (dragging && moved < 6) { triggerAct(anim, actIdx++ % 2 ? "tilt" : "wag"); nextAct = 8; }
      dragging = false;
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);

    loadPetModel(url).then((m) => {
      if (disposed) return m.dispose();
      dispose = m.dispose;
      // 模型的原點不一定在身體中間，轉動時會繞著旁邊轉；先把身體中心移到原點。
      const bb = m.mesh.geometry.boundingBox;
      if (bb) m.mesh.position.set(-(bb.min.x + bb.max.x) / 2, 0, -(bb.min.z + bb.max.z) / 2);
      group.add(m.mesh);
      setState("ready");
      let last = performance.now();
      const tick = (now: number) => {
        if (disposed) return;
        raf = requestAnimationFrame(tick);
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (!dragging) { yawVel *= Math.pow(0.04, dt); yaw += yawVel; }
        nextAct -= dt;
        if (nextAct <= 0) { triggerAct(anim, ACTS[Math.floor(Math.random() * ACTS.length)]); nextAct = 9 + Math.random() * 7; }
        // 鏡頭在 +Z；身體轉了 yaw 之後，看向鏡頭要轉的角度
        const look = wrap(-Math.PI / 2 - yaw);
        m.update(stepAnim(anim, dt, { speed: 0, look, restLook: m.skel.headYaw, turning: false }));
        group.rotation.y = yaw;
        renderer.render(scene, cam);
      };
      raf = requestAnimationFrame(tick);
    }).catch(() => { if (!disposed) setState("error"); });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      dispose();
      shadowTex.dispose();
      renderer.dispose();
    };
  }, [url]);

  return (
    <div className="memorial-stage">
      <canvas ref={canvasRef} aria-label={`${name}的 3D 模型，左右拖曳可以轉動，點一下摸摸牠`} role="img" />
      <p className="memorial-hint">
        {state === "loading" ? "正在載入…" : state === "error" ? "模型載入失敗，請重新整理再試一次" : "左右拖曳轉動・點一下摸摸牠"}
      </p>
    </div>
  );
}
