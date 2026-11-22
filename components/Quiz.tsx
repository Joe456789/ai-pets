"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { answerQuizAction } from "@/app/actions";

/** 小測驗：按下選項後由伺服器判斷對錯並記錄，再顯示解釋。 */
export function Quiz({ lessonId, q, options, before }: { lessonId: string; q: string; options: string[]; before?: boolean }) {
  const router = useRouter();
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<{ correct: boolean; answer: string; why: string } | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const pick = (i: number) => start(async () => {
    setPicked(i);
    setError("");
    const r = await answerQuizAction(lessonId, i);
    if (!r.ok) { setError(r.error); return; }
    setResult(r.data);
    router.refresh();
  });

  return (
    <section className="card stack quiz">
      <h2 style={{ margin: 0 }}>小測驗{before !== undefined && !result && <span className="small muted">　（之前{before ? "答對了" : "答過"}，可以再答一次）</span>}</h2>
      <p>{q}</p>
      <div className="stack" style={{ gap: 8 }}>
        {options.map((o, i) => (
          <button key={o} className={`choice ${picked === i ? (result ? (result.correct ? "right" : "wrong") : "on") : ""}`} disabled={pending || Boolean(result)} onClick={() => pick(i)}>{o}</button>
        ))}
      </div>
      {result && (
        <p className={result.correct ? "ok-box" : "error-box"}>
          {result.correct ? "答對了！" : `差一點，答案是「${result.answer}」。`}{result.why}
        </p>
      )}
      {result && <button className="btn small" style={{ justifySelf: "start" }} onClick={() => { setResult(null); setPicked(null); }}>再答一次</button>}
      {error && <p className="error-box">{error}</p>}
    </section>
  );
}
