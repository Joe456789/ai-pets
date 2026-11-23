"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deletePetAction } from "@/app/actions";

/** 刪除毛孩：先展開說明會刪掉什麼，要再按一次才真的刪。 */
export function DeletePet({ id, name, passed }: { id: string; name: string; passed: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const run = () => start(async () => {
    setError("");
    const r = await deletePetAction(id);
    if (!r.ok) { setError(r.error); return; }
    router.push("/me");
    router.refresh();
  });

  if (!open) return <button type="button" className="btn small danger-link" onClick={() => setOpen(true)}>刪除{name}的資料</button>;
  return (
    <section className="card stack danger-card">
      <h2 style={{ margin: 0 }}>確定要刪除{name}嗎？</h2>
      <p className="small">會一起刪掉{name}的照片、醫療紀錄和單據照片、照顧提醒、生活變動清單{passed ? "，以及 3D 紀念和紀念文" : ""}。<b>刪除後無法復原。</b></p>
      {!passed && <p className="small muted">如果{name}離開了，可以改把狀態設成「已離開」，紀錄會保留，也能建立 3D 紀念。</p>}
      {error && <p className="error-box">{error}</p>}
      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="btn danger" disabled={busy} onClick={run}>{busy ? "刪除中…" : "確定刪除"}</button>
        <button type="button" className="btn" disabled={busy} onClick={() => setOpen(false)}>取消</button>
      </div>
    </section>
  );
}
