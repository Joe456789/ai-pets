// 寫入（或更新）示範帳號的虛構資料。本機：LL_LOCAL_DATA=1 npm run demo:seed；正式：設定 GOOGLE_CLOUD_PROJECT 與 GCS_BUCKET 後執行。
import { seedDemo } from "@/demo/seed";

// 寫到正式的 Firestore 卻沒設 GCS_BUCKET 時，照片會存在這台電腦，正式站就讀不到。
if (process.env.GOOGLE_CLOUD_PROJECT && !process.env.LL_LOCAL_DATA && !process.env.GCS_BUCKET) {
  console.error("要寫入正式資料庫時，請一起設定 GCS_BUCKET，示範照片才會存到雲端。");
  process.exit(1);
}

seedDemo().then(() => { console.log("示範資料已更新"); process.exit(0); }).catch((e) => { console.error((e as Error).message); process.exit(1); });
