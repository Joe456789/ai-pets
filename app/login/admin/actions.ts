"use server";
import { redirect } from "next/navigation";
import { endSession, startSession } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { getAdmin } from "@/lib/platform";

const fails = new Map<string, { n: number; until: number }>();
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

export async function adminLoginAction(_prev: string | null, form: FormData): Promise<string | null> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const f = fails.get(email);
  if (f && f.n >= MAX_FAILS && f.until > Date.now()) return "嘗試次數太多，請 15 分鐘後再試。";
  const admin = email ? await getAdmin(email) : null;
  if (!admin || !verifyPassword(password, admin.passwordHash)) {
    fails.set(email, { n: f && f.until > Date.now() ? f.n + 1 : 1, until: Date.now() + LOCK_MS });
    return "電子郵件或密碼不正確。";
  }
  fails.delete(email);
  await startSession(admin.email, "", "admin");
  redirect("/admin");
}

export async function adminLogoutAction() {
  await endSession();
  redirect("/login/admin");
}
