"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type R = { ok: true; data?: unknown } | { ok: false; error: string };

/** 按下後執行伺服器動作，顯示結果，成功後重新整理資料。 */
export function ActionButton({ run, label, pending = "處理中…", primary, small, confirm, showData }: {
  run: () => Promise<R>; label: string; pending?: string; primary?: boolean; small?: boolean; confirm?: string; showData?: boolean;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const click = () => {
    if (confirm && !window.confirm(confirm)) return;
    start(async () => {
      const r = await run();
      if (!r.ok) setMsg({ ok: false, text: r.error });
      else { setMsg(showData && typeof r.data === "string" ? { ok: true, text: r.data } : null); router.refresh(); }
    });
  };
  return (
    <span style={{ display: "inline-grid", gap: 6 }}>
      <button className={`btn ${primary ? "primary" : ""} ${small ? "small" : ""}`} disabled={busy} onClick={click}>{busy ? pending : label}</button>
      {msg && <span className={msg.ok ? "ok-box" : "error-box"} role="status">{msg.text}</span>}
    </span>
  );
}
