import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { DEMO_UID, isDemo } from "@/lib/repo";

// 飼主用 LINE 身分登入（LIFF），伺服器驗證後發這個 cookie。內容只有 LINE 使用者 ID 和到期時間。
const COOKIE = "cy_session";
const MAX_AGE = 60 * 60 * 24 * 30;

type Session = { uid: string; role: "owner"; exp: number };

function secret() {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("缺少 SESSION_SECRET");
  return "dev-only-session-secret";
}

export function signSession(payload: Session) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${createHmac("sha256", secret()).update(body).digest("base64url")}`;
}

export function readSession(token: string | undefined): Session | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret()).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as Session;
    return p.exp > Date.now() / 1000 && p.role === "owner" && typeof p.uid === "string" ? p : null;
  } catch {
    return null;
  }
}

export async function startSession(uid: string) {
  (await cookies()).set(COOKIE, signSession({ uid, role: "owner", exp: Math.floor(Date.now() / 1000) + MAX_AGE }), {
    // LIFF 在 LINE 內建瀏覽器開啟，同網域即可，不需要第三方 cookie。
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_AGE,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

/** 目前登入的飼主 ID，沒登入回 null。頁面用它決定要不要顯示登入。 */
export async function currentUid() {
  return readSession((await cookies()).get(COOKIE)?.value)?.uid ?? null;
}

export class NotSignedIn extends Error {}
export class DemoReadOnly extends Error {}

/** 會修改資料的動作都先呼叫它。示範帳號只能看。 */
export async function requireWriter() {
  const uid = await currentUid();
  if (!uid) throw new NotSignedIn("請先用 LINE 登入");
  if (isDemo(uid)) throw new DemoReadOnly("這是示範帳號，只能瀏覽。加入 LINE 好友就能建立自己的紀錄。");
  return uid;
}

export const startDemoSession = () => startSession(DEMO_UID);

/*
 * 「用手機瀏覽器開」：LINE 裡的瀏覽器不能偵測地板，要跳到 Chrome／Safari 開 AR，
 * 但那邊沒有登入的 cookie，所以發一張只能看這一個紀念、2 小時內有效的票。
 */
const TICKET_TTL = 2 * 60 * 60;
const ticketSig = (body: string) => createHmac("sha256", secret()).update(`ar-ticket:${body}`).digest();

export function signArTicket(memorialId: string, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ m: memorialId, exp: Math.floor(now / 1000) + TICKET_TTL })).toString("base64url");
  return `${body}.${ticketSig(body).toString("base64url")}`;
}

export function readArTicket(token: string | undefined, memorialId: string, now = Date.now()) {
  if (!token) return false;
  const [body, sig] = token.split(".");
  if (!body || !sig) return false;
  const given = Buffer.from(sig, "base64url");
  const expected = ticketSig(body);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as { m?: unknown; exp?: unknown };
    return p.m === memorialId && typeof p.exp === "number" && p.exp > now / 1000;
  } catch {
    return false;
  }
}
