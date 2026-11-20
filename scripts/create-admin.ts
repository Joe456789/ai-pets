// 建立或更新平台總後台的管理者帳號。
// 用法：npm run create-admin（讀取 .env.local 的 ADMIN_EMAIL、ADMIN_PASSWORD、ADMIN_NAME）
import { hashPassword } from "@/lib/password";
import { setAdmin } from "@/lib/platform";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error("請先在 .env.local 設定 ADMIN_EMAIL 和 ADMIN_PASSWORD");
  if (password.length < 12) throw new Error("ADMIN_PASSWORD 至少要 12 個字元");
  await setAdmin({ email, name: process.env.ADMIN_NAME ?? "平台管理者", passwordHash: hashPassword(password) });
  console.log("平台管理者已建立：", email);
  process.exit(0);
}

main().catch((e) => { console.error((e as Error).message); process.exit(1); });
