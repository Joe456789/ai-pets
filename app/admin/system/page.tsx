import Link from "next/link";
import { refreshDemoAction, testGeminiAction } from "@/app/admin/actions";
import { ActionButton } from "@/components/ActionButton";
import { Badge, PageHead } from "@/components/ui";
import { MODEL } from "@/lib/ai/gemini";
import { requireAdmin } from "@/lib/auth";
import { lineStatus } from "@/lib/line/setup";
import { listErrors } from "@/lib/platform";
import { usingFirestore } from "@/lib/db";
import { getShelter, listShelters } from "@/lib/repo";
import { fmtDateTime } from "@/lib/time";

export default async function System() {
  await requireAdmin();
  const shelters = (await listShelters()).filter((s) => s.status !== "已停用");
  const [statuses, errors] = await Promise.all([Promise.all(shelters.map((s) => lineStatus(s.id))), listErrors(20)]);
  const name = new Map(shelters.map((s) => [s.id, s.name]));
  const hasDemo = Boolean(await getShelter("nuanwo"));
  return (
    <>
      <PageHead title="系統狀態" sub="各協會的 LINE 串接和平台服務是否正常。" />
      <div className="grid-even">
        <section className="card">
          <h2>LINE 串接</h2>
          {shelters.map((s, i) => {
            const st = statuses[i];
            return (
              <div className="todo" key={s.id}>
                <span><Link href={`/admin/shelters/${s.id}`}>{s.name}</Link>{st.connected && <><br /><span className="small muted">{st.detail}</span></>}</span>
                <Badge tone={!st.connected ? "warn" : st.ok ? "good" : "bad"}>{!st.connected ? "未串接" : st.ok ? "正常" : "異常"}</Badge>
              </div>
            );
          })}
        </section>
        <section className="card">
          <h2>平台服務</h2>
          <div className="todo"><span>Gemini（{MODEL()}）</span><ActionButton small showData label="測試連線" run={testGeminiAction} /></div>
          <div className="todo"><span>資料庫</span><Badge tone="good">{usingFirestore() ? "Firestore 正常" : "本機檔案"}</Badge></div>
          <div className="todo"><span>照片儲存</span><Badge tone="good">{process.env.GCS_BUCKET ? "Cloud Storage" : "本機檔案"}</Badge></div>
          {hasDemo && (
            <>
              <h2 style={{ marginTop: 16 }}>示範資料</h2>
              <p className="small muted" style={{ marginBottom: 8 }}>示範協會的收容天數、疫苗到期、照護回報和申請時間會隨時間變舊。給評審或協會看之前按一次，日期會更新到今天；照片、AI 影片和人員綁定不會變動。</p>
              <ActionButton small showData label="把示範資料日期更新到今天" run={refreshDemoAction} />
            </>
          )}
          <h2 style={{ marginTop: 16 }}>最近錯誤</h2>
          {errors.length === 0 && <p className="small muted">沒有錯誤紀錄。</p>}
          {errors.map((e) => <p className="small" key={e.id} style={{ marginBottom: 6 }}><span className="muted">{fmtDateTime(e.at)}　{name.get(e.sid) ?? e.sid}・{e.where}</span><br />{e.message}</p>)}
        </section>
      </div>
    </>
  );
}
