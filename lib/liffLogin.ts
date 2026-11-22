"use client";

export type LiffLogin = { status: "ok" } | { status: "needs-login"; inClient: boolean; login: () => void };

/**
 * 用 LIFF 拿到 ID token 交給伺服器驗證，伺服器換發自己的登入 cookie（會蓋掉原本的示範帳號）。
 * 在 LINE 裡沒登入就直接走 LINE 登入；在一般瀏覽器則回傳登入函式，讓使用者自己按。
 */
export async function liffLogin(liffId: string): Promise<LiffLogin> {
  const liff = (await import("@line/liff")).default;
  await liff.init({ liffId });
  if (!liff.isLoggedIn()) {
    const login = () => liff.login({ redirectUri: location.href });
    if (liff.isInClient()) login();
    return { status: "needs-login", inClient: liff.isInClient(), login };
  }
  const res = await fetch("/api/auth/liff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: liff.getIDToken() }) });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "登入失敗");
  return { status: "ok" };
}
