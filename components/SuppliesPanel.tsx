"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addSupplyAction, deleteSupplyAction, setPledgeAction, supplyPostAction, updateSupplyAction } from "@/app/shelter/actions";
import { Badge } from "@/components/ui";
import type { PledgeDoc, PledgeStatus, SupplyDoc } from "@/lib/supplies";
import { fmtDate } from "@/lib/time";

type R = { ok: true; data?: string } | { ok: false; error: string };

export function SuppliesPanel({ supplies, pledges, publicUrl }: { supplies: SupplyDoc[]; pledges: PledgeDoc[]; publicUrl: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [post, setPost] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ name: "", need: "10", unit: "包", note: "", urgent: false });

  const run = (fn: () => Promise<R>, after?: (r: R) => void) => start(async () => {
    setError(null);
    const r = await fn();
    if (!r.ok) setError(r.error);
    after?.(r);
    router.refresh();
  });
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    run(() => addSupplyAction({ ...form, need: Number(form.need) }), (r) => { if (r.ok) setForm({ name: "", need: "10", unit: "包", note: "", urgent: false }); });
  };
  const writePost = () => run(supplyPostAction, (r) => { if (r.ok) { setPost(r.data ?? ""); setCopied(false); } });
  const copy = async () => { if (post) { await navigator.clipboard.writeText(post).catch(() => undefined); setCopied(true); } };
  const waiting = pledges.filter((p) => p.status === "待確認");
  const pledgedOf = (id: string) => waiting.filter((p) => p.supplyId === id).reduce((n, p) => n + p.qty, 0);
  const setPledge = (id: string, status: PledgeStatus) => run(() => setPledgeAction(id, status));

  return (
    <div className="stack">
      {error && <p className="error-box" role="alert">{error}</p>}
      <div className="grid-2">
        <form className="card stack" style={{ gap: 10 }} onSubmit={add}>
          <h2 style={{ margin: 0 }}>新增需要的物資</h2>
          <label className="field">品項<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="例如：成犬乾糧、尿布墊" maxLength={40} required /></label>
          <div className="form-grid">
            <label className="field">需要數量<input type="number" min={1} max={9999} value={form.need} onChange={(e) => setForm({ ...form, need: e.target.value })} required /></label>
            <label className="field">單位<input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="包、箱、片" maxLength={6} required /></label>
          </div>
          <label className="field">規格或備註（會公開）<input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="例如：15 公斤裝、未開封、效期半年以上" maxLength={80} /></label>
          <label className="check-row"><input type="checkbox" checked={form.urgent} onChange={(e) => setForm({ ...form, urgent: e.target.checked })} /><span>急需（公開頁會排在最前面）</span></label>
          <button className="btn primary" disabled={pending} style={{ justifySelf: "start" }}>新增</button>
        </form>
        <section className="card">
          <div className="row between" style={{ marginBottom: 8 }}>
            <span className="ai-tag">AI 募集貼文</span>
            <button className="btn small" disabled={pending} onClick={writePost}>{pending ? "處理中…" : post ? "重新寫一則" : "請 AI 寫貼文"}</button>
          </div>
          {post
            ? <><div className="summary-box" style={{ whiteSpace: "pre-wrap" }}>{post}</div><button className="btn small" style={{ marginTop: 8 }} onClick={copy}>{copied ? "已複製" : "複製貼文"}</button></>
            : <p className="small muted">依目前還缺的品項和數量寫一則臉書或 LINE 群組貼文，附上登記捐贈的連結。發出前請再確認內容。</p>}
          <p className="small muted" style={{ marginTop: 10 }}>公開登記頁：<a href={publicUrl} target="_blank" rel="noreferrer">{publicUrl}</a></p>
        </section>
      </div>

      <section className="card table-wrap">
        <h2>物資清單</h2>
        <table>
          <thead><tr><th>品項</th><th className="num">需要</th><th className="num">已收到</th><th className="num">已登記待收</th><th>狀態</th><th></th></tr></thead>
          <tbody>
            {supplies.map((s) => (
              <tr key={s.id} className={s.status === "已足夠" ? "muted" : ""}>
                <td><b>{s.name}</b>{s.urgent && s.status === "需要" && <> <Badge tone="warn">急需</Badge></>}{s.note && <><br /><span className="small muted">{s.note}</span></>}</td>
                <td className="num">{s.need} {s.unit}</td>
                <td className="num">{s.got} {s.unit}</td>
                <td className="num">{pledgedOf(s.id) || "—"}</td>
                <td><Badge tone={s.status === "需要" ? "info" : "good"}>{s.status}</Badge></td>
                <td>
                  <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                    {s.status === "需要"
                      ? <button className="btn small" disabled={pending} onClick={() => run(() => updateSupplyAction(s.id, { status: "已足夠" }))}>已足夠</button>
                      : <button className="btn small" disabled={pending} onClick={() => run(() => updateSupplyAction(s.id, { status: "需要", got: 0 }))}>重新募集</button>}
                    {s.status === "需要" && <button className="btn small" disabled={pending} onClick={() => run(() => updateSupplyAction(s.id, { urgent: !s.urgent }))}>{s.urgent ? "取消急需" : "設為急需"}</button>}
                    <button className="btn small" disabled={pending} onClick={() => { if (window.confirm(`刪除「${s.name}」？`)) run(() => deleteSupplyAction(s.id)); }}>刪除</button>
                  </div>
                </td>
              </tr>
            ))}
            {supplies.length === 0 && <tr><td colSpan={6} className="muted">還沒有物資需求。新增後會出現在協會的公開頁，民眾可以登記捐贈。</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="card table-wrap">
        <div className="row between"><h2>捐贈登記</h2><span className="small muted">捐贈人的聯絡方式只有協會管理者看得到</span></div>
        <table>
          <thead><tr><th>日期</th><th>捐贈人</th><th>聯絡方式</th><th>品項</th><th className="num">數量</th><th>備註</th><th>狀態</th><th></th></tr></thead>
          <tbody>
            {pledges.map((p) => (
              <tr key={p.id} className={p.status === "取消" ? "muted" : ""}>
                <td>{fmtDate(p.createdAt)}</td>
                <td>{p.who}</td>
                <td>{p.contact}</td>
                <td>{p.supplyName}</td>
                <td className="num">{p.qty} {p.unit}</td>
                <td className="small">{p.note || "—"}</td>
                <td><Badge tone={p.status === "已收到" ? "good" : p.status === "待確認" ? "warn" : "muted"}>{p.status}</Badge></td>
                <td>
                  {p.status === "待確認" && (
                    <div className="row" style={{ gap: 6 }}>
                      <button className="btn small primary" disabled={pending} onClick={() => setPledge(p.id, "已收到")}>已收到</button>
                      <button className="btn small" disabled={pending} onClick={() => setPledge(p.id, "取消")}>取消</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {pledges.length === 0 && <tr><td colSpan={8} className="muted">還沒有人登記捐贈。</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
