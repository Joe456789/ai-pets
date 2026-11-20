"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { completeAdoptionAction, setApplicationStatusAction } from "@/app/shelter/actions";
import { Badge } from "@/components/ui";
import { fmtDate } from "@/lib/time";
import type { ApplicationDoc, ApplicationStatus } from "@/lib/types";

const OPEN: ApplicationStatus[] = ["待審核", "面談中"];

export function ApplicationsPanel({ applications, adopted }: { applications: ApplicationDoc[]; adopted: string[] }) {
  const router = useRouter();
  const [sel, setSel] = useState(applications[0]?.id);
  const [notify, setNotify] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const ap = applications.find((a) => a.id === sel);
  if (!ap) return <p className="muted">目前還沒有領養申請。</p>;
  const done = adopted.includes(ap.animalId);
  const others = applications.filter((a) => a.animalId === ap.animalId && a.id !== ap.id && OPEN.includes(a.status));
  const run = (fn: () => Promise<{ ok: true; data?: string } | { ok: false; error: string }>) => start(async () => {
    const r = await fn();
    setMsg(r.ok ? { ok: true, text: r.data ?? "已更新" } : { ok: false, text: r.error });
    router.refresh();
  });
  const set = (status: ApplicationStatus) => run(() => setApplicationStatusAction(ap.id, status, notify && Boolean(ap.lineUserId)));
  const complete = () => {
    if (!window.confirm(`確認${ap.who}已經把${ap.animalName}帶回家？${ap.animalName}會從公開頁下架並標記為已領養。`)) return;
    run(() => completeAdoptionAction(ap.id));
  };
  return (
    <div className="grid-2">
      <section className="card table-wrap">
        <table>
          <thead><tr><th>申請人</th><th>想領養</th><th>日期</th><th className="num">契合度</th><th>狀態</th></tr></thead>
          <tbody>
            {applications.map((a) => (
              <tr key={a.id} onClick={() => { setSel(a.id); setMsg(null); }} style={{ cursor: "pointer", background: a.id === sel ? "var(--moss-soft)" : undefined }}>
                <td><button className="btn small" style={{ border: 0, background: "none", padding: 0, fontWeight: 700 }}>{a.who}</button></td>
                <td>{a.animalName}{adopted.includes(a.animalId) && <span className="small muted">（已領養）</span>}</td>
                <td>{fmtDate(a.createdAt)}</td>
                <td className="num">{a.score}</td>
                <td><Badge>{a.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card">
        <div className="row between" style={{ marginBottom: 10 }}>
          <p><b>{ap.who}</b> 想領養 {ap.animalName}<br /><span className="small muted">{fmtDate(ap.createdAt)}・編號 {ap.publicCode}</span></p>
          <Badge>{ap.status}</Badge>
        </div>
        <div className="kv" style={{ marginBottom: 12 }}>
          <div><span>聯絡電話</span>{ap.phone}</div>
          <div><span>居住環境</span>{ap.housing}</div>
          {Object.entries(ap.answers ?? {}).map(([k, v]) => <div key={k}><span>{k}</span>{v}</div>)}
        </div>
        {ap.plan && <p className="small" style={{ marginBottom: 8 }}><span className="muted">遇到變化時的打算：</span>{ap.plan}</p>}
        {ap.message && <p className="small" style={{ marginBottom: 8 }}><span className="muted">想說的話：</span>{ap.message}</p>}
        <div className="summary-box"><b>契合度 {ap.score}（系統依條件計分）</b><br />{ap.reason}</div>
        <p className="small muted" style={{ marginTop: 6 }}>分數只供參考，是否通過由協會決定。</p>
        {others.length > 0 && <p className="small" style={{ marginTop: 8 }}>還有 {others.length} 件{ap.animalName}的申請在處理中：{others.map((o) => o.who).join("、")}。</p>}

        {done ? (
          <p className="small muted" style={{ marginTop: 12 }}>{ap.status === "已通過" ? `已完成領養，${ap.animalName}已從公開頁下架。` : `${ap.animalName}已經被領養，這份申請不需要再處理。`}</p>
        ) : (
          <>
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn" disabled={pending || ap.status === "面談中"} onClick={() => set("面談中")}>安排面談</button>
              <button className="btn primary" disabled={pending || ap.status === "已通過"} onClick={() => set("已通過")}>通過</button>
              <button className="btn" disabled={pending || ap.status === "未通過"} onClick={() => set("未通過")}>不通過</button>
              {ap.status === "已通過" && <button className="btn clay" disabled={pending} onClick={complete}>完成領養（下架）</button>}
            </div>
            {ap.lineUserId
              ? <label className="check-row small" style={{ marginTop: 8 }}><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /><span>改進度時，同時用 LINE 傳進度卡給{ap.who}</span></label>
              : <p className="small muted" style={{ marginTop: 8 }}>申請人還沒在協會 LINE 輸入申請編號，進度要用電話通知。</p>}
          </>
        )}
        {msg && <p className={msg.ok ? "ok-box" : "error-box"} role="status" style={{ marginTop: 8 }}>{msg.text}</p>}
      </section>
    </div>
  );
}
