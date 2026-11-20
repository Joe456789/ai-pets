"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { personaAction } from "@/app/adopt/actions";
import { MotionPlayer, type MotionPlayerHandle } from "@/components/MotionPlayer";
import { RealSizeAr } from "@/components/RealSizeAr";
import { Notice } from "@/components/ui";
import { EVENT_REACTIONS, EVENT_TEXT, REACTION_TEXT, type Persona, type ReactionKey } from "@/lib/ar";
import { ArWorld, type ArWorldHandle, type WorldEvent, type WorldSource } from "@/components/ArWorld";
import { focalPx } from "@/lib/arMath";
import { cutoutFromPhoto, FRAME, loadImage, type Pt } from "@/lib/cutout";
import type { PublicMotion } from "@/lib/types";

export type ArPet = {
  id: string; name: string; kind: string; size: string; photo: string | null; cutout: string | null; motion: PublicMotion | null; model3d: string | null;
  heightCm: number; reactions: ReactionKey[]; shelterName: string;
};

export function ArStage({ pet }: { pet: ArPet }) {
  const stage = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const player = useRef<MotionPlayerHandle>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [camera, setCamera] = useState<"off" | "starting" | "on">("off");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [img, setImg] = useState<{ url: string; aspect: number } | null>(null);
  const [cutState, setCutState] = useState<"working" | "done" | "photo">("working");
  const [motionReady, setMotionReady] = useState(false);
  const [picking, setPicking] = useState(false);
  const [pos, setPos] = useState<Pt | null>(null);
  // 陀螺儀模式：相機畫面改成 3D 場景，動物站在虛擬地板上，依手機傾斜角和離地高度推算距離與大小
  const [gyro, setGyro] = useState<"off" | "on" | "denied" | "unsupported">("off");
  const [phoneCm, setPhoneCm] = useState(130);
  const [hearts, setHearts] = useState(0);
  const world = useRef<ArWorldHandle>(null);
  const [scale, setScale] = useState(1);
  const [flip, setFlip] = useState(false);
  const [reaction, setReaction] = useState<{ key: ReactionKey; n: number } | null>(null);
  const [bubble, setBubble] = useState<string | null>(null);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [saving, setSaving] = useState(false);
  const pointers = useRef(new Map<number, Pt>());
  const gesture = useRef<{ start: number; moved: boolean; dist?: number; scale0?: number; offset?: Pt }>({ start: 0, moved: false });
  const tapCount = useRef(0);
  const motion = pet.motion;

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    // 先直接量一次，不必等第一次重繪，畫面一出來動物就能放上去
    const r = el.getBoundingClientRect();
    if (r.width) setSize({ w: r.width, h: r.height });
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // 舞台大小改變（旋轉手機、視窗縮放）時，等比例移動動物位置
  const lastSize = useRef({ w: 0, h: 0 });
  useEffect(() => {
    if (!size.w) return;
    const prev = lastSize.current;
    lastSize.current = size;
    setPos((p) => (!p || !prev.w ? { x: size.w * 0.5, y: size.h * 0.88 } : { x: (p.x * size.w) / prev.w, y: (p.y * size.h) / prev.h }));
  }, [size]);

  // 去背圖：協會已經存好就直接用，沒有就在瀏覽器即時去背
  const prepare = useCallback(async (point?: Pt) => {
    const useStored = pet.cutout && !point;
    setCutState("working");
    try {
      const url = useStored ? pet.cutout : pet.photo ? await cutoutFromPhoto(pet.photo, point) : null;
      if (url) {
        const i = await loadImage(url);
        setImg({ url, aspect: i.naturalWidth / i.naturalHeight });
        setCutState("done");
        return;
      }
    } catch (e) {
      console.warn("去背失敗，改用原圖", e);
    }
    if (!pet.photo) return;
    const i = await loadImage(pet.photo);
    setImg({ url: pet.photo, aspect: i.naturalWidth / i.naturalHeight });
    setCutState("photo");
  }, [pet.cutout, pet.photo]);
  useEffect(() => { void prepare(); }, [prepare]);

  useEffect(() => {
    let alive = true;
    personaAction(pet.id).then((p) => { if (alive && p) { setPersona(p); setBubble(p.intro); } });
    return () => { alive = false; };
  }, [pet.id]);

  const stopCamera = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setCamera("off");
    setGyro("off");
    setScale(1);
  };
  useEffect(() => () => stream.current?.getTracks().forEach((t) => t.stop()), []);
  const startCamera = async () => {
    setCameraError(null);
    // iPhone 要在按下按鈕的當下詢問「動作與方向」權限，等相機開好再問會被擋掉
    const DOE = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
    const askGyro: Promise<string> = typeof DOE?.requestPermission === "function"
      ? DOE.requestPermission().catch(() => "denied")
      : Promise.resolve(DOE ? "granted" : "unsupported");
    if (!navigator.mediaDevices?.getUserMedia) { setCameraError("這個瀏覽器不支援相機，先用示意客廳試試看。"); return; }
    setCamera("starting");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      stream.current = s;
      if (video.current) { video.current.srcObject = s; await video.current.play(); }
      setCamera("on");
      setScale(1);
      const g = await askGyro;
      setGyro(g === "granted" ? "on" : g === "unsupported" ? "unsupported" : "denied");
    } catch {
      setCamera("off");
      setCameraError("沒有取得相機權限。可以在瀏覽器設定允許相機，或先用示意客廳試試看。");
    }
  };

  const focal = useCallback((w: number, h: number) => {
    const v = video.current;
    return focalPx(w, h, v?.videoWidth ?? 0, v?.videoHeight ?? 0);
  }, []);
  // 有 3D 模型就一律用 3D：有方向感測器時是真的 AR，沒有時鏡頭固定、左右滑轉動牠
  const [modelFail, setModelFail] = useState(false);
  const useModel = Boolean(pet.model3d && !modelFail);
  const liveAr = camera === "on" && gyro === "on";
  const use3d = liveAr || useModel;
  const fixedView = !liveAr;
  // 大小：示意客廳以沙發椅背高度（約 85 公分）換算；相機畫面有陀螺儀就在 3D 場景依距離推算，沒有就依畫面高度估計。
  const roomPpcm = Math.max(size.w / 1200, size.h / 900) * (230 / 85) * 1.2;
  const petH = (camera === "on" ? size.h * 0.34 * (pet.heightCm / 60) : pet.heightCm * roomPpcm) * scale;
  const petW = img ? petH * img.aspect : petH;
  const boxH = motion ? petH / FRAME.animalHeight : petH;
  const boxW = motion ? (boxH * FRAME.w) / FRAME.h : petW;
  const boxDrop = motion ? boxH * (1 - FRAME.foot) : 0; // 綠幕畫面裡腳底下方的空白

  const local = (e: React.PointerEvent): Pt => {
    const r = stage.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 1) gesture.current = { start: Date.now(), moved: false, offset: pos ? { x: p.x - pos.x, y: p.y - pos.y } : { x: 0, y: 0 } };
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { ...gesture.current, moved: true, dist: Math.hypot(a.x - b.x, a.y - b.y), scale0: scale };
    }
  };
  const onMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    if (pointers.current.size >= 2 && g.dist) {
      const [a, b] = [...pointers.current.values()];
      setScale(Math.max(0.3, Math.min(3, (g.scale0 ?? 1) * (Math.hypot(a.x - b.x, a.y - b.y) / g.dist))));
      return;
    }
    if (g.offset) {
      const next = { x: p.x - g.offset.x, y: p.y - g.offset.y };
      if (pos && Math.hypot(next.x - pos.x, next.y - pos.y) > 6) g.moved = true;
      if (g.moved) setPos({ x: Math.max(0, Math.min(size.w, next.x)), y: Math.max(petH * 0.3, Math.min(size.h + petH * 0.1, next.y)) });
    }
  };
  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0 && !gesture.current.moved && Date.now() - gesture.current.start < 350) react();
  };
  const react = () => {
    const key = pet.reactions[tapCount.current % pet.reactions.length];
    tapCount.current += 1;
    const played = motion ? player.current?.play(key) : false;
    if (!played) setReaction((r) => ({ key, n: (r?.n ?? 0) + 1 }));
    setBubble(REACTION_TEXT[key]);
  };

  // 3D 場景裡的互動：點牠、丟球、餵零食、叫牠過來，都會播一段反應影片並增加親密度
  const playFirst = (keys: ReactionKey[]) => keys.some((k) => player.current?.play(k));
  const onWorld = (e: WorldEvent) => {
    const next = Math.min(5, hearts + 1);
    setHearts(next);
    if (e === "tap") react();
    else {
      playFirst([...EVENT_REACTIONS[e], ...pet.reactions]);
      setBubble(EVENT_TEXT[e]);
    }
    if (next === 5 && hearts < 5) setTimeout(() => setBubble(`我們好像很合得來！想不想到${pet.shelterName}見見真正的我？`), 1600);
  };
  // 有 3D 模型就用模型（可以繞著看、會走會坐），載入失敗再退回影片或照片
  const worldSource: WorldSource | null = useModel && pet.model3d
    ? { kind: "model", url: pet.model3d }
    : motion
    ? { kind: "canvas", get: () => player.current?.canvas() ?? null, aspect: FRAME.w / FRAME.h, animalHeight: FRAME.animalHeight, foot: FRAME.foot }
    : img ? { kind: "image", url: img.url, aspect: img.aspect } : null;

  const pickPoint = (e: React.MouseEvent<HTMLImageElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPicking(false);
    void prepare({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
  };

  const capture = async () => {
    if ((!pos && !use3d) || (!img && !motion && !(use3d && useModel))) return;
    setSaving(true);
    try {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const c = document.createElement("canvas");
      c.width = Math.round(size.w * dpr);
      c.height = Math.round(size.h * dpr);
      const ctx = c.getContext("2d")!;
      ctx.scale(dpr, dpr);
      const cover = (src: CanvasImageSource, sw: number, sh: number) => {
        const s = Math.max(size.w / sw, size.h / sh);
        ctx.drawImage(src, (size.w - sw * s) / 2, (size.h - sh * s) / 2, sw * s, sh * s);
      };
      if (camera === "on" && video.current) cover(video.current, video.current.videoWidth, video.current.videoHeight);
      else { const room = await loadImage("/ar/room.svg"); cover(room, 1200, 900); }
      const shot = use3d ? world.current?.snapshot() : null;
      if (shot) ctx.drawImage(shot, 0, 0, size.w, size.h);
      else {
      ctx.fillStyle = "rgba(0,0,0,.22)";
      ctx.beginPath();
      if (!pos) return;
      ctx.ellipse(pos.x, pos.y - 4, petW * 0.42, petH * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(pos.x, pos.y + boxDrop);
      if (flip) ctx.scale(-1, 1);
      const frame = motion ? player.current?.canvas() : null;
      if (frame) ctx.drawImage(frame, -boxW / 2, -boxH, boxW, boxH);
      else if (img) ctx.drawImage(await loadImage(img.url), -petW / 2, -petH, petW, petH);
      ctx.restore();
      }
      ctx.fillStyle = "rgba(31,38,36,.72)";
      ctx.fillRect(0, size.h - 28, size.w, 28);
      ctx.fillStyle = "#fff";
      ctx.font = "13px sans-serif";
      ctx.fillText(`${pet.name}・${pet.shelterName}｜浪浪夥伴 ${use3d && useModel ? "AI 由照片做成的 3D 模型" : motion ? "AI 生成的模擬動態" : "依協會資料模擬示意"}`, 10, size.h - 10);
      const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/jpeg", 0.9));
      if (!blob) return;
      const file = new File([blob], `${pet.name}-在我家.jpg`, { type: "image/jpeg" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${pet.name}在我家的樣子` }).catch(() => undefined);
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      }
    } finally {
      setSaving(false);
    }
  };

  const showPet = Boolean(pos && (motion || img) && !use3d);
  return (
    <div className="ar-wrap">
      <div className="ar-head">
        <Link href={`/adopt/animals/${pet.id}`} className="small muted">← 回到{pet.name}的介紹</Link>
        <h1>看看{pet.name}在你家</h1>
        <p className="small muted">{useModel
          ? `點一下${pet.name}、丟球、餵零食，看看牠的反應；左右滑可以轉動牠。依體型估計約 ${pet.heightCm} 公分高。`
          : `拖曳可以移動，兩指可以縮放，點一下${pet.name}看看牠的反應。依體型估計約 ${pet.heightCm} 公分高。`}</p>
      </div>

      <div className="ar-stage" ref={stage}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {camera !== "on" && <img className="ar-bg" src="/ar/room.svg" alt="示意客廳" />}
        <video ref={video} className="ar-bg" playsInline muted style={{ display: camera === "on" ? "block" : "none" }} />

        {showPet && pos && <span className="ar-shadow" style={{ left: pos.x - petW * 0.42, top: pos.y - petH * 0.06, width: petW * 0.84, height: petH * 0.12 }} />}
        {showPet && pos && (
          <div className="ar-pet" style={{ left: pos.x, top: pos.y + boxDrop, width: boxW, height: boxH }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
            <div key={reaction?.n ?? 0} className={`ar-react ${reaction ? `ar-${reaction.key}` : ""}`} style={{ transform: flip ? "scaleX(-1)" : undefined }}>
              {motion ? (
                <MotionPlayer ref={player} idle={motion.idle} reactions={motion.reactions} onReady={() => setMotionReady(true)} />
              ) : img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img.url} alt={pet.name} draggable={false} className={`ar-img ${cutState === "photo" ? "ar-framed" : ""}`} />
              ) : null}
            </div>
          </div>
        )}
        {bubble && pos && showPet && <div className="ar-bubble" style={{ left: pos.x, top: pos.y - petH - 12 }}>{bubble}</div>}
        {use3d && worldSource && (
          <>
            {motion && !useModel && (
              <div className="ar3d-hidden" aria-hidden>
                <MotionPlayer ref={player} idle={motion.idle} reactions={motion.reactions} onReady={() => setMotionReady(true)} />
              </div>
            )}
            <ArWorld key={`${worldSource.kind}-${fixedView}`} ref={world} fixed={fixedView} name={pet.name} heightM={pet.heightCm / 100} scale={useModel ? 1 : scale} flip={flip} phoneM={phoneCm / 100} focal={focal}
              source={worldSource} bubble={bubble} onEvent={onWorld} onNoSensor={() => setGyro("unsupported")} onModelFail={() => setModelFail(true)} />
          </>
        )}
        {use3d && worldSource && (
          <div className="ar3d-play">
            <button className="btn small" onClick={() => world.current?.throwBall()}>🎾 丟球</button>
            <button className="btn small" onClick={() => world.current?.treat()}>🦴 餵零食</button>
            <button className="btn small" onClick={() => world.current?.callOver()}>👋 叫牠過來</button>
          </div>
        )}
        {use3d && useModel ? <span className="ar-tag">AI 由照片做成的 3D 模型</span> : motion && <span className="ar-tag">AI 生成的模擬動態</span>}
        {use3d && <span className="ar3d-hearts" aria-label={`親密度 ${hearts} / 5`} title="每次跟牠互動（點牠、丟球、餵零食、叫牠）就加一顆愛心"><span className="ar3d-hearts-label">親密度</span>{"❤".repeat(hearts)}<span className="ar3d-hearts-off">{"❤".repeat(5 - hearts)}</span></span>}
        {(cutState === "working" && !motion) && <div className="ar-status">正在準備{pet.name}的照片…第一次約需 10 秒</div>}
        {motion && !motionReady && !(use3d && useModel) && <div className="ar-status">正在載入{pet.name}的動態影片…</div>}

        {picking && pet.photo && (
          <div className="ar-pick">
            <p>點一下照片中的{pet.name}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pet.photo} alt="原始照片" onClick={pickPoint} />
            <button className="btn small" onClick={() => setPicking(false)}>取消</button>
          </div>
        )}
      </div>

      <div className="ar-controls">
        {camera === "on"
          ? <button className="btn small" onClick={stopCamera}>改用示意客廳</button>
          : <button className="btn small" disabled={camera === "starting"} onClick={startCamera}>{camera === "starting" ? "開啟中…" : "開啟相機"}</button>}
        <RealSizeAr imageUrl={cutState === "working" ? null : img?.url ?? null} modelUrl={useModel ? pet.model3d : null} heightCm={pet.heightCm} name={pet.name} />
        {!useModel && <button className="btn small" onClick={() => setFlip((f) => !f)}>轉向</button>}
        {!motion && pet.photo && cutState !== "working" && <button className="btn small" onClick={() => setPicking(true)}>去背不準？重選</button>}
        <button className="btn small clay" disabled={(!img && !motion) || saving} onClick={capture}>{saving ? "處理中…" : "拍照分享"}</button>
        {/* 3D 模型依估計身高顯示真實比例，不需要手動調大小 */}
        {!useModel && <label className="ar-scale small">大小<input type="range" min={0.3} max={3} step={0.05} value={scale} onChange={(e) => setScale(Number(e.target.value))} /></label>}
      </div>
      {cameraError && <p className="error-box" style={{ marginTop: 8 }}>{cameraError}</p>}
      {use3d && (
        <div className="ar-gyro small">
          <p>{fixedView
            ? `左右滑可以轉動${pet.name}看側面和背面，往上滑可以丟球，點地板牠會走過去，點牠會有反應，拖曳可以換位置。${camera === "on" ? "" : "開啟相機可以放進你家的畫面。"}`
            : `${pet.name}站在你家的地板上：手機怎麼轉（轉成橫的也可以）牠都會留在原地。往上滑可以丟球，點地板牠會走過去，點牠會有反應，拖曳可以換位置；左右滑可以轉動牠。`}</p>
          <label className="ar-scale">手機離地高度 {phoneCm} 公分
            <input type="range" min={60} max={180} step={5} value={phoneCm} onChange={(e) => { setPhoneCm(Number(e.target.value)); }} />
          </label>
          <p className="muted">大小依手機傾斜角和離地高度推算，誤差約兩到三成；站著拿手機約 130 公分，坐著約 90 公分。互動是模擬的小遊戲，不代表{pet.name}真實的反應。</p>
        </div>
      )}
      <p className="small muted" style={{ marginTop: 6 }}>
        {camera !== "on"
          ? "示意客廳依沙發椅背高度約 85 公分換算大小。開啟相機可以放進你家的畫面。"
          : gyro === "denied"
            ? "沒有取得「動作與方向」權限，大小改用估計值。可以在瀏覽器設定允許後重新開啟相機。"
            : gyro === "unsupported"
              ? "這支手機讀不到方向感測器，大小改用估計值。"
              : "想看最準確的真實大小，可以按「放到地上看真實大小」（手機內建 AR，畫面中為靜態照片）。"}
      </p>

      <section className="card ar-persona">
        <div className="row between">
          <h2 style={{ margin: 0 }}>{pet.name}的自我介紹</h2>
          {persona?.ai && <span className="ai-tag">AI 依協會介紹撰寫</span>}
        </div>
        {!persona && <p className="small muted">正在準備自我介紹…</p>}
        {persona && (
          <>
            <div className="chips" style={{ margin: "10px 0" }}>
              <button className="chip ar-q" onClick={() => setBubble(persona.intro)}>自我介紹</button>
              {persona.qa.map((x) => <button key={x.q} className="chip ar-q" onClick={() => setBubble(x.a)}>{x.q}</button>)}
            </div>
            <p className="small muted">
              自我介紹是依協會提供的資料模擬的第一人稱說明{motion ? "，動態影片由 AI 依照片生成，" : "，"}{pet.model3d ? "3D 模型由 AI 依照片推測背面與側面，動作是程式模擬的，" : ""}反應依個性描述設計，都不是實拍。實際個性請到現場和{pet.name}互動，或詢問{pet.shelterName}。
            </p>
          </>
        )}
        <div style={{ marginTop: 10 }}><Notice compact /></div>
        <div className="row" style={{ marginTop: 12 }}>
          <Link className="btn clay" href={`/adopt/apply/${pet.id}`}>申請領養{pet.name}</Link>
          <Link className="btn" href={`/adopt/animals/${pet.id}`}>看完整介紹</Link>
        </div>
      </section>
    </div>
  );
}
