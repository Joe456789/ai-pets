import { saveShelterAction } from "@/app/shelter/actions";
import { ManagersPanel } from "@/components/ManagersPanel";
import { PasswordForm } from "@/components/PasswordForm";
import { PlanCard } from "@/components/PlanCard";
import { getUsage } from "@/lib/ai/gemini";
import { listManagersOf } from "@/lib/platform";
import { aiCapOf, managerQuota, planExpired, planOf, staffQuota } from "@/lib/plans";
import { Badge, PageHead } from "@/components/ui";
import { requireManager } from "@/lib/auth";
import { getLineCreds, getShelter } from "@/lib/repo";

export default async function Settings() {
  const { sid, email } = await requireManager();
  const [shelter, creds] = await Promise.all([getShelter(sid), getLineCreds(sid)]);
  if (!shelter) return null;
  const [usage, staffQ, managerQ, managers] = await Promise.all([getUsage(sid), staffQuota(shelter), managerQuota(shelter), listManagersOf(sid)]);
  return (
    <>
      <PageHead title="協會與 LINE 設定" />
      <form action={saveShelterAction} className="grid-even">
        <section className="card stack" style={{ gap: 12 }}>
          <h2 style={{ margin: 0 }}>協會資料</h2>
          <label className="field">協會名稱<input name="name" defaultValue={shelter.name} required /></label>
          <label className="field">地區<input name="area" defaultValue={shelter.area} /></label>
          <label className="field">開放時間<input name="hours" defaultValue={shelter.hours} /></label>
          <label className="field">聯絡電話<input name="phone" defaultValue={shelter.phone} /></label>
          <label className="field">協會介紹<textarea name="intro" rows={3} defaultValue={shelter.intro} /></label>
          <label className="field">園區區域（用頓號分開，照護回報會用到）<input name="areas" defaultValue={shelter.areas.join("、")} /></label>
          <button className="btn primary" style={{ justifySelf: "start" }}>儲存全部設定</button>
        </section>
        <div className="stack">
          <section className="card">
            <div className="row between"><h2 style={{ margin: 0 }}>LINE 官方帳號</h2><Badge tone={creds ? "good" : "warn"}>{creds ? "已串接" : "尚未串接"}</Badge></div>
            <p className="small muted" style={{ margin: "8px 0 12px" }}>使用協會自己的官方帳號。領養人看到一般選單，綁定工作號的人員看到工作選單。</p>
            <label className="field">加好友連結（會顯示在公開頁）<input name="lineAddUrl" defaultValue={shelter.lineAddUrl ?? ""} placeholder="https://lin.ee/…" /></label>
          </section>
          <section className="card">
            <h2>AI 問答要回答的內容</h2>
            <label className="field">每行一題，用全形直線分開問題和答案
              <textarea name="faq" rows={7} defaultValue={shelter.faq.map((f) => `${f.q}｜${f.a}`).join("\n")} />
            </label>
            <p className="small muted" style={{ marginTop: 8 }}>AI 只依這裡的內容回答協會事務。健康疑慮、緊急狀況和想退養的訊息一律轉人工。</p>
          </section>
        </div>
      </form>
      <div className="grid-even" style={{ marginTop: 16 }}>
        <PlanCard plan={shelter.plan} due={shelter.due} expired={planExpired(shelter)} aiUsed={usage.calls ?? 0} aiCap={aiCapOf(shelter)} staffUsed={staffQ.used} managersUsed={managerQ.used} />
        <div className="stack">
          <ManagersPanel managers={managers.map((m) => ({ email: m.email, name: m.name }))} self={email} limit={planOf(shelter).managers} canAdd={!managerQ.full} />
          <PasswordForm />
        </div>
      </div>
    </>
  );
}
