// 把一個協會的 LINE 官方帳號接上系統（也可以在總後台的協會頁面操作）。
// 用法：npm run setup:line -- <協會ID>（預設 nuanwo）
// 需要 .env.local：LINE_CHANNEL_SECRET、LINE_CHANNEL_ACCESS_TOKEN、APP_URL。
import { connectLine } from "@/lib/line/setup";
import { getShelter } from "@/lib/repo";

async function main() {
  const sid = process.argv[2] ?? "nuanwo";
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const appUrl = process.env.APP_URL;
  if (!channelSecret || !channelAccessToken || !appUrl) throw new Error("請先在 .env.local 填好 LINE_CHANNEL_SECRET、LINE_CHANNEL_ACCESS_TOKEN、APP_URL");
  if (!(await getShelter(sid))) throw new Error(`找不到協會 ${sid}，請先執行 npm run seed`);
  const r = await connectLine(sid, { channelSecret, channelAccessToken }, appUrl);
  console.log("官方帳號：", r.botName);
  console.log("Webhook：", r.endpoint);
  console.log("Webhook 測試：", r.webhookOk ? "成功" : `失敗（${r.reason}）`);
}

main().catch((e) => { console.error((e as Error).message); process.exit(1); });
