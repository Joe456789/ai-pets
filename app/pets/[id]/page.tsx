import { notFound } from "next/navigation";
import { DemoBanner, SignInCard } from "@/components/Gate";
import { DeletePet } from "@/components/DeletePet";
import { PetForm } from "@/components/PetForm";
import { PageHead } from "@/components/ui";
import { currentUid } from "@/lib/auth";
import { getPet, isDemo } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function EditPet({ params }: { params: Promise<{ id: string }> }) {
  const uid = await currentUid();
  if (!uid) return <SignInCard what="編輯毛孩" />;
  const pet = await getPet(uid, (await params).id);
  if (!pet) notFound();
  return (
    <>
      <DemoBanner uid={uid} />
      <PageHead title={`編輯${pet.name}`} action={!isDemo(uid) ? <a className="btn small" href="#delete">刪除</a> : undefined} />
      <PetForm pet={pet} />
      {!isDemo(uid) && <div id="delete" style={{ marginTop: 18 }}><DeletePet id={pet.id} name={pet.name} passed={pet.status === "已離開"} /></div>}
    </>
  );
}
