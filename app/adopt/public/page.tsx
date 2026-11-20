import Link from "next/link";
import { countiesOf, filterOpenAnimals, listOpenAnimals, OPEN_DATA_CREDIT, OPEN_DATA_PAGE } from "@/lib/opendata";

export const dynamic = "force-dynamic";

type Q = { county?: string; kind?: string; size?: string; page?: string };

/** 全國公立收容所開放認養的貓狗（農業部開放資料）。 */
export default async function PublicShelterAnimals({ searchParams }: { searchParams: Promise<Q> }) {
  const q = await searchParams;
  const rows = await listOpenAnimals();
  const counties = countiesOf(rows);
  const res = filterOpenAnimals(rows, { county: q.county, kind: q.kind, size: q.size, page: Number(q.page) || 1 });
  const href = (patch: Partial<Q>) => {
    const p = new URLSearchParams(Object.entries({ ...q, page: undefined, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/adopt/public${p.size ? `?${p}` : ""}`;
  };
  return (
    <>
      <section className="pub-hero" style={{ gridTemplateColumns: "1fr" }}>
        <div>
          <h1 style={{ fontSize: 34 }}>公立收容所的毛孩</h1>
          <p>全國公立動物收容所目前開放認養的貓狗，每天依政府開放資料更新。這些毛孩不在合作協會裡，想認養請直接聯絡各收容所。</p>
          <p className="small muted">{OPEN_DATA_CREDIT}・<a href={OPEN_DATA_PAGE} target="_blank" rel="noreferrer">資料集頁面</a></p>
        </div>
      </section>

      {rows.length === 0 ? (
        <p className="error-box">暫時讀不到政府開放資料，請稍後再試。</p>
      ) : (
        <>
          <form className="filters" action="/adopt/public">
            <label className="field">縣市
              <select name="county" defaultValue={q.county ?? ""}>
                <option value="">全部（{rows.length}）</option>
                {counties.map((c) => <option key={c.county} value={c.county}>{c.county}（{c.count}）</option>)}
              </select>
            </label>
            <label className="field">種類
              <select name="kind" defaultValue={q.kind ?? ""}><option value="">全部</option><option>狗</option><option>貓</option></select>
            </label>
            <label className="field">體型
              <select name="size" defaultValue={q.size ?? ""}><option value="">全部</option><option>小型</option><option>中型</option><option>大型</option></select>
            </label>
            <button className="btn small primary" style={{ alignSelf: "end" }}>篩選</button>
          </form>
          <p className="small muted" style={{ margin: "10px 0" }}>共 {res.total} 隻，第 {res.page} / {res.pages} 頁</p>
          <div className="pet-grid">
            {res.items.map((a) => (
              <Link className="pet-card" href={`/adopt/public/${a.id}`} key={a.id}>
                {a.photo
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img className="pet-photo" src={a.photo} alt={`${a.shelter}的${a.kind}`} loading="lazy" referrerPolicy="no-referrer" />
                  : <div className="pet-photo open-nophoto">尚無照片</div>}
                <div className="pet-card-body">
                  <h3>{a.colour}{a.variety || a.kind}</h3>
                  <p className="small muted">{[a.kind, a.sex, a.age, a.size].filter((x) => x !== "未知").join("・")}</p>
                  <p className="small muted">{a.shelter}</p>
                </div>
              </Link>
            ))}
          </div>
          <div className="row" style={{ justifyContent: "center", marginTop: 16 }}>
            {res.page > 1 && <Link className="btn small" href={href({ page: String(res.page - 1) })}>上一頁</Link>}
            {res.page < res.pages && <Link className="btn small" href={href({ page: String(res.page + 1) })}>下一頁</Link>}
          </div>
        </>
      )}
    </>
  );
}
