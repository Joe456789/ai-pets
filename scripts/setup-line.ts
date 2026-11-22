// 把「從此有你」的 LINE 官方帳號接上系統：上傳選單、設定 webhook。
// 用法：npm run setup:line
// 需要 .env.local：LINE_CHANNEL_SECRET、LINE_CHANNEL_ACCESS_TOKEN、APP_URL、LIFF_ID（選單按鈕要開 LIFF 頁）。
import { connectLine } from "@/lib/line/setup";

async function main() {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const appUrl = process.env.APP_URL;
  if (!channelSecret || !channelAccessToken || !appUrl) throw new Error("請先在 .env.local 填好 LINE_CHANNEL_SECRET、LINE_CHANNEL_ACCESS_TOKEN、APP_URL");
  if (!process.env.LIFF_ID) console.warn("提醒：還沒設定 LIFF_ID，選單按鈕會開一般網頁，飼主要另外登入。");
  const r = await connectLine({ channelSecret, channelAccessToken }, appUrl);
  console.log("官方帳號：", r.botName);
  console.log("Webhook：", r.endpoint);
  console.log("Webhook 測試：", r.webhookOk ? "成功" : `失敗（${r.reason}）`);
  process.exit(0);
}

main().catch((e) => { console.error((e as Error).message); process.exit(1); });
