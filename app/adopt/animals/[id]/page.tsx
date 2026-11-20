import Link from "next/link";
import { notFound } from "next/navigation";
import { PetImage } from "@/components/PetImage";
import { Notice } from "@/components/ui";
import { getPublicAnimal, getShelter } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function AnimalPublic({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await getPublicAnimal(id);
  if (!a) notFound();
  const s = await getShelter(a.sid);
  return (
    <div className="detail">
      <div className="detail-art"><PetImage pet={a} /></div>
      <div>
        <h1>{a.name}</h1>
        <p className="muted">{[a.kind, a.sex, a.age, a.size, a.coat].filter(Boolean).join("・")}</p>
        <div className="chips" style={{ margin: "10px 0" }}>{a.traits.map((t) => <span className="chip" key={t}>{t}</span>)}</div>
        <p>{a.story}</p>
        {a.needs.length > 0 && <section><h2>照顧時要注意</h2><ul>{a.needs.map((n) => <li key={n}>{n}</li>)}</ul></section>}
        {a.goodFor.length > 0 && <section><h2>可能適合</h2><ul>{a.goodFor.map((n) => <li key={n}>{n}</li>)}</ul></section>}
        {a.needs.length > 0 && <div style={{ marginTop: 12 }}><Notice compact /></div>}
        <section className="card" style={{ marginTop: 20 }}>
          <div className="row between">
            <div><b>{a.shelterName}</b><br /><span className="small muted">{a.shelterArea}・{s?.hours}</span></div>
            <Link className="btn small" href={`/adopt/shelters/${a.sid}`}>協會頁面</Link>
          </div>
        </section>
        <div className="row" style={{ marginTop: 16 }}>
          <Link className="btn clay" href={`/adopt/apply/${a.id}`}>申請領養</Link>
          {(a.photos.length > 0 || a.cutout) && <Link className="btn primary" href={`/adopt/animals/${a.id}/ar`}>{a.motion ? "看看牠在你家（會動）" : "看看牠在你家"}</Link>}
          {s?.lineAddUrl && <a className="btn" href={s.lineAddUrl} target="_blank" rel="noreferrer">用 LINE 詢問</a>}
        </div>
      </div>
    </div>
  );
}
