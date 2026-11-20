import Link from "next/link";
import { listPublicAnimals, listShelters } from "@/lib/repo";

export const dynamic = "force-dynamic";

/** 所有合作協會，依正在等家的動物數排序。停用中的協會不顯示。 */
export default async function SheltersPublic() {
  const [shelters, pets] = await Promise.all([listShelters(), listPublicAnimals()]);
  const count = new Map<string, { dog: number; cat: number }>();
  for (const p of pets) {
    const c = count.get(p.sid) ?? { dog: 0, cat: 0 };
    if (p.kind === "貓") c.cat++;
    else c.dog++;
    count.set(p.sid, c);
  }
  const rows = shelters
    .filter((s) => s.status !== "已停用")
    .map((s) => ({ s, c: count.get(s.id) ?? { dog: 0, cat: 0 } }))
    .sort((a, b) => b.c.dog + b.c.cat - (a.c.dog + a.c.cat));
  return (
    <>
      <section className="pub-hero" style={{ gridTemplateColumns: "1fr" }}>
        <div>
          <h1 style={{ fontSize: 34 }}>合作協會</h1>
          <p>這些民間協會和中途用浪浪夥伴照顧和送養毛孩。點進去可以看各協會正在等家的貓狗。</p>
        </div>
      </section>
      <div className="shelter-grid">
        {rows.map(({ s, c }) => (
          <Link key={s.id} href={`/adopt/shelters/${s.id}`} className="card shelter-card">
            <b style={{ font: "900 19px var(--serif)" }}>{s.name}</b>
            <span className="small muted">{[s.area, s.hours].filter(Boolean).join("・")}</span>
            {s.intro && <p className="small">{s.intro}</p>}
            <span className="small">{c.dog + c.cat === 0 ? "目前沒有公開的毛孩" : `正在等家：${[c.dog && `狗 ${c.dog} 隻`, c.cat && `貓 ${c.cat} 隻`].filter(Boolean).join("、")}`}</span>
          </Link>
        ))}
        {rows.length === 0 && <p className="muted">目前還沒有合作協會。</p>}
      </div>
    </>
  );
}
