"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { connectLineAction, resetManagerPasswordAction } from "@/app/admin/actions";

export function ResetPassword({ email }: { email: string }) {
  const [pw, setPw] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = () => {
    if (!window.confirm(`確定要重設 ${email} 的密碼嗎？舊密碼會立刻失效。`)) return;
    start(async () => {
      const r = await resetManagerPasswordAction(email);
      if (r.ok) setPw(r.data ?? null); else setError(r.error);
    });
  };
  return (
    <span style={{ display: "inline-grid", gap: 6 }}>
      <button className="btn small" disabled={pending} onClick={run}>重設密碼</button>
      {pw && <span className="ok-box">新的臨時密碼（只顯示一次）：<span className="code-pill">{pw}</span></span>}
      {error && <span className="error-box">{error}</span>}
    </span>
  );
}

export function ConnectLine({ sid }: { sid: string }) {
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [token, setToken] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const run = () => start(async () => {
    setMsg(null);
    const r = await connectLineAction(sid, secret, token);
    setMsg(r.ok ? { ok: true, text: r.data ?? "已串接" } : { ok: false, text: r.error });
    if (r.ok) { setSecret(""); setToken(""); router.refresh(); }
  });
  return (
    <div className="stack" style={{ gap: 10 }}>
      <label className="field">Channel secret（LINE Developers → Basic settings）<input value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="off" /></label>
      <label className="field">Channel access token（Messaging API 分頁最下方）<textarea rows={3} value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" /></label>
      <p className="small muted">送出後會自動上傳兩套選單、設定 Webhook 網址並測試。憑證只存在伺服器，之後不會再顯示。</p>
      {msg && <p className={msg.ok ? "ok-box" : "error-box"}>{msg.text}</p>}
      <button className="btn primary" style={{ justifySelf: "start" }} disabled={pending || !secret || !token} onClick={run}>{pending ? "串接中，約需 10 秒…" : "串接並設定選單"}</button>
    </div>
  );
}
