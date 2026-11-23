import Link from "next/link";
import { Badge, PageHead } from "@/components/ui";
import { ASSESS_BASIS, CHANGE_BASIS, SOURCES, type Basis, type Strength } from "@/lib/evidence";

const TONE: Record<Strength, string> = { 研究: "good", 指引: "good", 法規: "good", 常識: "muted" };
const num = new Map(SOURCES.map((s, i) => [s.id, i + 1]));

/** 評估依據：每一題為什麼要問、出處是什麼。公開頁，不用登入。 */
export default function BasisPage() {
  return (
    <>
      <PageHead
        title="評估的依據"
        sub="飼養前評估和生活變動檢查的每一題，都對應研究指出的「飼主放棄貓狗的原因」，或動保、寵物專業機構給飼主的建議。分數和清單由固定規則計算，AI 只負責把結果寫成白話。"
        action={<Link className="btn small" href="/assess">回評估</Link>}
      />

      <Table title="飼養前評估的 15 題" rows={ASSESS_BASIS} />
      <Table title="生活變動檢查的 8 種變動" rows={CHANGE_BASIS} />

      <section className="card" style={{ marginBottom: 18 }}>
        <h2>台灣的法規</h2>
        <p className="small">依動物保護法第 5 條第 3 項，飼主不得棄養；違反的依第 29 條處新臺幣 3 萬元以上 15 萬元以下罰鍰。<a href={SOURCES.find((s) => s.id === "twLaw")!.url} target="_blank" rel="noreferrer">［{num.get("twLaw")}］</a></p>
      </section>

      <section className="card" style={{ marginBottom: 18 }}>
        <h2>目前的限制</h2>
        <ul className="points small">
          <li>引用的研究多數來自美國和英國；我們沒有找到台灣公開的「棄養原因」統計。</li>
          <li>預算和預備金的門檻、各題的權重，是本作品依台灣常見市價和研究整理的設定，還需要獸醫或動保專業人員檢視。</li>
          <li>標示「常識」的項目，目前還沒有找到直接的文獻。</li>
          <li>答案都是自己填的，結果是幫助自己想清楚的參考，不是保證。</li>
        </ul>
      </section>

      <section className="card">
        <h2>參考資料</h2>
        <ol className="small" style={{ paddingLeft: 20, display: "grid", gap: 6 }}>
          {SOURCES.map((s) => (
            <li key={s.id} id={`src-${s.id}`}>{s.cite} <a href={s.url} target="_blank" rel="noreferrer">連結</a></li>
          ))}
        </ol>
      </section>
    </>
  );
}

function Table({ title, rows }: { title: string; rows: Basis[] }) {
  return (
    <section style={{ marginBottom: 18 }}>
      <h2 className="section-title">{title}</h2>
      <div className="list">
        {rows.map((r) => (
          <div className="card" key={r.topic} style={{ padding: 14 }}>
            <div className="row between"><b>{r.topic}</b><Badge tone={TONE[r.strength]}>{r.strength}</Badge></div>
            <p className="small" style={{ marginTop: 6 }}>
              {r.why}
              {r.sources.map((id) => <a key={id} href={`#src-${id}`}>［{num.get(id)}］</a>)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
