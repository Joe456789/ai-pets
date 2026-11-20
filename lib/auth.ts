import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/platform";
import { getManager, getShelter } from "@/lib/repo";

const COOKIE = "ll_session";
const MAX_AGE = 60 * 60 * 12;

export type Role = "manager" | "admin";
type Session = { email: string; sid: string; role: Role; exp: number };

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
    return p.exp > Date.now() / 1000 && (p.role === "manager" || p.role === "admin") ? p : null;
  } catch {
    return null;
  }
}

export async function startSession(email: string, sid: string, role: Role) {
  const store = await cookies();
  store.set(COOKIE, signSession({ email, sid, role, exp: Math.floor(Date.now() / 1000) + MAX_AGE }), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_AGE,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

const current = async () => readSession((await cookies()).get(COOKIE)?.value);

/** 所有協會後台的頁面和動作都先呼叫它，協會 ID 只從登入狀態取得，不信任網址或表單。 */
export async function requireManager() {
  const session = await current();
  if (!session || session.role !== "manager") redirect("/login/shelter");
  const manager = await getManager(session.email);
  if (!manager || manager.sid !== session.sid) redirect("/login/shelter");
  const shelter = await getShelter(manager.sid);
  if (!shelter || shelter.status === "已停用") redirect("/login/shelter?off=1");
  return { sid: manager.sid, name: manager.name, email: manager.email };
}

/** 平台總後台專用，和協會管理者是不同的帳號。 */
export async function requireAdmin() {
  const session = await current();
  if (!session || session.role !== "admin") redirect("/login/admin");
  const admin = await getAdmin(session.email);
  if (!admin) redirect("/login/admin");
  return { email: admin.email, name: admin.name };
}
