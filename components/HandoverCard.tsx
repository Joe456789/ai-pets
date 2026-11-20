"use client";
import { useState, useTransition } from "react";
import { generateHandoverAction } from "@/app/shelter/actions";

export function HandoverCard({ initial }: { initial: string | null }) {
  const [summary, setSummary] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = () => start(async () => {
    setError(null);
    const res = await generateHandoverAction();
    if (res.ok) setSummary(res.data ?? null);
    else setError(res.error);
  });
  return (
    <section className="card">
      <div className="row between" style={{ marginBottom: 8 }}>
        <span className="ai-tag">AI 交班摘要</span>
        <button className="btn small" disabled={pending} onClick={run}>{pending ? "整理中…" : summary ? "重新整理" : "產生摘要"}</button>
      </div>
      {summary ? <div className="summary-box">{summary}</div> : <p className="small muted">依今天的現場回報整理，按一下就會產生。</p>}
      {error && <p className="error-box" style={{ marginTop: 8 }}>{error}</p>}
    </section>
  );
}
