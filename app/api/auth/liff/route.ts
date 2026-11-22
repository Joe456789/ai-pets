import { NextResponse } from "next/server";
import { startSession } from "@/lib/auth";
import { ensureOwner } from "@/lib/repo";

/**
 * LIFF 登入：網頁把 LIFF 給的 ID token 送來，這裡向 LINE 驗證後發登入 cookie。
 * 只相信 LINE 驗證回來的 sub（使用者 ID），不相信網頁自己傳的任何身分資料。
 */
export async function POST(req: Request) {
  const clientId = process.env.LINE_LOGIN_CHANNEL_ID;
  if (!clientId) return NextResponse.json({ error: "尚未設定 LINE 登入" }, { status: 503 });
  const { idToken } = (await req.json().catch(() => ({}))) as { idToken?: string };
  if (!idToken || idToken.length > 4096) return NextResponse.json({ error: "缺少登入資訊" }, { status: 400 });
  const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: clientId }),
  });
  if (!res.ok) return NextResponse.json({ error: "LINE 登入驗證失敗，請重新開啟" }, { status: 401 });
  const p = (await res.json()) as { sub?: string; name?: string };
  if (!p.sub || !/^U[0-9a-f]{32}$/.test(p.sub)) return NextResponse.json({ error: "LINE 登入驗證失敗" }, { status: 401 });
  await ensureOwner(p.sub, p.name ?? "");
  await startSession(p.sub);
  return NextResponse.json({ ok: true });
}
