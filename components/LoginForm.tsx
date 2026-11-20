"use client";
import Link from "next/link";
import { useActionState, useState } from "react";

export function LoginForm({ action, title, note, notice, other }: {
  action: (prev: string | null, form: FormData) => Promise<string | null>;
  title: string; note: string; notice?: string; other: { href: string; label: string };
}) {
  const [error, run, pending] = useActionState(action, null);
  const [email, setEmail] = useState("");
  return (
    <main className="login">
      <form className="login-card" action={run}>
        <Link href="/" className="logo-mark" aria-label="回首頁">浪</Link>
        <h1>{title}</h1>
        <p className="muted small">{note}</p>
        {notice && !error && <p className="error-box">{notice}</p>}
        {error && <p className="error-box" role="alert">{error}</p>}
        <label className="field">電子郵件<input name="email" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="field">密碼<input name="password" type="password" required autoComplete="current-password" /></label>
        <button className="btn primary" disabled={pending}>{pending ? "登入中…" : "登入"}</button>
        <Link href={other.href} className="small muted" style={{ textAlign: "center" }}>{other.label}</Link>
      </form>
    </main>
  );
}
