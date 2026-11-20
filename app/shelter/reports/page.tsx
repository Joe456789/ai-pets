import { Bars, PageHead, Stat } from "@/components/ui";
import { requireManager } from "@/lib/auth";
import { shelterReport } from "@/lib/insights";
import { planOf } from "@/lib/plans";
import { getShelter } from "@/lib/repo";

export default async function Reports() {
  const { sid } = await requireManager();
  const [r, shelter] = await Promise.all([shelterReport(sid), getShelter(sid)]);
  const canExport = shelter ? planOf(shelter).export : false;
  const withAvg = r.perMonth.filter((m) => m.adopted > 0);
  return (
    <>
      <PageHead
        title="資料報表" sub="近 6 個月的成果，可以用在募款、理監事報告和成果紀錄。"
        action={canExport ? <a className="btn primary" href="/shelter/reports/export">匯出 Excel（CSV）</a> : <span className="small muted">匯出報表是進階方案的功能</span>}
      />
      <div className="stats">
        <Stat label="目前在所" value={r.inCare} hint={`開放領養 ${r.open}`} />
        <Stat label="近 6 個月領養" value={r.perMonth.reduce((s, m) => s + m.adopted, 0)} />
        <Stat label="領養人訊息" value={r.aiHandled + r.handedOff} hint={`AI 直接回覆 ${r.aiHandled}、轉人工 ${r.handedOff}`} />
        <Stat label="本月 AI 呼叫" value={r.usage.calls ?? 0} />
      </div>
      <div className="grid-even">
        <section className="card"><h2>每月領養數（隻）</h2><Bars rows={r.perMonth.map((m) => ({ label: m.label, value: m.adopted }))} unit="隻" /></section>
        <section className="card"><h2>每月領養申請（件）</h2><Bars rows={r.perMonth.map((m) => ({ label: m.label, value: m.applications }))} unit="件" /></section>
        <section className="card">
          <h2>領養前平均收容天數（天）</h2>
          {withAvg.length ? <Bars rows={withAvg.map((m) => ({ label: m.label, value: m.avgDays }))} unit="天" /> : <p className="small muted">還沒有領養紀錄。</p>}
        </section>
        <section className="card table-wrap">
          <h2>明細</h2>
          <table>
            <thead><tr><th>月份</th><th className="num">領養</th><th className="num">申請</th><th className="num">平均收容天數</th></tr></thead>
            <tbody>{r.perMonth.map((m) => <tr key={m.m}><td>{m.label}</td><td className="num">{m.adopted}</td><td className="num">{m.applications}</td><td className="num">{m.adopted ? m.avgDays : "—"}</td></tr>)}</tbody>
          </table>
        </section>
      </div>
    </>
  );
}
