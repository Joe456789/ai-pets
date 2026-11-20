import { Badge } from "@/components/ui";
import { limitText, PLAN_NAMES, PLANS, type PlanName } from "@/lib/plans";

export function PlanCard({ plan, due, expired, aiUsed, aiCap, staffUsed, managersUsed }: {
  plan: PlanName; due: string; expired: boolean; aiUsed: number; aiCap: number; staffUsed: number; managersUsed: number;
}) {
  const p = PLANS[plan];
  const rows: [string, (x: (typeof PLANS)[PlanName]) => string][] = [
    ["期間", (x) => x.period],
    ["每月 AI 次數", (x) => x.aiCap.toLocaleString()],
    ["現場人員工作號", (x) => limitText(x.staff)],
    ["管理者帳號", (x) => String(x.managers)],
    ["報表匯出", (x) => (x.export ? "有" : "—")],
  ];
  return (
    <section className="card">
      <div className="row between"><h2 style={{ margin: 0 }}>目前方案：{plan}</h2><Badge tone={expired ? "bad" : "good"}>{expired ? "已到期" : `到期 ${due}`}</Badge></div>
      <div className="kv" style={{ margin: "12px 0" }}>
        <div><span>本月 AI 次數</span>{aiUsed.toLocaleString()} / {aiCap.toLocaleString()}</div>
        <div><span>工作號</span>{staffUsed} / {limitText(p.staff)}</div>
        <div><span>管理者</span>{managersUsed} / {p.managers}</div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th></th>{PLAN_NAMES.map((n) => <th key={n} style={n === plan ? { color: "var(--moss)" } : undefined}>{n}{n === plan ? "（目前）" : ""}</th>)}</tr></thead>
          <tbody>{rows.map(([label, f]) => <tr key={label}><td className="muted">{label}</td>{PLAN_NAMES.map((n) => <td key={n}>{f(PLANS[n])}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <p className="small muted" style={{ marginTop: 8 }}>需要調整方案請聯絡平台管理者。試用到期後 AI 功能會暫停，其他資料都會保留。</p>
    </section>
  );
}
