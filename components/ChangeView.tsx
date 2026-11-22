import { Badge, Notice } from "@/components/ui";
import type { ChangePhase, ChangePlan } from "@/lib/types";

const PHASES: { key: ChangePhase; title: string }[] = [
  { key: "現在", title: "現在就可以做" },
  { key: "變動前", title: "變動之前" },
  { key: "變動後", title: "變動之後" },
];
const TONE = { 低: "good", 中: "warn", 高: "bad" } as const;

/** 生活變動檢查的結果：程度、AI 的一段話、分階段清單、可以找誰。剛做完和存檔後看都用這個。 */
export function ChangeView({ plan, petName, change, aiNote, aiError, remindOn }: {
  plan: ChangePlan; petName: string; change: string; aiNote: string | null; aiError?: string; remindOn?: string | null;
}) {
  return (
    <div className="stack">
      <section className="card stack">
        <div className="row between">
          <h2 style={{ margin: 0 }}>{petName}・{change}</h2>
          <Badge tone={TONE[plan.level]}>{`需要準備：${plan.level}`}</Badge>
        </div>
        <p>{plan.headline}</p>
        {plan.why.length > 0 && <p className="small muted">主要原因：{plan.why.join("、")}</p>}
        {aiNote ? <p><span className="ai-tag">AI 說明</span>　{aiNote}</p> : aiError && <p className="small muted">{aiError}</p>}
        {remindOn && <p className="small">已設好提醒：{remindOn.slice(5).replace("-", "/")} 會用 LINE 提醒你再看一次這份清單。</p>}
      </section>

      {PHASES.map(({ key, title }) => {
        const list = plan.steps.filter((s) => s.phase === key);
        if (!list.length) return null;
        return (
          <section className="card" key={key}>
            <h2>{title}</h2>
            <ul className="points">{list.map((s) => <li key={s.text}>{s.text}</li>)}</ul>
          </section>
        );
      })}

      <section className="card">
        <h2>可以找誰幫忙</h2>
        <ul className="points small">{plan.help.map((h) => <li key={h}>{h}</li>)}</ul>
        <p className="tiny" style={{ marginTop: 8 }}>程度和清單由固定規則整理，AI 只負責寫說明。每個家庭情況不同，請依實際狀況調整。</p>
      </section>
      <Notice />
    </div>
  );
}
