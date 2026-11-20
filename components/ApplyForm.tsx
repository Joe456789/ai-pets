"use client";
import Link from "next/link";
import { useActionState } from "react";
import { applyAction } from "@/app/adopt/actions";

const sel = (name: string, label: string, opts: string[]) => (
  <label className="field">{label}
    <select name={name} required>{opts.map((o) => <option key={o}>{o}</option>)}</select>
  </label>
);

export function ApplyForm({ animalPublicId, shelterName }: { animalPublicId: string; shelterName: string }) {
  const [state, action, pending] = useActionState(applyAction, null);
  if (state?.ok) {
    return (
      <div className="card" style={{ textAlign: "center" }}>
        <h2 style={{ font: "900 24px var(--serif)" }}>申請已送出</h2>
        <p className="muted">{state.shelterName}會看過你的申請再聯絡你。請記下你的申請編號：</p>
        <p className="code-pill" style={{ margin: "10px 0" }}>{state.code}</p>
        <p className="small muted">{state.lineAddUrl ? "加入協會的 LINE 官方帳號後傳這組編號，就能查詢進度，結果也會用 LINE 通知你。" : "協會會用你留的電話通知審核結果，有問題時報上這組編號就好。"}</p>
        <div className="row" style={{ justifyContent: "center", marginTop: 14 }}>
          {state.lineAddUrl && <a className="btn clay" href={state.lineAddUrl} target="_blank" rel="noreferrer">加入協會 LINE</a>}
          <Link className="btn" href="/adopt">繼續逛逛</Link>
        </div>
      </div>
    );
  }
  return (
    <form className="card stack" style={{ gap: 12 }} action={action}>
      {state && !state.ok && <p className="error-box" role="alert">{state.error}</p>}
      <input type="hidden" name="animalPublicId" value={animalPublicId} />
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden style={{ position: "absolute", left: -9999 }} />
      <label className="field">怎麼稱呼你<input name="who" placeholder="例如：王小姐" required maxLength={30} /></label>
      <label className="field">聯絡電話<input name="phone" type="tel" placeholder="協會聯絡你時使用" required /></label>
      <div className="form-grid">
        {sel("housing", "居住環境", ["公寓或大樓", "透天，有院子", "租屋，房東可養", "租屋，還不確定能不能養"])}
        {sel("time", "一天大概能陪牠多久", ["1～3 小時", "1 小時以內", "3 小時以上"])}
        {sel("experience", "飼養經驗", ["第一次養", "養過貓或狗", "目前家裡就有"])}
        {sel("family", "家裡有小孩或長輩嗎", ["沒有", "有小孩", "有長輩", "都有"])}
        {sel("budget", "每月照顧預算", ["2,000～5,000 元", "2,000 元以內", "5,000 元以上"])}
      </div>
      <label className="field">如果搬家、換工作或有其他變化，你打算怎麼照顧牠？<textarea name="plan" rows={3} required minLength={5} /></label>
      <label className="field">想對協會說的話（可不填）<textarea name="message" rows={3} /></label>
      <label className="check-row"><input type="checkbox" name="consent" required /><span>我同意{shelterName}為了審核領養申請和與我聯絡，使用上面填寫的資料。</span></label>
      <button className="btn clay" disabled={pending}>{pending ? "送出中…" : "送出申請"}</button>
    </form>
  );
}
