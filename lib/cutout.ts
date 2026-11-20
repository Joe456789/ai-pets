// 只在瀏覽器使用：去背、組綠幕畫面、格式轉換。

export type Pt = { x: number; y: number };

/** 綠幕畫面的構圖：動物高度佔畫面 72%，腳底在畫面 90% 的位置。播放器靠這兩個數字換算大小。 */
export const FRAME = { w: 1280, h: 720, animalHeight: 0.72, foot: 0.9 } as const;
const MAX_SIDE = 1000;

export function loadImage(src: string) {
  return new Promise<HTMLImageElement>((ok, fail) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => fail(new Error("圖片載入失敗"));
    img.src = src;
  });
}

/**
 * 用 MediaPipe 的 MagicTouch 模型去背：以點選位置為目標，切出動物並裁成剛好的大小。
 * 結果太小或太大（多半是點錯位置）時回傳 null。
 */
export async function cutoutFromPhoto(src: string, point: Pt = { x: 0.5, y: 0.55 }): Promise<string | null> {
  const img = await loadImage(src);
  const { FilesetResolver, InteractiveSegmenter } = await import("@mediapipe/tasks-vision");
  const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
  const seg = await InteractiveSegmenter.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: "/mediapipe/magic_touch.tflite", delegate: "CPU" },
    outputCategoryMask: false,
    outputConfidenceMasks: true,
  });
  try {
    const res = seg.segment(img, { keypoint: point });
    const masks = res.confidenceMasks ?? [];
    if (!masks.length) return null;
    const mw = masks[0].width;
    const mh = masks[0].height;
    const at = (m: Float32Array) => m[Math.min(mh - 1, Math.floor(point.y * mh)) * mw + Math.min(mw - 1, Math.floor(point.x * mw))];
    const arrays = masks.map((m) => m.getAsFloat32Array());
    const fg = arrays.reduce((best, m) => (at(m) > at(best) ? m : best), arrays[0]);
    masks.forEach((m) => m.close());

    const s = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * s);
    const h = Math.round(img.naturalHeight * s);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, w, h);
    const pixels = ctx.getImageData(0, 0, w, h);
    let minX = w, minY = h, maxX = 0, maxY = 0, count = 0;
    for (let y = 0; y < h; y++) {
      const my = Math.min(mh - 1, Math.floor((y / h) * mh));
      for (let x = 0; x < w; x++) {
        const v = fg[my * mw + Math.min(mw - 1, Math.floor((x / w) * mw))];
        const a = Math.max(0, Math.min(1, (v - 0.3) / 0.4));
        pixels.data[(y * w + x) * 4 + 3] = Math.round(a * 255);
        if (a > 0.5) { count++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
      }
    }
    const ratio = count / (w * h);
    if (ratio < 0.03 || ratio > 0.92) return null;
    ctx.putImageData(pixels, 0, 0);
    const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.03);
    const cx = Math.max(0, minX - pad), cy = Math.max(0, minY - pad);
    const cw = Math.min(w, maxX + pad) - cx, ch = Math.min(h, maxY + pad) - cy;
    const out = document.createElement("canvas");
    out.width = cw;
    out.height = ch;
    out.getContext("2d")!.drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch);
    return out.toDataURL("image/png");
  } finally {
    seg.close();
  }
}

/** 把去背圖放到純綠背景上，給 AI 生成影片用。 */
export async function greenFrame(cutoutUrl: string): Promise<Blob> {
  const img = await loadImage(cutoutUrl);
  const c = document.createElement("canvas");
  c.width = FRAME.w;
  c.height = FRAME.h;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#00ff00";
  ctx.fillRect(0, 0, FRAME.w, FRAME.h);
  let h = FRAME.h * FRAME.animalHeight;
  let w = (h * img.naturalWidth) / img.naturalHeight;
  if (w > FRAME.w * 0.9) { w = FRAME.w * 0.9; h = (w * img.naturalHeight) / img.naturalWidth; }
  ctx.drawImage(img, (FRAME.w - w) / 2, FRAME.h * FRAME.foot - h, w, h);
  return new Promise((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error("無法產生畫面"))), "image/jpeg", 0.95));
}

export async function toBase64(src: Blob | string) {
  const blob = typeof src === "string" ? await (await fetch(src)).blob() : src;
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** 轉成 PNG 位元組（AR 模型需要 PNG），順便限制大小。 */
export async function pngBytes(src: string, maxSide = 1024) {
  const img = await loadImage(src);
  const s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * s);
  c.height = Math.round(img.naturalHeight * s);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/png"));
  if (!blob) throw new Error("無法轉換圖片");
  return { bytes: new Uint8Array(await blob.arrayBuffer()), width: c.width, height: c.height };
}
