"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { liffLogin } from "@/lib/liffLogin";

/**
 * 需要登入的頁面顯示這個。在 LINE 裡打開（LIFF）會自動登入；在一般瀏覽器可以按「用 LINE 登入」，或先看示範。
 * 登入只把 LIFF 的 ID token 交給伺服器驗證，網頁本身不保存任何身分資料。
 * 在 LINE 裡不提供示範帳號：已經加好友的人應該用自己的帳號記錄。
 */
export function SignIn({ liffId, devLogin, what, app }: { liffId: string | null; devLogin: boolean; what: string; app: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "working" | "error">(liffId ? "working" : "idle");
  const [error, setError] = useState("");
  const [login, setLogin] = useState<null | (() => void)>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!liffId) return;
    let cancelled = false;
    liffLogin(liffId).then(
      (r) => {
        if (cancelled) return;
        if (r.status === "ok") { router.refresh(); return; }
        if (r.inClient) return; // 已經跳去 LINE 登入
        setLogin(() => r.login);
        setState("idle");
      },
      (e) => { if (!cancelled) { setError((e as Error).message); setState("error"); } },
    );
    return () => { cancelled = true; };
  }, [liffId, router, attempt]);

  const dev = async () => {
    setState("working");
    await fetch("/api/auth/dev", { method: "POST" });
    router.refresh();
  };

  return (
    <div className="card empty stack" style={{ justifyItems: "center" }}>
      <h2 style={{ margin: 0 }}>{state === "working" ? "正在用 LINE 登入…" : `登入後就能${what}`}</h2>
      {state !== "working" && <p className="small muted">資料都存在你自己的帳號底下，只有你看得到。</p>}
      {state === "error" && <p className="error-box">{error}</p>}
      {state !== "working" && (
        <div className="row" style={{ justifyContent: "center" }}>
          {login && <button className="btn primary" onClick={login}>用 LINE 登入</button>}
          {state === "error" && liffId && <button className="btn primary" onClick={() => { setState("working"); setAttempt((n) => n + 1); }}>再試一次</button>}
          {!app && <Link className="btn" href="/demo">先看示範帳號</Link>}
          {devLogin && <button className="btn small" onClick={dev}>本機測試登入</button>}
        </div>
      )}
    </div>
  );
}
