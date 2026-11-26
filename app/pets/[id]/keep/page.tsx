import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoBanner, SignInCard } from "@/components/Gate";
import { KeepsakeForm } from "@/components/KeepsakeForm";
import { PageHead } from "@/components/ui";
import { currentUid } from "@/lib/auth";
import { getPet, isDemo, keepsakeOf } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function KeepPage({ params }: { params: Promise<{ id: string }> }) {
  const uid = await currentUid();
  if (!uid) return <SignInCard what="幫毛孩留下 3D" />;
  const pet = await getPet(uid, (await params).id);
  if (!pet) notFound();
  const old = await keepsakeOf(uid, pet.id);
  return (
    <>
      <DemoBanner uid={uid} />
      <PageHead title={`幫${pet.name}留下 3D`} sub={`趁${pet.name}還在身邊，從幾個角度拍下牠。角度越完整，做出來的 3D 越像牠，可以轉著看、打開鏡頭讓牠出現在你身邊。`} />
      {pet.status !== "在世" ? <p className="card empty">{pet.name}已經離開了，可以到<Link href={`/memorial/new?pet=${pet.id}`}>紀念與告別</Link>為牠建立紀念。</p>
        : isDemo(uid) ? <p className="card empty">示範帳號不能上傳照片。</p>
        : (
          <>
            {old && <p className="card small">已經有一份{old.status === "完成" ? "做好的" : old.status}的 3D，<Link href={`/memorial/${old.id}`}>去看看</Link>。在這裡重拍會取代它。</p>}
            <KeepsakeForm petId={pet.id} name={pet.name} />
          </>
        )}
    </>
  );
}
