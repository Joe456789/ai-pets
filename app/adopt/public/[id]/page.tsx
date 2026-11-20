import Link from "next/link";
import { notFound } from "next/navigation";
import { OpenIntroBox } from "@/components/OpenIntroBox";
import { getOpenAnimal, OPEN_DATA_CREDIT, OPEN_DATA_PAGE } from "@/lib/opendata";

export const dynamic = "force-dynamic";

export default async function PublicShelterAnimal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await getOpenAnimal(id);
  if (!a) notFound();
  return (
    <div className="detail">
      <div className="detail-art">
        {a.photo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img className="pet-photo" src={a.photo} alt={`${a.shelter}的${a.kind}`} referrerPolicy="no-referrer" />
          : <div className="pet-photo open-nophoto">收容所還沒有提供照片</div>}
      </div>
      <div>
        <p className="small muted"><Link href="/adopt/public">公立收容所的毛孩</Link> ／ 編號 {a.id}</p>
        <h1>{a.colour}{a.variety || a.kind}</h1>
        <p className="muted">{[a.kind, a.sex, a.age, a.size, a.sterilized].filter((x) => x !== "未知").join("・")}</p>
        <OpenIntroBox id={a.id} />
        {a.remark && <section><h2>收容所備註</h2><p>{a.remark}</p></section>}
        <section className="card" style={{ marginTop: 20 }}>
          <b>{a.shelter}</b>
          <p className="small muted">{a.shelterAddr}{a.shelterTel && `・${a.shelterTel}`}</p>
          <p className="small" style={{ marginTop: 6 }}>想認養或到現場看看，請直接聯絡收容所，並告訴他們動物編號 <b>{a.id}</b>。開放認養日期 {a.openDate}，資料更新於 {a.updated}，實際狀況以收容所為準。</p>
          <div className="row" style={{ marginTop: 10 }}>
            {a.shelterTel && <a className="btn small clay" href={`tel:${a.shelterTel.replace(/[^\d+]/g, "")}`}>打電話給收容所</a>}
            {a.shelterAddr && <a className="btn small" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.shelterAddr)}`} target="_blank" rel="noreferrer">地圖</a>}
          </div>
        </section>
        <p className="small muted" style={{ marginTop: 12 }}>{OPEN_DATA_CREDIT}・<a href={OPEN_DATA_PAGE} target="_blank" rel="noreferrer">資料集頁面</a></p>
      </div>
    </div>
  );
}
