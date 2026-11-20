// 把虛構的示範資料寫進目前設定的資料庫（Firestore 或本機檔案）。
// 用法：npm run seed
import { DEMO_MANAGER_EMAIL, seedDemo } from "@/demo/seed";

async function main() {
  const password = process.env.DEMO_MANAGER_PASSWORD;
  if (!password) throw new Error("請先在 .env.local 設定 DEMO_MANAGER_PASSWORD");
  await seedDemo(password);
  console.log("示範資料已寫入。管理者帳號：", DEMO_MANAGER_EMAIL);
  process.exit(0);
}

main().catch((e) => { console.error((e as Error).message); process.exit(1); });
