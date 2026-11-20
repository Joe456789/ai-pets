"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { matchAction, type MatchResponse } from "@/app/adopt/actions";
import { PetImage } from "@/components/PetImage";
import { Notice } from "@/components/ui";
import type { MatchAnswers } from "@/lib/match";

const questions: { key: keyof MatchAnswers; q: string; opts: string[] }[] = [
  { key: "housing", q: "你現在住在哪裡？", opts: ["公寓或大樓", "透天，有院子", "租屋，房東可養", "租屋，還不確定能不能養"] },
  { key: "time", q: "平常一天大概能陪牠多久？", opts: ["1 小時以內", "1～3 小時", "3 小時以上"] },
  { key: "experience", q: "你有養貓狗的經驗嗎？", opts: ["第一次養", "養過貓或狗", "目前家裡就有"] },
  { key: "family", q: "家裡有小孩或長輩嗎？", opts: ["沒有", "有小孩", "有長輩", "都有"] },
  { key: "budget", q: "每個月大概能負擔多少照顧費用？", opts: ["2,000 元以內", "2,000～5,000 元", "5,000 元以上"] },
  { key: "preference", q: "你比較想認識哪一種？", opts: ["狗", "貓", "都可以"] },
];

export default function Match() {
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Partial<MatchAnswers>>({});
  const [result, setResult] = useState<MatchResponse | null>(null);
  const [pending, start] = useTransition();

  const pick = (o: string) => {
    const next = { ...answers, [questions[i].key]: o };
    setAnswers(next);
    if (i + 1 < questions.length) { setI(i + 1); return; }
    setI(i + 1);
    start(async () => setResult(await matchAction(next as MatchAnswers)));
  };
  const restart = () => { setI(0); setAnswers({}); setResult(null); };

  if (i >= questions.length) {
    if (pending || !result) return <div className="quiz"><h1>正在幫你配對…</h1><p className="muted">依你的條件計算中，請稍等幾秒。</p></div>;
    if (!result.ok) return <div className="quiz"><p className="error-box">{result.error}</p><button className="btn" style={{ marginTop: 12 }} onClick={restart}>重新回答</button></div>;
    return (
      <div className="quiz">
        <h1>{result.cards.length ? `可能適合你的 ${result.cards.length} 隻` : "目前沒有符合的動物"}</h1>
        <p className="muted">依據你的回答計分。分數只是參考，最後還是要實際互動和協會面談。</p>
        {result.housingWarning && <p className="notice" style={{ marginTop: 12 }}>你提到還不確定能不能養。建議先和房東確認，再送出申請，這樣牠才不用再搬一次家。</p>}
        {result.cards.map((c) => (
          <div className="match-card" key={c.id}>
            <div className="art"><PetImage pet={c} /></div>
            <div>
              <div className="row between"><b style={{ font: "900 19px var(--serif)" }}>{c.name}</b><span className="score">{c.score}</span></div>
              <p className="small muted">{c.shelterName}</p>
              <p className="small"><span className="ai-tag">{result.aiExplained ? "AI 說明" : "為什麼推薦"}</span>　{c.why}</p>
              <p className="small muted">要先想想：{c.check}</p>
              <div className="row" style={{ marginTop: 6 }}><Link className="btn small" href={`/adopt/animals/${c.id}`}>看介紹</Link>{c.ar && <Link className="btn small" href={`/adopt/animals/${c.id}/ar`}>看牠在你家</Link>}<Link className="btn small clay" href={`/adopt/apply/${c.id}`}>申請領養</Link></div>
            </div>
          </div>
        ))}
        <div style={{ marginTop: 16 }}><Notice compact /></div>
        <button className="btn" style={{ marginTop: 12 }} onClick={restart}>重新回答</button>
      </div>
    );
  }
  const q = questions[i];
  return (
    <div className="quiz">
      <h1>幫你找找適合的毛孩</h1>
      <p className="muted small">第 {i + 1} 題，共 {questions.length} 題</p>
      <div className="progress"><i style={{ width: `${(i / questions.length) * 100}%` }} /></div>
      <h2 style={{ fontSize: 18 }}>{q.q}</h2>
      <div className="options">
        {q.opts.map((o) => <button key={o} onClick={() => pick(o)}>{o}</button>)}
      </div>
      {i > 0 && <button className="btn small" style={{ marginTop: 14 }} onClick={() => setI(i - 1)}>上一題</button>}
    </div>
  );
}
