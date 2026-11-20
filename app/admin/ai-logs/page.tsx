import { markAiLogReviewedAction } from "@/app/admin/actions";
import { ActionButton } from "@/components/ActionButton";
import { Badge, PageHead } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { listAiLogs } from "@/lib/platform";
import { listShelters } from "@/lib/repo";
import { fmtDateTime } from "@/lib/time";

const TONE = { 正常: "good", 已攔截: "bad", 已轉人工: "info", 已抽查: "muted" } as const;

export default async function AiLogs() {
  await requireAdmin();
  const [logs, shelters] = await Promise.all([listAiLogs(100), listShelters()]);
  const name = new Map(shelters.map((s) => [s.id, s.name]));
  return (
    <>
      <PageHead title="AI 回覆紀錄" sub="最近 100 筆 AI 回答和轉人工紀錄，只保留前 200 字。被健康宣稱檢查攔下的回答請優先抽查。" />
      <div className="stack">
        {logs.length === 0 && <p className="muted">還沒有紀錄。領養人在 LINE 提問後會出現在這裡。</p>}
        {logs.map((l) => (
          <section className="card" key={l.id}>
            <div className="row between" style={{ marginBottom: 6 }}>
              <span className="row"><Badge tone="info">{l.kind}</Badge><span className="small muted">{name.get(l.sid) ?? l.sid}・{fmtDateTime(l.at)}</span></span>
              <span className="row"><Badge tone={TONE[l.state]}>{l.state}</Badge>{l.state === "已攔截" && <ActionButton small label="已抽查" run={markAiLogReviewedAction.bind(null, l.id)} />}</span>
            </div>
            <p className="small muted">領養人：{l.input}</p>
            <p>回覆：{l.output}</p>
          </section>
        ))}
      </div>
    </>
  );
}
