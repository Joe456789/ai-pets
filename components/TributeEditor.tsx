"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveTributeAction, tributeDraftAction } from "@/app/actions";

/** 紀念文：AI 依回憶寫草稿，飼主改過、按確認才會顯示在紀念頁。 */
export function TributeEditor({ id, initial, hasMemories }: { id: string; initial: string; hasMemories: boolean }) {
  const router = useRouter();
  const [text, setText] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const draft = () => start(async () => {
    setMsg(null);
    const r = await tributeDraftAction(id);
    if (r.ok) { setText(r.data); setMsg({ ok: true, text: "AI 草稿好了，可以直接修改，確認後再顯示。" }); } else setMsg({ ok: false, text: r.error });
  });
  const save = () => start(async () => {
    const r = await saveTributeAction(id, text);
    if (r.ok) { setMsg({ ok: true, text: "已更新紀念文。" }); router.refresh(); } else setMsg({ ok: false, text: r.error });
  });

  return (
    <section className="card stack">
      <h2 style={{ margin: 0 }}>紀念文</h2>
      <div className="field"><textarea value={text} maxLength={800} onChange={(e) => setText(e.target.value)} placeholder="自己寫，或讓 AI 依你寫的回憶先寫一段草稿。" style={{ minHeight: 160 }} aria-label="紀念文" /></div>
      <div className="row">
        <button className="btn" disabled={pending || !hasMemories} onClick={draft} title={hasMemories ? "" : "建立紀念時有寫回憶才能用"}>{pending ? "處理中…" : "請 AI 寫草稿"}</button>
        <button className="btn primary" disabled={pending} onClick={save}>確認並顯示</button>
      </div>
      {msg && <p className={msg.ok ? "ok-box" : "error-box"}>{msg.text}</p>}
    </section>
  );
}
