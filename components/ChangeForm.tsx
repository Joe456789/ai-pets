"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { changeAction, type ChangeResponse } from "@/app/actions";
import { ChangeView } from "@/components/ChangeView";
import { CHANGE_KINDS, DETAILS, HELPERS, WHEN, WORRIES } from "@/lib/lifeChange";
import type { ChangeAnswers, PetKind } from "@/lib/types";

type PetLite = { id: string; name: string; kind: PetKind };
type Draft = Partial<ChangeAnswers> & { petId?: string };

/** 一題一題問：哪隻毛孩 → 什麼變動 → 什麼時候 → 那個變動的細節 → 誰能幫忙 → 擔不擔心 → 補充。 */
export function ChangeForm({ pets, initialPet, today }: { pets: PetLite[]; initialPet?: string; today: string }) {
  const first = pets.find((p) => p.id === initialPet);
  const [a, setA] = useState<Draft>(first ? { petId: first.id, petKind: first.kind } : {});
  const [i, setI] = useState(first ? 1 : 0);
  const [res, setRes] = useState<ChangeResponse | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const total = 7;
  const next = (patch: Draft) => { setA({ ...a, ...patch }); setI(i + 1); };

  if (res) {
    return (
      <div className="stack">
        <ChangeView plan={res.plan} petName={res.petName} change={a.change ?? ""} aiNote={res.aiNote} aiError={res.aiError} remindOn={res.remindOn} />
        <p className="small muted">{res.savedId ? "這份清單已存到你的帳號，之後可以在「我的毛孩」找到。" : "登入後做，清單會存到你的帳號，也能設提醒。"}</p>
        <div className="row">
          <button className="btn" onClick={() => { setRes(null); setI(first ? 1 : 0); }}>再做一次</button>
          {res.savedId && <Link className="btn" href="/me">回我的毛孩</Link>}
        </div>
      </div>
    );
  }

  const submit = () => start(async () => {
    setError("");
    const r = await changeAction(a as ChangeAnswers & { petId?: string });
    if (r.ok) setRes(r.data); else setError(r.error);
  });
  const pet = pets.find((p) => p.id === a.petId);
  const name = pet?.name ?? "牠";
  const choices = (options: readonly string[], on: string | undefined, pick: (v: string) => void) => (
    <div className="choices">
      {options.map((o) => <button key={o} className={`choice ${on === o ? "on" : ""}`} aria-pressed={on === o} onClick={() => pick(o)}>{o}</button>)}
    </div>
  );

  let body: React.ReactNode;
  if (i === 0) {
    body = pets.length ? (
      <><h2>是哪一隻毛孩？</h2>{choices(pets.map((p) => p.name), pet?.name, (v) => { const p = pets.find((x) => x.name === v)!; next({ petId: p.id, petKind: p.kind }); })}</>
    ) : (
      <><h2>你養的是？</h2>{choices(["狗", "貓"], a.petKind, (v) => next({ petKind: v as PetKind }))}</>
    );
  } else if (i === 1) {
    body = <><h2>{name === "牠" ? "接下來" : `${name}接下來`}會遇到什麼變動？</h2>{choices(CHANGE_KINDS, a.change, (v) => next({ change: v as ChangeAnswers["change"], detail: undefined }))}</>;
  } else if (i === 2) {
    body = (
      <>
        <h2>大概什麼時候？</h2>
        {choices(WHEN, a.when, (v) => (v === "已經發生" ? next({ when: "已經發生", date: undefined }) : setA({ ...a, when: v as ChangeAnswers["when"] })))}
        {a.when && a.when !== "已經發生" && (
          <div className="stack" style={{ marginTop: 12 }}>
            <label className="field">知道是哪一天的話（選填）<input type="date" min={today} value={a.date ?? ""} onChange={(e) => setA({ ...a, date: e.target.value || undefined })} /></label>
            <p className="tiny">填了日期，會在前一週用 LINE 提醒你再看一次清單。</p>
            <button className="btn primary" onClick={() => setI(i + 1)}>下一題</button>
          </div>
        )}
      </>
    );
  } else if (i === 3 && a.change) {
    const d = DETAILS[a.change];
    body = <><h2>{d.q}</h2>{choices(d.options, a.detail, (v) => next({ detail: v }))}</>;
  } else if (i === 4) {
    body = <><h2>這段時間，有誰能幫忙照顧{name}？</h2>{choices(HELPERS, a.helper, (v) => next({ helper: v as ChangeAnswers["helper"] }))}</>;
  } else if (i === 5) {
    body = <><h2>你擔心之後沒辦法繼續養{name}嗎？</h2><p className="small muted">老實回答就好，這只是用來決定清單要從哪裡開始。</p>{choices(WORRIES, a.worry, (v) => next({ worry: v as ChangeAnswers["worry"] }))}</>;
  } else {
    body = (
      <>
        <h2>最後，還有想補充的嗎？</h2>
        <p className="small muted">選填，例如最擔心的事，AI 會參考。</p>
        <div className="field" style={{ marginTop: 12 }}>
          <textarea value={a.note ?? ""} maxLength={300} onChange={(e) => setA({ ...a, note: e.target.value })} placeholder="例如：新房東只接受貓，但我們家是狗" aria-label="想補充的話" />
        </div>
        {error && <p className="error-box" style={{ marginTop: 10 }}>{error}</p>}
        <button className="btn primary block" style={{ marginTop: 14 }} disabled={pending} onClick={submit}>{pending ? "正在整理你的準備清單…" : "看我的準備清單"}</button>
      </>
    );
  }

  return (
    <div className="quiz card">
      <div className="row between small muted">
        <span>第 {i + 1} 題，共 {total} 題</span>
        {i > (first ? 1 : 0) && <button className="btn small" onClick={() => setI(i - 1)}>上一題</button>}
      </div>
      <div className="quiz-progress" aria-hidden><span style={{ width: `${(i / total) * 100}%` }} /></div>
      {body}
    </div>
  );
}
