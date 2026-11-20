// 本機開發時，資料庫是空的就自動放入虛構的示範資料。正式環境用 scripts/seed.ts 手動執行。
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.GOOGLE_CLOUD_PROJECT || process.env.NODE_ENV === "production") return;
  const { getDb } = await import("@/lib/db");
  if ((await getDb().list("shelters")).length > 0) return;
  const { seedDemo } = await import("@/demo/seed");
  await seedDemo(process.env.DEMO_MANAGER_PASSWORD ?? "langlang-demo");
}
