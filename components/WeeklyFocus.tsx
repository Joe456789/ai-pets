"use client";
import { useState, useTransition } from "react";
import { weeklyFocusAction } from "@/app/shelter/actions";

export function WeeklyFocus() {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = () => start(async () => {
    setError(null);
    const r = await weeklyFocusAction();
    if (r.ok) setText(r.data ?? ""); else setError(r.error);
  });
  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="row between" style={{ marginBottom: 8 }}>
        <span className="ai-tag">AI 本週重點</span>
        <button className="btn small" disabled={pending} onClick={run}>{pending ? "整理中…" : text ? "重新整理" : "請 AI 整理"}</button>
      </div>
      {text ? <div className="summary-box">{text}</div> : <p className="small muted">把下面的建議整理成一段話，方便在群組裡交代給大家。</p>}
      {error && <p className="error-box" style={{ marginTop: 8 }}>{error}</p>}
    </section>
  );
}
