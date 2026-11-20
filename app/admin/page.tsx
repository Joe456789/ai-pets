import Link from "next/link";
import { Badge, Bars, PageHead, Stat } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { platformOverview, shelterLabel } from "@/lib/insights";
import { listAiLogs, listErrors, listInvoices } from "@/lib/platform";

export default async function AdminHome() {
  await requireAdmin();
  const [o, invoices, logs, errors] = await Promise.all([platformOverview(), listInvoices(), listAiLogs(100), listErrors(5)]);
  const unpaid = invoices.filter((i) => i.state === "待收款");
  const thisMonthPaid = invoices.filter((i) => i.state === "已收款" && i.at.slice(0, 7) === new Date().toISOString().slice(0, 7)).reduce((s, i) => s + i.amount, 0);
  const todos = [
    ...o.rows.filter((r) => !r.line && r.s.status !== "已停用").map((r) => ({ text: `${r.s.name}：還沒串接 LINE`, href: `/admin/shelters/${r.s.id}` })),
    ...o.shelters.filter((s) => shelterLabel(s)).map((s) => ({ text: `${s.name}：方案${shelterLabel(s)}`, href: `/admin/shelters/${s.id}` })),
    ...unpaid.map((i) => ({ text: `${i.shelterName}：${i.period} 待收款 NT$${i.amount}`, href: "/admin/billing" })),
    ...(logs.some((l) => l.state === "已攔截") ? [{ text: `${logs.filter((l) => l.state === "已攔截").length} 筆 AI 回答被攔下，待抽查`, href: "/admin/ai-logs" }] : []),
    ...(errors.length ? [{ text: `最近有 ${errors.length} 筆系統錯誤`, href: "/admin/system" }] : []),
  ];
  return (
    <>
      <PageHead title="全平台總覽" />
      <div className="stats">
        <Stat label="合作協會" value={o.shelters.filter((s) => s.status !== "已停用").length} hint={`試用中 ${o.shelters.filter((s) => s.status === "試用中").length} 家`} />
        <Stat label="在所動物" value={o.inCare} hint={`開放領養 ${o.open}`} />
        <Stat label="本月領養成功" value={o.adoptedThisMonth} />
        <Stat label="本月已收月費" value={`NT$${thisMonthPaid.toLocaleString()}`} />
        <Stat label="本月 AI 費用（估算）" value={`NT$${o.aiCostTwd < 10 ? o.aiCostTwd.toFixed(1) : Math.round(o.aiCostTwd).toLocaleString()}`} hint={`${o.aiCalls.toLocaleString()} 次呼叫`} />
      </div>
      <div className="grid-2">
        <section className="card"><h2>全平台每月領養數（隻）</h2><Bars rows={o.perMonth} unit="隻" /></section>
        <section className="card">
          <h2>需要處理</h2>
          {todos.length === 0 && <p className="small muted">目前沒有待處理的事項。</p>}
          {todos.slice(0, 8).map((t) => <div className="todo" key={t.text}><span>{t.text}</span><Link className="btn small" href={t.href}>查看</Link></div>)}
          <div className="row" style={{ marginTop: 8 }}>
            <Badge tone={process.env.GEMINI_API_KEY ? "good" : "bad"}>{process.env.GEMINI_API_KEY ? "Gemini 已設定" : "Gemini 未設定"}</Badge>
            <Badge tone="good">資料庫正常</Badge>
          </div>
        </section>
      </div>
    </>
  );
}
