"use client";
import { useActionState, useState } from "react";
import { pledgeAction, type PledgeResponse } from "@/app/adopt/actions";
import type { PublicSupply } from "@/lib/supplies";

/** 公開頁的物資清單和「我可以捐」登記表。 */
export function SupplyList({ sid, shelterName, supplies }: { sid: string; shelterName: string; supplies: PublicSupply[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (supplies.length === 0) return <p className="small muted">{shelterName}目前沒有列出需要的物資。</p>;
  return (
    <div className="supply-list">
      {supplies.map((s) => {
        const left = Math.max(0, s.need - s.got - s.pledged);
        const pct = Math.min(100, Math.round(((s.got + s.pledged) / s.need) * 100));
        return (
          <div className="card supply-item" key={s.id}>
            <div className="row between">
              <b>{s.name}{s.urgent && <span className="badge warn" style={{ marginLeft: 6 }}>急需</span>}</b>
              <span className="small muted">需要 {s.need} {s.unit}</span>
            </div>
            {s.note && <p className="small muted">{s.note}</p>}
            <div className="bar" aria-label={`已收到和已登記 ${pct}%`}><span style={{ width: `${pct}%` }} /></div>
            <p className="small">已收到 {s.got}・已有人登記 {s.pledged}・{left > 0 ? `還缺 ${left} ${s.unit}` : "目前登記數量已足夠"}</p>
            {open === s.id
              ? <PledgeForm sid={sid} supply={s} shelterName={shelterName} onClose={() => setOpen(null)} />
              : <button className="btn small clay" onClick={() => setOpen(s.id)}>我可以捐</button>}
          </div>
        );
      })}
    </div>
  );
}

function PledgeForm({ sid, supply, shelterName, onClose }: { sid: string; supply: PublicSupply; shelterName: string; onClose: () => void }) {
  const [state, action, pending] = useActionState<PledgeResponse | null, FormData>(pledgeAction, null);
  if (state?.ok) {
    return (
      <div className="ok-box">
        謝謝你！{shelterName}會用你留的聯絡方式和你確認寄送或送達方式。
        <button className="btn small" style={{ marginLeft: 8 }} onClick={onClose}>關閉</button>
      </div>
    );
  }
  return (
    <form className="stack" style={{ gap: 8, marginTop: 6 }} action={action}>
      {state && !state.ok && <p className="error-box" role="alert">{state.error}</p>}
      <input type="hidden" name="sid" value={sid} />
      <input type="hidden" name="supplyId" value={supply.id} />
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden style={{ position: "absolute", left: -9999 }} />
      <div className="form-grid">
        <label className="field">數量（{supply.unit}）<input name="qty" type="number" min={1} max={999} defaultValue={1} required /></label>
        <label className="field">怎麼稱呼你<input name="who" maxLength={30} placeholder="例如：林小姐" required /></label>
      </div>
      <label className="field">聯絡方式（電話、Email 或 LINE ID）<input name="contact" maxLength={60} required /></label>
      <label className="field">備註（可不填）<input name="note" maxLength={100} placeholder="例如：週六下午可以送過去" /></label>
      <label className="check-row"><input type="checkbox" name="consent" required /><span>我同意{shelterName}使用上面的資料和我聯絡捐贈事宜。</span></label>
      <div className="row">
        <button className="btn small clay" disabled={pending}>{pending ? "送出中…" : "送出登記"}</button>
        <button type="button" className="btn small" onClick={onClose}>取消</button>
      </div>
    </form>
  );
}
