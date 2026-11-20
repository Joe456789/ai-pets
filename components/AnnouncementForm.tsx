"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createAnnouncementAction } from "@/app/admin/actions";

export function AnnouncementForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const post = () => start(async () => { const r = await createAnnouncementAction(text); if (r.ok) { setText(""); router.refresh(); } });
  return (
    <section className="card">
      <label className="field">公告內容<textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="例如：11/20 晚上 10 點進行系統維護，約 30 分鐘" /></label>
      <button className="btn primary" style={{ marginTop: 10 }} disabled={!text.trim() || pending} onClick={post}>發布</button>
    </section>
  );
}
