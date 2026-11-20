"use server";
import { redirect } from "next/navigation";
import { endSession, startSession } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { getManager, getShelter } from "@/lib/repo";

// 同一個帳號連續輸錯就暫停，降低被猜密碼的風險。
const fails = new Map<string, { n: number; until: number }>();
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

export async function loginAction(_prev: string | null, form: FormData): Promise<string | null> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const f = fails.get(email);
  if (f && f.n >= MAX_FAILS && f.until > Date.now()) return "嘗試次數太多，請 15 分鐘後再試。";

  const manager = email ? await getManager(email) : null;
  if (!manager || !verifyPassword(password, manager.passwordHash)) {
    const next = f && f.until > Date.now() ? f.n + 1 : 1;
    fails.set(email, { n: next, until: Date.now() + LOCK_MS });
    return "電子郵件或密碼不正確。";
  }
  fails.delete(email);
  const shelter = await getShelter(manager.sid);
  if (!shelter || shelter.status === "已停用") return "這個協會的服務目前已暫停，請聯絡平台管理者。";
  await startSession(manager.email, manager.sid, "manager");
  redirect("/shelter");
}

export async function logoutAction() {
  await endSession();
  redirect("/login/shelter");
}
