import Link from "next/link";
import { notFound } from "next/navigation";
import { updateShelterAction } from "@/app/admin/actions";
import { ConnectLine, ResetPassword } from "@/components/ShelterAdminTools";
import { Badge, PageHead, Stat } from "@/components/ui";
import { getUsage } from "@/lib/ai/gemini";
import { aiCapOf, limitText, planOf } from "@/lib/plans";
import { requireAdmin } from "@/lib/auth";
import { lineStatus } from "@/lib/line/setup";
import { listManagersOf } from "@/lib/platform";
import { getShelter, listAnimals, listApplications, listStaff } from "@/lib/repo";

export default async function AdminShelter({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const s = await getShelter(id);
  if (!s) notFound();
  const [animals, apps, staff, managers, usage, line] = await Promise.all([listAnimals(id), listApplications(id), listStaff(id), listManagersOf(id), getUsage(id), lineStatus(id)]);
  const save = updateShelterAction.bind(null, id);
  const cap = aiCapOf(s);
  const plan = planOf(s);
  return (
    <>
      <p className="small muted" style={{ marginBottom: 10 }}><Link href="/admin/shelters">協會管理</Link> ／ {s.name}</p>
      <PageHead title={s.name} sub={`${s.id}・${s.area}`} action={<Badge>{s.status}</Badge>} />
      <div className="stats">
        <Stat label="在所動物" value={animals.filter((a) => a.status !== "已領養").length} />
        <Stat label="領養申請" value={apps.length} />
        <Stat label="人員" value={`${staff.filter((x) => !x.disabled).length} / ${limitText(plan.staff)}`} hint={`已綁定 ${staff.filter((x) => x.lineUserId && !x.disabled).length}`} />
        <Stat label="本月 AI 呼叫" value={`${usage.calls ?? 0} / ${cap}`} />
      </div>
      <div className="grid-even">
        <form className="card stack" style={{ gap: 12 }} action={save}>
          <h2 style={{ margin: 0 }}>方案與狀態</h2>
          <label className="field">方案<select name="plan" defaultValue={s.plan}><option>試用</option><option>基本</option><option>進階</option></select></label>
          <label className="field">狀態<select name="status" defaultValue={s.status}><option>使用中</option><option>試用中</option><option>已停用</option></select></label>
          <label className="field">到期日<input name="due" type="date" defaultValue={s.due.replaceAll("/", "-")} /></label>
          <label className="field">每月 AI 呼叫上限（留空＝依方案）<input name="aiCap" type="number" min={1} defaultValue={s.aiCap ?? ""} placeholder={`方案預設 ${plan.aiCap}`} /></label>
          <p className="small muted">試用到期後 AI 功能會暫停；付費方案到期只會提醒續約。停用後協會無法登入後台，LINE 不再回應，動物也會從公開頁隱藏。</p>
          <button className="btn primary" style={{ justifySelf: "start" }}>儲存</button>
        </form>
        <div className="stack">
          <section className="card">
            <div className="row between"><h2 style={{ margin: 0 }}>LINE 官方帳號</h2><Badge tone={line.connected && line.ok ? "good" : "warn"}>{!line.connected ? "未串接" : line.ok ? "正常" : "需處理"}</Badge></div>
            {line.connected && <p className="small muted" style={{ margin: "6px 0 10px" }}>{line.detail}</p>}
            <details open={!line.connected}>
              <summary className="small" style={{ cursor: "pointer", margin: "8px 0" }}>{line.connected ? "重新串接或更換帳號" : "串接 LINE 官方帳號"}</summary>
              <ConnectLine sid={id} />
            </details>
          </section>
          <section className="card">
            <h2>協會管理者</h2>
            {managers.map((m) => <div className="todo" key={m.email}><span>{m.name}<br /><span className="small muted">{m.email}</span></span><ResetPassword email={m.email} /></div>)}
          </section>
        </div>
      </div>
    </>
  );
}
