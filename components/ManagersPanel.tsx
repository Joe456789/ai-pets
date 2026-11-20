"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addManagerAction, removeManagerAction } from "@/app/shelter/actions";

export function ManagersPanel({ managers, self, limit, canAdd }: { managers: { email: string; name: string }[]; self: string; limit: number; canAdd: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const add = () => start(async () => {
    setError(null);
    const r = await addManagerAction({ email, name });
    if (!r.ok) { setError(r.error); return; }
    setCreated({ email: email.trim().toLowerCase(), password: r.data! });
    setEmail(""); setName("");
    router.refresh();
  });
  const remove = (m: string) => {
    if (!window.confirm(`確定移除 ${m}？對方將無法再登入。`)) return;
    start(async () => { const r = await removeManagerAction(m); if (!r.ok) setError(r.error); router.refresh(); });
  };
  return (
    <section className="card">
      <h2>管理者帳號（{managers.length} / {limit}）</h2>
      {managers.map((m) => (
        <div className="todo" key={m.email}>
          <span>{m.name}<br /><span className="small muted">{m.email}{m.email === self ? "（你）" : ""}</span></span>
          {m.email !== self && <button className="btn small" disabled={pending} onClick={() => remove(m.email)}>移除</button>}
        </div>
      ))}
      {limit > 1 ? (
        managers.length < limit && (
          <div className="stack" style={{ gap: 8, marginTop: 10 }}>
            <div className="form-grid">
              <label className="field">姓名<input value={name} onChange={(e) => setName(e.target.value)} /></label>
              <label className="field">電子郵件<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            </div>
            <button className="btn small primary" style={{ justifySelf: "start" }} disabled={pending || !email || !canAdd} onClick={add}>新增管理者</button>
          </div>
        )
      ) : (
        <p className="small muted" style={{ marginTop: 8 }}>新增其他管理者是進階方案的功能。</p>
      )}
      {created && <p className="ok-box" style={{ marginTop: 10 }}>已新增 {created.email}，臨時密碼（只顯示一次）：<span className="code-pill">{created.password}</span></p>}
      {error && <p className="error-box" style={{ marginTop: 10 }}>{error}</p>}
    </section>
  );
}
