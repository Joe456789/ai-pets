// 本機開發時，沒有示範帳號就自動寫入虛構的示範資料。正式環境用 npm run demo:seed 手動執行。
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV === "production") return;
  const { getDb, usingFirestore } = await import("@/lib/db");
  if (usingFirestore()) return;
  if (await getDb().get("owners/demo-owner")) return;
  const { seedDemo } = await import("@/demo/seed");
  await seedDemo();
}
