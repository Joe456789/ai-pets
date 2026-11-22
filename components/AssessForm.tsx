"use client";
import { useState, useTransition } from "react";
import { assessAction, type AssessResponse } from "@/app/actions";
import { ReportView } from "@/components/ReportView";
import type { AssessAnswers } from "@/lib/types";

type Q = { key: keyof AssessAnswers; title: string; hint?: string; options: string[]; multi?: boolean; none?: string };

const QUESTIONS: Q[] = [
  { key: "kind", title: "你想養貓還是狗？", options: ["狗", "貓", "還沒決定"] },
  { key: "alone", title: "平常一天，家裡沒人的時間大概多久？", hint: "上班、上課加上通勤", options: ["4 小時以內", "4～8 小時", "8～10 小時", "10 小時以上"] },
  { key: "activity", title: "每天能花多少時間陪牠玩或散步？", hint: "狗狗通常每天要散步，貓也需要有人陪玩", options: ["30 分鐘以內", "30 分鐘～1 小時", "1 小時以上"] },
  { key: "travel", title: "出差或旅行常不常？", options: ["很少", "每月 1～2 次", "經常"] },
  { key: "budget", title: "每個月能花在牠身上的錢大概多少？", hint: "飼料、用品、預防保健，不含生病", options: ["2,000 元以內", "2,000～4,000 元", "4,000～6,000 元", "6,000 元以上"] },
  { key: "fund", title: "現在有沒有可以給牠用的緊急預備金？", hint: "急診或手術用", options: ["沒有", "1 萬元以內", "1～3 萬元", "3 萬元以上"] },
  { key: "housing", title: "你現在住的地方是？", options: ["自有住宅", "租屋，房東同意", "租屋，還沒問房東", "租屋，房東不同意", "住家裡，家人同意", "住家裡，家人還沒同意"] },
  { key: "space", title: "住處的空間？", options: ["套房", "公寓或大樓", "有院子"] },
  { key: "family", title: "家裡有沒有這些情況？", hint: "可以複選", options: ["6 歲以下小孩", "長輩", "懷孕或備孕", "有人過敏"], multi: true, none: "都沒有" },
  { key: "otherPets", title: "家裡現在有其他寵物嗎？", options: ["沒有", "有狗", "有貓", "有鳥、兔子或鼠類"] },
  { key: "changes", title: "未來 5 年內，可能會有這些變動嗎？", hint: "可以複選，貓狗通常會活 10 到 15 年", options: ["可能搬家", "出國讀書或工作", "換工作或輪班", "結婚或同居"], multi: true, none: "都沒有" },
  { key: "experience", title: "你養過貓狗嗎？", options: ["第一次養", "養過貓或狗", "現在就有"] },
  { key: "backup", title: "你生病、住院或出差時，誰能幫你照顧？", options: ["家人或室友", "朋友", "寵物保姆或住宿", "還沒想過"] },
  { key: "ownerHealth", title: "十幾年後，你的體力和健康還能照顧牠嗎？", hint: "貓狗會老，老了更需要人照顧", options: ["應該可以", "不確定", "可能會有困難"] },
  { key: "reason", title: "最主要是為什麼想養？", options: ["想有個陪伴", "家裡小孩想要", "想送給別人", "看到覺得很可愛", "想了很久"] },
];

export function AssessForm() {
  const [i, setI] = useState(0);
  const [a, setA] = useState<Partial<AssessAnswers>>({ family: [], changes: [] });
  const [why, setWhy] = useState("");
  const [res, setRes] = useState<AssessResponse | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const total = QUESTIONS.length + 1;

  const submit = () => start(async () => {
    setError("");
    const r = await assessAction({ ...(a as AssessAnswers), why: why.trim() || undefined });
    if (r.ok) setRes(r.data); else setError(r.error);
  });

  if (res) {
    return (
      <div className="stack">
        <ReportView result={res.result} cost={res.cost} report={res.report} aiError={res.aiError} />
        <p className="small muted">{res.savedId ? "這份報告已存到你的帳號，之後可以在「我的毛孩」看到。" : "登入後做評估，報告會存到你的帳號。"}</p>
        <button className="btn" onClick={() => { setRes(null); setI(0); }}>重新評估</button>
      </div>
    );
  }

  const q = QUESTIONS[i];
  const pick = (v: string) => {
    if (!q.multi) { setA({ ...a, [q.key]: v }); setI(i + 1); return; }
    const cur = (a[q.key] as string[]) ?? [];
    setA({ ...a, [q.key]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] });
  };

  return (
    <div className="quiz card">
      <div className="row between small muted"><span>第 {Math.min(i + 1, total)} 題，共 {total} 題</span>{i > 0 && <button className="btn small" onClick={() => setI(i - 1)}>上一題</button>}</div>
      <div className="quiz-progress" aria-hidden><span style={{ width: `${(i / total) * 100}%` }} /></div>
      {q ? (
        <>
          <h2>{q.title}</h2>
          {q.hint && <p className="small muted">{q.hint}</p>}
          <div className="choices">
            {q.options.map((o) => {
              const on = q.multi ? ((a[q.key] as string[]) ?? []).includes(o) : a[q.key] === o;
              return <button key={o} className={`choice ${on ? "on" : ""}`} aria-pressed={on} onClick={() => pick(o)}>{o}</button>;
            })}
            {q.multi && <button className="btn primary" style={{ marginTop: 6 }} onClick={() => setI(i + 1)}>{((a[q.key] as string[]) ?? []).length ? "下一題" : q.none}</button>}
          </div>
        </>
      ) : (
        <>
          <h2>最後，還有想補充的嗎？</h2>
          <p className="small muted">選填，寫一兩句就好，AI 會參考。</p>
          <div className="field" style={{ marginTop: 12 }}>
            <textarea value={why} maxLength={300} onChange={(e) => setWhy(e.target.value)} placeholder="例如：小時候家裡有養狗，現在工作穩定了，想要有個陪伴" aria-label="想補充的話" />
          </div>
          {error && <p className="error-box" style={{ marginTop: 10 }}>{error}</p>}
          <button className="btn primary block" style={{ marginTop: 14 }} disabled={pending} onClick={submit}>{pending ? "AI 正在寫你的報告…" : "看我的評估報告"}</button>
        </>
      )}
    </div>
  );
}
