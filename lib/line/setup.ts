import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lineClient } from "@/lib/line/client";
import { ownerMenu } from "@/lib/line/richMenus";
import { getLineCreds, setLineCreds } from "@/lib/repo";

const image = (name: string) => readFileSync(join(/*turbopackIgnore: true*/ process.cwd(), "public", "richmenu", name));

/** 把平台的 LINE 官方帳號接上系統：驗證憑證、上傳選單、設定並測試 webhook。可以重複執行。 */
export async function connectLine(creds: { channelSecret: string; channelAccessToken: string }, appUrl: string) {
  const url = appUrl.replace(/\/$/, "");
  if (!url.startsWith("https://")) throw new Error("網址必須是 https");
  const line = lineClient(creds);
  let botName: string;
  try {
    botName = await line.getBotName();
  } catch {
    throw new Error("Channel access token 無效，請確認有沒有複製完整");
  }

  const old = await getLineCreds();
  const menuId = await line.createRichMenu(ownerMenu());
  await line.uploadRichMenuImage(menuId, image("owner.png"));
  await line.setDefaultRichMenu(menuId);
  if (old?.menuId) await line.deleteRichMenu(old.menuId);

  await setLineCreds({ ...creds, menuId });
  const endpoint = `${url}/api/line`;
  await line.setWebhook(endpoint);
  // 伺服器剛啟動時第一次測試可能逾時，多試兩次。
  let test = await line.testWebhook();
  for (let i = 0; i < 2 && !test.success; i++) test = await line.testWebhook();
  return { botName, endpoint, webhookOk: test.success, reason: test.success ? "" : `${test.statusCode} ${test.reason}` };
}
