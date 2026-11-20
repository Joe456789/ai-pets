import Link from "next/link";
import { WeeklyFocus } from "@/components/WeeklyFocus";
import { Badge, Notice, PageHead } from "@/components/ui";
import { requireManager } from "@/lib/auth";
import { shelterSuggestions } from "@/lib/insights";

const TONE = { 送養: "good", 照護: "warn", 資源: "info", 資料: "muted", 申請: "warn" } as const;

export default async function Suggestions() {
  const { sid } = await requireManager();
  const items = await shelterSuggestions(sid);
  return (
    <>
      <PageHead title="AI 建議" sub="系統依收容天數、申請、照護回報和資料完整度找出該處理的事，由管理者決定是否採用。" />
      <WeeklyFocus />
      <div style={{ margin: "12px 0" }}><Notice compact /></div>
      {items.length === 0 && <p className="muted">目前沒有需要特別處理的事項。</p>}
      <div className="grid-even">
        {items.map((s) => (
          <section className="card" key={s.title}>
            <div className="row between" style={{ marginBottom: 6 }}>
              <h2 style={{ margin: 0 }}>{s.title}</h2>
              <Badge tone={TONE[s.kind]}>{s.kind}</Badge>
            </div>
            <p className="small muted" style={{ marginBottom: 12 }}>{s.why}</p>
            <Link className="btn small primary" href={s.href}>{s.action}</Link>
          </section>
        ))}
      </div>
    </>
  );
}
