"use client";
import { useEffect, useState } from "react";
import { openIntroAction, type OpenIntro } from "@/app/adopt/actions";
import { Notice } from "@/components/ui";

/** 公立收容所動物的介紹：頁面打開後才請 AI 整理，結果在伺服器快取。 */
export function OpenIntroBox({ id }: { id: string }) {
  const [intro, setIntro] = useState<OpenIntro | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    openIntroAction(id).then((r) => { if (alive) { if (r) setIntro(r); else setFailed(true); } }).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [id]);
  if (failed) return null;
  return (
    <section style={{ margin: "12px 0" }}>
      {!intro ? <p className="small muted">正在整理介紹…</p> : (
        <>
          {intro.ai && <span className="ai-tag">AI 依開放資料整理</span>}
          <p style={{ marginTop: 6 }}>{intro.intro}</p>
          <p className="small muted" style={{ marginTop: 4 }}>認養前想一想：{intro.think}</p>
          <p className="small muted" style={{ marginTop: 4 }}>開放資料只有基本欄位，個性要到收容所和牠互動才知道。</p>
          <div style={{ marginTop: 10 }}><Notice compact /></div>
        </>
      )}
    </section>
  );
}
