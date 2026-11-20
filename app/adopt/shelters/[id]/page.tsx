import { notFound } from "next/navigation";
import { SupplyList } from "@/components/PledgeForm";
import { PetCard } from "@/components/PetCard";
import { getShelter, listPublicAnimalsOf } from "@/lib/repo";
import { publicSupplies } from "@/lib/supplies";

export const dynamic = "force-dynamic";

export default async function ShelterPublic({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getShelter(id);
  if (!s || s.status === "已停用") notFound();
  const [pets, supplies] = await Promise.all([listPublicAnimalsOf(s.id), publicSupplies(s.id)]);
  return (
    <>
      <section className="pub-hero" style={{ gridTemplateColumns: "1fr" }}>
        <div>
          <h1 style={{ fontSize: 34 }}>{s.name}</h1>
          <p>{s.intro}</p>
          <p className="small muted" style={{ marginBottom: 12 }}>{s.area}・{s.hours}</p>
          {s.lineAddUrl && <a className="btn" href={s.lineAddUrl} target="_blank" rel="noreferrer" style={{ background: "#06c755", color: "#fff", borderColor: "#06c755" }}>加入協會 LINE</a>}
        </div>
      </section>
      <h2 style={{ marginBottom: 10 }}>正在等家的毛孩（{pets.length}）</h2>
      <div className="pet-grid">{pets.map((a) => <PetCard a={a} key={a.id} />)}</div>
      {supplies.length > 0 && (
        <section style={{ marginTop: 28 }}>
          <h2 style={{ marginBottom: 6 }}>目前需要的物資</h2>
          <p className="small muted" style={{ marginBottom: 10 }}>不方便領養也可以幫忙。登記後協會會跟你確認寄送方式，這裡不收款。</p>
          <SupplyList sid={s.id} shelterName={s.name} supplies={supplies} />
        </section>
      )}
    </>
  );
}
