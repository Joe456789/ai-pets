"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { closeConversationAction, sendMessageAction } from "@/app/shelter/actions";
import { Badge } from "@/components/ui";
import { fmtDateTime } from "@/lib/time";
import type { ConversationDoc } from "@/lib/types";

const WHO = { user: "領養人", ai: "AI", staff: "協會" };

export function MessagesPanel({ conversations }: { conversations: ConversationDoc[] }) {
  const router = useRouter();
  const [sel, setSel] = useState(conversations[0]?.id);
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const c = conversations.find((x) => x.id === sel);
  if (!c) return <p className="muted">目前沒有領養人訊息。</p>;

  const send = () => start(async () => {
    setError(null);
    const res = await sendMessageAction(c.id, reply);
    if (!res.ok) { setError(res.error); return; }
    setReply("");
    router.refresh();
  });
  const close = () => start(async () => { await closeConversationAction(c.id); router.refresh(); });

  return (
    <div className="grid-split">
      <div className="picker card">
        {conversations.map((x) => (
          <button key={x.id} className={x.id === sel ? "on" : ""} onClick={() => { setSel(x.id); setError(null); }} style={{ display: "block" }}>
            <span className="row between"><b>{x.displayName}</b><span className="small muted">{fmtDateTime(x.lastAt)}</span></span>
            <span className="row" style={{ margin: "4px 0" }}><Badge>{x.tag}</Badge><Badge>{x.status}</Badge></span>
            <span className="small muted">{x.messages.findLast((m) => m.from === "user")?.text}</span>
          </button>
        ))}
      </div>
      <section className="card">
        <h2>{c.displayName}</h2>
        <div className="stack" style={{ gap: 8 }}>
          {c.messages.map((m, i) => (
            <div key={i} className="summary-box" style={m.from === "user" ? { background: "#f1ebdc" } : m.from === "ai" ? { background: "#f6f3ea" } : undefined}>
              <span className={m.from === "ai" ? "ai-tag" : "small muted"}>{WHO[m.from]}・{fmtDateTime(m.at)}</span><br />
              {m.text}
              {m.photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.photo} alt="領養人傳來的照片" style={{ display: "block", maxWidth: 220, borderRadius: 8, marginTop: 6 }} />
              )}
            </div>
          ))}
        </div>
        {error && <p className="error-box" style={{ marginTop: 10 }} role="alert">{error}</p>}
        <label className="field" style={{ marginTop: 14 }}>回覆領養人
          <textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="訊息會透過 LINE 傳給對方，會計入官方帳號的每月訊息額度" />
        </label>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn primary" disabled={!reply.trim() || pending} onClick={send}>{pending ? "處理中…" : "送出回覆"}</button>
          <button className="btn" disabled={pending || c.status === "已結案"} onClick={close}>標記結案</button>
        </div>
      </section>
    </div>
  );
}
