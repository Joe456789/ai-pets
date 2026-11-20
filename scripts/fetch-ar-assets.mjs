// 準備 AR 試放需要的檔案：MediaPipe 的 wasm（從 node_modules 複製）和 MagicTouch 去背模型（從 Google 官方下載）。
// 用法：node scripts/fetch-ar-assets.mjs
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const src = "node_modules/@mediapipe/tasks-vision/wasm";
const out = "public/mediapipe";
mkdirSync(join(out, "wasm"), { recursive: true });
for (const f of ["vision_wasm_internal.js", "vision_wasm_internal.wasm", "vision_wasm_nosimd_internal.js", "vision_wasm_nosimd_internal.wasm"]) {
  copyFileSync(join(src, f), join(out, "wasm", f));
}
const model = join(out, "magic_touch.tflite");
if (!existsSync(model)) {
  const res = await fetch("https://storage.googleapis.com/mediapipe-models/interactive_segmenter/magic_touch/float32/1/magic_touch.tflite");
  if (!res.ok) throw new Error(`下載模型失敗：${res.status}`);
  writeFileSync(model, Buffer.from(await res.arrayBuffer()));
}
console.log("AR 檔案已就緒");
