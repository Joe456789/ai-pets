"use client";
import { useState } from "react";
import { Badge, Notice } from "@/components/ui";
import { COST_TABLE, lifetimeCost, type CostProfile, type LifetimeCost } from "@/lib/lifetimeCost";
import type { AssessReport, ReadinessResult } from "@/lib/types";

const colorOf = (v: number) => (v >= 75 ? "var(--moss)" : v >= 55 ? "#c99a2e" : "var(--rose)");

export function ReportView({ result, cost, report, aiError }: { result: ReadinessResult; cost: LifetimeCost; report: AssessReport | null; aiError?: string }) {
  const [profile, setProfile] = useState<CostProfile>(cost.profile);
  const c = profile === cost.profile ? cost : lifetimeCost(profile);
  return (
    <div className="stack">
      <section className="card">
        <div className="verdict">
          <div className="ring" style={{ ["--v" as string]: result.total, ["--c" as string]: colorOf(result.total) }}><b>{result.total}</b></div>
          <div>
            <p className="small muted">飼養準備度</p>
            <h2>{result.verdict}</h2>
          </div>
        </div>
        {report ? (
          <p style={{ marginTop: 14 }}><span className="ai-tag">AI 說明</span>　{report.summary}</p>
        ) : (
          aiError && <p className="small muted" style={{ marginTop: 14 }}>{aiError}</p>
        )}
      </section>

      <section className="card">
        <h2>六個面向</h2>
        <div className="dims">
          {result.dims.map((d) => (
            <div key={d.key}>
              <div className="dim-top"><b>{d.label}</b><span>{d.score}</span></div>
              <div className="dim-bar"><span style={{ width: `${d.score}%`, background: colorOf(d.score) }} /></div>
              <p className="tiny">{d.note}</p>
            </div>
          ))}
        </div>
        <p className="tiny" style={{ marginTop: 10 }}>分數由固定規則計算（時間 20%、經濟 20%、居住 20%、家庭 15%、{result.dims.find((d) => d.key === "future")?.label ?? "未來變動"} 15%、支援 10%），AI 只負責寫說明。<a href="/assess/basis">每一題的依據</a></p>
      </section>

      {result.risks.length > 0 && (
        <section className="card">
          <h2>要先想清楚的地方</h2>
          <div className="stack" style={{ gap: 8 }}>
            {result.risks.map((r) => <div className="risk" key={r.text}><Badge>{r.level}</Badge><span>{r.text}</span></div>)}
          </div>
        </section>
      )}

      <section className="card">
        <h2>可能適合你的類型</h2>
        <p className="small">種類：<b>{result.fit.kind}</b>　體型：<b>{result.fit.size}</b><br />年齡：<b>{result.fit.age}</b>　活動量：<b>{result.fit.energy}</b></p>
        {result.fit.why.length > 0 && <ul className="points small muted" style={{ marginTop: 8 }}>{result.fit.why.map((w) => <li key={w}>{w}</li>)}</ul>}
        <p className="tiny" style={{ marginTop: 8 }}>這是依你的生活條件給的方向。每隻貓狗個性不同，實際見面相處最準。</p>
      </section>

      <section className="card">
        <h2>一輩子大約要花多少</h2>
        <div className="tabs" role="tablist">
          {(Object.keys(COST_TABLE) as CostProfile[]).map((p) => <button key={p} role="tab" aria-selected={p === profile} className={p === profile ? "on" : ""} onClick={() => setProfile(p)}>{p}</button>)}
        </div>
        <p className="cost-total">約 {c.total.toLocaleString()} 元</p>
        <p className="small muted">以平均 {c.years} 年計算，平均每月約 {c.perMonth.toLocaleString()} 元；另外建議準備 {c.emergency.toLocaleString()} 元緊急醫療預備金。</p>
        <table className="cost-lines">
          <tbody>{c.lines.map((l) => <tr key={l.label}><td><b>{l.label}</b><br /><span className="tiny">{l.how}</span></td><td className="num">{l.amount.toLocaleString()} 元</td></tr>)}</tbody>
        </table>
        <p className="tiny" style={{ marginTop: 8 }}>依台灣常見市價粗估，不含重大疾病與意外。實際花費依地區、品種和個體狀況差很多。</p>
      </section>

      {report && (
        <section className="card">
          <h2><span className="ai-tag">AI</span> 給你的建議</h2>
          {report.strengths.length > 0 && <><p className="small"><b>做得好的地方</b></p><ul className="points small">{report.strengths.map((s) => <li key={s}>{s}</li>)}</ul></>}
          {report.prepare.length > 0 && <><p className="small" style={{ marginTop: 10 }}><b>開始前先準備</b></p><ul className="points small">{report.prepare.map((s) => <li key={s}>{s}</li>)}</ul></>}
          {report.ifNotReady.length > 0 && <><p className="small" style={{ marginTop: 10 }}><b>改變這些，就更適合了</b></p><ul className="points small">{report.ifNotReady.map((s) => <li key={s}>{s}</li>)}</ul></>}
        </section>
      )}
      <Notice />
    </div>
  );
}
