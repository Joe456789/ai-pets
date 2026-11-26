import Link from "next/link";
import { DemoBanner, SignInCard } from "@/components/Gate";
import { MemorialForm } from "@/components/MemorialForm";
import { PageHead } from "@/components/ui";
import { currentUid } from "@/lib/auth";
import { isDemo, listMemorials, listPets } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function NewMemorial({ searchParams }: { searchParams: Promise<{ pet?: string }> }) {
  const uid = await currentUid();
  if (!uid) return <SignInCard what="為牠建立紀念" />;
  const [pets, memorials] = await Promise.all([listPets(uid), listMemorials(uid)]);
  // 牠還在時已經做好的 3D，可以直接拿來當紀念
  const keeps = memorials.filter((m) => m.keepsake && m.status === "完成").map((m) => m.petId);
  const { pet } = await searchParams;
  // 已離開的排前面
  const sorted = [...pets].sort((a, b) => (a.status === b.status ? 0 : a.status === "已離開" ? -1 : 1));
  return (
    <>
      <DemoBanner uid={uid} />
      <PageHead title="建立 3D 紀念" sub="謝謝你陪牠走到最後。挑幾張你最喜歡的照片，我們用它們重建牠的樣子。" />
      {isDemo(uid) ? <p className="card empty">示範帳號不能建立新的紀念，可以看看<Link href="/memorial">示範的紀念</Link>。</p>
        : pets.length ? <MemorialForm pets={sorted.map((p) => ({ id: p.id, name: p.name }))} initial={pet} keeps={keeps} />
        : <p className="card empty">先<Link href="/pets/new">新增毛孩</Link>，才能建立紀念。</p>}
    </>
  );
}
