// 只補上虛構的歷史紀錄（已領養動物、收費、公告），不會覆蓋其他資料。
import { seedHistory } from "@/demo/seed";

seedHistory().then(() => { console.log("歷史示範資料已寫入"); process.exit(0); }).catch((e) => { console.error((e as Error).message); process.exit(1); });
