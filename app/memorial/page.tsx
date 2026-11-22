import Link from "next/link";
import { DemoBanner, SignInCard } from "@/components/Gate";
import { Badge, PageHead, PetAvatar } from "@/components/ui";
import { currentUid } from "@/lib/auth";
import { isDemo, listMemorials, listPets } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function MemorialHome() {
  const uid = await currentUid();
  const intro = <PageHead title="紀念與告別" sub="陪牠走完一生，也是終養的一部分。當牠離開，用你手機裡的照片重建牠的 3D 樣子，留下你們的故事。" />;
  if (!uid) return <>{intro}<SignInCard what="為牠建立紀念" /></>;
  const [memorials, pets] = await Promise.all([listMemorials(uid), listPets(uid)]);
  const photoOf = new Map(pets.map((p) => [p.id, p.photo]));
  return (
    <>
      <DemoBanner uid={uid} />
      {intro}
      <div className="list">
        {memorials.map((m) => (
          <Link className="item" key={m.id} href={`/memorial/${m.id}`}>
            <PetAvatar name={m.petName} photo={photoOf.get(m.petId) ?? m.photos[0]} />
            <div className="grow"><b>{m.petName}</b><br /><span className="small muted">{m.status === "完成" ? "3D 紀念" : "3D 製作"}</span></div>
            <Badge>{m.status}</Badge>
          </Link>
        ))}
        {memorials.length === 0 && <div className="card empty">還沒有紀念。</div>}
      </div>
      {!isDemo(uid) && (
        <div style={{ marginTop: 16 }}>
          {pets.length ? <Link className="btn primary" href="/memorial/new">建立 3D 紀念</Link> : <p className="small muted">先在「我的毛孩」<Link href="/pets/new">新增毛孩</Link>，才能建立紀念。</p>}
        </div>
      )}
    </>
  );
}
