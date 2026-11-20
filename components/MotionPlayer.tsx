"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export type MotionPlayerHandle = { play: (key: string) => boolean; canvas: () => HTMLCanvasElement | null };

const VERT = `attribute vec2 p; varying vec2 v; void main(){ v = vec2((p.x + 1.0) / 2.0, 1.0 - (p.y + 1.0) / 2.0); gl_Position = vec4(p, 0.0, 1.0); }`;
// 綠色程度 k = G - max(R, B)：越綠越透明，邊緣做柔化並壓掉殘留的綠色反光。
const FRAG = `precision mediump float; varying vec2 v; uniform sampler2D t;
void main(){
  vec4 c = texture2D(t, v);
  float m = max(c.r, c.b);
  float k = c.g - m;
  float a = 1.0 - smoothstep(0.12, 0.32, k);
  vec3 col = c.rgb;
  if (c.g > m) col.g = mix(m, c.g, 0.3);
  gl_FragColor = vec4(col * a, a);
}`;

function setupGl(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, preserveDrawingBuffer: true });
  if (!gl) return null;
  const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.clearColor(0, 0, 0, 0);
  return (video: HTMLVideoElement) => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
}

// 不支援 WebGL 時用 2D 畫布逐點處理，畫質降低但能用。
function setup2d(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  return (video: HTMLVideoElement) => {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const im = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = im.data;
    for (let i = 0; i < d.length; i += 4) {
      const m = Math.max(d[i], d[i + 2]);
      const k = d[i + 1] - m;
      if (k > 80) d[i + 3] = 0;
      else if (k > 30) { d[i + 3] = Math.round((255 * (80 - k)) / 50); d[i + 1] = m + (d[i + 1] - m) * 0.3; }
    }
    ctx.putImageData(im, 0, 0);
  };
}

/** 播放綠幕影片並即時去掉綠色。平常循環播放 idle，play(key) 播一次反應影片後接回 idle。 */
export const MotionPlayer = forwardRef<MotionPlayerHandle, { idle: string; reactions: Record<string, string>; onReady?: () => void }>(
  function MotionPlayer({ idle, reactions, onReady }, ref) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const videos = useRef<Record<string, HTMLVideoElement>>({});
    const current = useRef<HTMLVideoElement | null>(null);
    // onReady 每次重繪都是新的函式，放在 ref 裡，避免影片被重新載入
    const readyCb = useRef(onReady);
    readyCb.current = onReady;

    useImperativeHandle(ref, () => ({
      play: (key) => {
        const v = videos.current[key];
        if (!v) return false;
        v.currentTime = 0;
        void v.play().catch(() => undefined);
        current.current = v;
        v.onended = () => { current.current = videos.current.idle; };
        return true;
      },
      canvas: () => canvas.current,
    }), []);

    useEffect(() => {
      const make = (src: string, loop: boolean) => {
        const v = document.createElement("video");
        v.muted = true;
        v.loop = loop;
        v.playsInline = true;
        v.setAttribute("playsinline", "");
        v.preload = "auto";
        v.src = src;
        return v;
      };
      const all: Record<string, HTMLVideoElement> = { idle: make(idle, true) };
      for (const [k, src] of Object.entries(reactions)) all[k] = make(src, false);
      videos.current = all;
      current.current = all.idle;
      void all.idle.play().catch(() => undefined);

      const c = canvas.current!;
      const draw = setupGl(c) ?? setup2d(c);
      let raf = 0;
      let ready = false;
      const tick = () => {
        const v = current.current;
        if (draw && v && v.readyState >= 2) {
          draw(v);
          if (!ready) { ready = true; readyCb.current?.(); }
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      // iPhone 有時要等使用者互動後才肯播放
      const resume = () => { if (current.current?.paused) void current.current.play().catch(() => undefined); };
      document.addEventListener("pointerdown", resume);
      return () => {
        cancelAnimationFrame(raf);
        document.removeEventListener("pointerdown", resume);
        for (const v of Object.values(all)) { v.pause(); v.removeAttribute("src"); v.load(); }
      };
    }, [idle, reactions]);

    return <canvas ref={canvas} width={960} height={540} className="motion-canvas" />;
  },
);
