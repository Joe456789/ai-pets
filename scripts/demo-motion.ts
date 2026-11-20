// 準備示範動物「阿福」：放上 CC0 授權的德國牧羊犬照片、去背圖，並用 AI 產生動態影片（約 NT$30）。
// 用法：npx tsx --env-file=.env.local scripts/demo-motion.ts <照片.jpg> <去背.png> <綠幕.jpg>
// 照片來源：https://www.rawpixel.com/image/3338497（CC0）
import { readFileSync } from "node:fs";
import { savePhoto } from "@/lib/media";
import { generateMotion, saveCutout, setMotionApproved } from "@/lib/motion";
import { publishAnimal, updateAnimal } from "@/lib/repo";

const [photo, cutout, green] = process.argv.slice(2);
(async () => {
  if (!photo || !cutout || !green) throw new Error("請提供照片、去背圖和綠幕畫面的路徑");
  const url = await savePhoto("nuanwo", readFileSync(photo));
  await updateAnimal("nuanwo", "afu", { photos: [url], coat: "黑褐色短毛" });
  await publishAnimal("nuanwo", "afu", { keepPublishedAt: true });
  await saveCutout("nuanwo", "afu", readFileSync(cutout));
  const t = Date.now();
  const m = await generateMotion("nuanwo", "afu", readFileSync(green));
  console.log("影片", m.status, `${((Date.now() - t) / 1000).toFixed(0)} 秒`, Object.keys(m.reactions), m.error ?? "");
  if (m.status === "完成") await setMotionApproved("nuanwo", "afu", true);
  process.exit(m.status === "完成" ? 0 : 1);
})().catch((e) => { console.error((e as Error).message); process.exit(1); });
