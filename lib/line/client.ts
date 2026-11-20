import { createHmac, timingSafeEqual } from "node:crypto";
import type { LineCreds } from "@/lib/types";

const API = "https://api.line.me";
const DATA_API = "https://api-data.line.me";

export function verifySignature(channelSecret: string, rawBody: string, signature: string | null) {
  if (!signature) return false;
  const expected = createHmac("sha256", channelSecret).update(rawBody).digest();
  const given = Buffer.from(signature, "base64");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export type LineClient = ReturnType<typeof lineClient>;
export type LineMessage = Record<string, unknown>;

async function assertOk(res: Response, what: string) {
  if (!res.ok) throw new LineApiError(`${what} 失敗：${res.status} ${await res.text()}`, res.status);
  return res;
}

export class LineApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export function lineClient(creds: Pick<LineCreds, "channelAccessToken">) {
  const headers = { Authorization: `Bearer ${creds.channelAccessToken}` };
  const json = { ...headers, "Content-Type": "application/json" };
  const post = (url: string, body: unknown) => fetch(url, { method: "POST", headers: json, body: JSON.stringify(body) });

  const client = {
    async push(to: string, messages: LineMessage[]) {
      await assertOk(await post(`${API}/v2/bot/message/push`, { to, messages }), "推播訊息");
    },
    /** 回覆不計入每月訊息額度。AI 處理太久導致 reply token 失效時，才改用會計入額度的推播。 */
    async reply(replyToken: string, userId: string, messages: LineMessage[]) {
      const res = await post(`${API}/v2/bot/message/reply`, { replyToken, messages });
      if (res.ok) return;
      if (res.status === 400) { await client.push(userId, messages); return; }
      await assertOk(res, "回覆訊息");
    },
    async getContent(messageId: string) {
      // 大型語音檔可能還在準備中，LINE 會回 202。
      for (let i = 0; i < 6; i++) {
        const res = await fetch(`${DATA_API}/v2/bot/message/${messageId}/content`, { headers });
        if (res.status === 202) { await new Promise((r) => setTimeout(r, 1000)); continue; }
        await assertOk(res, "下載訊息內容");
        return { buffer: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get("content-type") ?? "application/octet-stream" };
      }
      throw new Error("訊息內容一直沒有準備好");
    },
    async showLoading(chatId: string, loadingSeconds = 30) {
      await post(`${API}/v2/bot/chat/loading/start`, { chatId, loadingSeconds }).catch(() => undefined);
    },
    async getDisplayName(userId: string) {
      const res = await fetch(`${API}/v2/bot/profile/${userId}`, { headers });
      if (!res.ok) return null;
      return ((await res.json()) as { displayName?: string }).displayName ?? null;
    },
    async linkRichMenu(userId: string, richMenuId: string) {
      await assertOk(await fetch(`${API}/v2/bot/user/${userId}/richmenu/${richMenuId}`, { method: "POST", headers }), "連結選單");
    },
    async unlinkRichMenu(userId: string) {
      await assertOk(await fetch(`${API}/v2/bot/user/${userId}/richmenu`, { method: "DELETE", headers }), "解除選單");
    },
    async createRichMenu(menu: unknown) {
      const res = await assertOk(await post(`${API}/v2/bot/richmenu`, menu), "建立選單");
      return ((await res.json()) as { richMenuId: string }).richMenuId;
    },
    async uploadRichMenuImage(richMenuId: string, png: Buffer) {
      await assertOk(await fetch(`${DATA_API}/v2/bot/richmenu/${richMenuId}/content`, {
        method: "POST", headers: { ...headers, "Content-Type": "image/png" }, body: new Uint8Array(png),
      }), "上傳選單圖片");
    },
    async deleteRichMenu(richMenuId: string) {
      await fetch(`${API}/v2/bot/richmenu/${richMenuId}`, { method: "DELETE", headers });
    },
    async setDefaultRichMenu(richMenuId: string) {
      await assertOk(await fetch(`${API}/v2/bot/user/all/richmenu/${richMenuId}`, { method: "POST", headers }), "設定預設選單");
    },
    async setWebhook(endpoint: string) {
      await assertOk(await fetch(`${API}/v2/bot/channel/webhook/endpoint`, { method: "PUT", headers: json, body: JSON.stringify({ endpoint }) }), "設定 Webhook");
    },
    async testWebhook() {
      const res = await assertOk(await post(`${API}/v2/bot/channel/webhook/test`, {}), "測試 Webhook");
      return (await res.json()) as { success: boolean; statusCode: number; reason: string };
    },
    async getBotName() {
      const res = await assertOk(await fetch(`${API}/v2/bot/info`, { headers }), "讀取帳號資訊");
      return ((await res.json()) as { displayName: string }).displayName;
    },
  };
  return client;
}
