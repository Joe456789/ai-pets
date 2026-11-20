"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createShelterAction } from "@/app/admin/actions";

const empty = { id: "", name: "", area: "", codePrefix: "", plan: "試用" as const, due: "", managerEmail: "", managerName: "" };

export function NewShelterForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<typeof empty | { plan: "試用" | "基本" | "進階" } & Omit<typeof empty, "plan">>(empty);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; email: string; password: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof empty, v: string) => setF({ ...f, [k]: v });

  if (done) {
    return (
      <section className="card ok-box" style={{ marginBottom: 16 }}>
        <b>已開通。</b>請把登入資訊交給協會管理者，臨時密碼只會顯示這一次：<br />
        網址：/login/shelter<br />帳號：{done.email}<br />臨時密碼：<span className="code-pill">{done.password}</span><br />
        <div className="row" style={{ marginTop: 10 }}>
          <Link className="btn small primary" href={`/admin/shelters/${done.id}`}>接著串接 LINE</Link>
          <button className="btn small" onClick={() => { setDone(null); setOpen(false); }}>關閉</button>
        </div>
      </section>
    );
  }
  if (!open) return <button className="btn primary" style={{ marginBottom: 16 }} onClick={() => setOpen(true)}>開通新協會</button>;

  const submit = () => start(async () => {
    setError(null);
    const r = await createShelterAction(f);
    if (!r.ok) { setError(r.error); return; }
    setDone({ id: r.data!.id, email: f.managerEmail.trim().toLowerCase(), password: r.data!.password });
    setF(empty);
    router.refresh();
  });
  const input = (k: keyof typeof empty, label: string, placeholder = "", type = "text") => (
    <label className="field">{label}<input type={type} value={f[k]} placeholder={placeholder} onChange={(e) => set(k, e.target.value)} /></label>
  );
  return (
    <section className="card stack" style={{ gap: 12, marginBottom: 16 }}>
      <h2 style={{ margin: 0 }}>開通新協會</h2>
      <div className="form-grid">
        {input("name", "協會名稱", "例如：暖窩動物協會")}
        {input("id", "協會代號（網址用）", "例如：nuanwo")}
        {input("area", "地區", "例如：新北市")}
        {input("codePrefix", "動物編號開頭", "例如：NW")}
        <label className="field">方案<select value={f.plan} onChange={(e) => set("plan", e.target.value)}><option>試用</option><option>基本</option><option>進階</option></select></label>
        {input("due", f.plan === "試用" ? "到期日（不填＝30 天後）" : "到期日", "", "date")}
        {input("managerName", "管理者姓名")}
        {input("managerEmail", "管理者電子郵件", "", "email")}
      </div>
      {error && <p className="error-box">{error}</p>}
      <div className="row">
        <button className="btn primary" disabled={pending} onClick={submit}>{pending ? "開通中…" : "開通並產生臨時密碼"}</button>
        <button className="btn" onClick={() => setOpen(false)}>取消</button>
      </div>
    </section>
  );
}
