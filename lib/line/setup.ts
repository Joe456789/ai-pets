import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lineClient } from "@/lib/line/client";
import { adopterMenu, staffMenu } from "@/lib/line/richMenus";
import { getLineCreds, listStaff, setLineCreds } from "@/lib/repo";

const image = (name: string) => readFileSync(join(/*turbopackIgnore: true*/ process.cwd(), "public", "richmenu", name));

/** 把協會的官方帳號接上系統：驗證憑證、上傳兩套選單、設定並測試 webhook。可以重複執行。 */
export async function connectLine(sid: string, creds: { channelSecret: string; channelAccessToken: string }, appUrl: string) {
  const url = appUrl.replace(/\/$/, "");
  if (!url.startsWith("https://")) throw new Error("網址必須是 https");
  const line = lineClient(creds);
  let botName: string;
  try {
    botName = await line.getBotName();
  } catch {
    throw new Error("Channel access token 無效，請確認有沒有複製完整");
  }

  const old = await getLineCreds(sid);
  const staffMenuId = await line.createRichMenu(staffMenu());
  await line.uploadRichMenuImage(staffMenuId, image("staff.png"));
  const adopterMenuId = await line.createRichMenu(adopterMenu(url, sid));
  await line.uploadRichMenuImage(adopterMenuId, image("adopter.png"));
  await line.setDefaultRichMenu(adopterMenuId);

  for (const s of await listStaff(sid)) {
    if (s.lineUserId && !s.disabled) await line.linkRichMenu(s.lineUserId, staffMenuId).catch(() => undefined);
  }
  for (const id of [old?.staffMenuId, old?.adopterMenuId]) if (id) await line.deleteRichMenu(id);

  await setLineCreds(sid, { ...creds, staffMenuId, adopterMenuId });
  const endpoint = `${url}/api/line/${sid}`;
  await line.setWebhook(endpoint);
  // 伺服器剛啟動時第一次測試可能逾時，多試兩次。
  let test = await line.testWebhook();
  for (let i = 0; i < 2 && !test.success; i++) test = await line.testWebhook();
  return { botName, endpoint, webhookOk: test.success, reason: test.success ? "" : `${test.statusCode} ${test.reason}` };
}

/** 讀取 LINE 端目前的 webhook 狀態，給系統狀態頁使用。 */
export async function lineStatus(sid: string) {
  const creds = await getLineCreds(sid);
  if (!creds) return { connected: false as const };
  try {
    const res = await fetch("https://api.line.me/v2/bot/channel/webhook/endpoint", { headers: { Authorization: `Bearer ${creds.channelAccessToken}` } });
    if (!res.ok) return { connected: true as const, ok: false, detail: `LINE 回應 ${res.status}` };
    const j = (await res.json()) as { endpoint?: string; active?: boolean };
    return { connected: true as const, ok: Boolean(j.active), detail: j.active ? "Webhook 已啟用" : "Webhook 未啟用，請到 LINE Developers 開啟 Use webhook" };
  } catch (e) {
    return { connected: true as const, ok: false, detail: (e as Error).message };
  }
}
