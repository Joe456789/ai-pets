import { after, NextResponse } from "next/server";
import { verifySignature } from "@/lib/line/client";
import { handleLineEvents, type LineEvent } from "@/lib/line/handler";
import { getLineCreds } from "@/lib/repo";
import type { LineCreds } from "@/lib/types";

const cache = new Map<string, { creds: LineCreds | null; at: number }>();
async function credsOf(sid: string) {
  const hit = cache.get(sid);
  if (hit && Date.now() - hit.at < 60_000) return hit.creds;
  const creds = await getLineCreds(sid);
  cache.set(sid, { creds, at: Date.now() });
  return creds;
}

// 每個協會的官方帳號有自己的 webhook 網址：/api/line/<協會ID>
export async function POST(req: Request, { params }: { params: Promise<{ shelterId: string }> }) {
  const { shelterId } = await params;
  const creds = await credsOf(shelterId);
  const raw = await req.text();
  // 找不到協會和簽章錯誤回同一個狀態，不透露哪些協會存在。
  if (!creds || !verifySignature(creds.channelSecret, raw, req.headers.get("x-line-signature"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  const events = (JSON.parse(raw) as { events?: LineEvent[] }).events ?? [];
  // LINE 建議非同步處理：先回 200，AI 整理在回應後繼續執行。
  after(() => handleLineEvents(shelterId, events).catch((e) => console.error("webhook 處理失敗", shelterId, (e as Error).message)));
  return NextResponse.json({ ok: true });
}
