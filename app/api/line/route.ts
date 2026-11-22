import { after, NextResponse } from "next/server";
import { verifySignature } from "@/lib/line/client";
import { handleLineEvents, type LineEvent } from "@/lib/line/handler";
import { getLineCreds } from "@/lib/repo";
import type { LineCreds } from "@/lib/types";

let cache: { creds: LineCreds | null; at: number } | null = null;
async function creds() {
  if (cache && Date.now() - cache.at < 60_000) return cache.creds;
  const creds = await getLineCreds();
  // 只快取讀到的憑證；還沒設定時不快取，剛接上 LINE 就能馬上生效。
  if (creds) cache = { creds, at: Date.now() };
  return creds;
}

// 平台官方帳號的 webhook。
export async function POST(req: Request) {
  const c = await creds();
  const raw = await req.text();
  if (!c || !verifySignature(c.channelSecret, raw, req.headers.get("x-line-signature"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  const events = (JSON.parse(raw) as { events?: LineEvent[] }).events ?? [];
  // LINE 建議非同步處理：先回 200，AI 整理在回應後繼續執行。
  after(() => handleLineEvents(events).catch((e) => console.error("webhook 處理失敗", (e as Error).message)));
  return NextResponse.json({ ok: true });
}
