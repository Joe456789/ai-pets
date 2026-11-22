import { notFound } from "next/navigation";
import { DemoBanner, SignInCard } from "@/components/Gate";
import { PetForm } from "@/components/PetForm";
import { PageHead } from "@/components/ui";
import { currentUid } from "@/lib/auth";
import { getPet } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function EditPet({ params }: { params: Promise<{ id: string }> }) {
  const uid = await currentUid();
  if (!uid) return <SignInCard what="編輯毛孩" />;
  const pet = await getPet(uid, (await params).id);
  if (!pet) notFound();
  return (
    <>
      <DemoBanner uid={uid} />
      <PageHead title={`編輯${pet.name}`} />
      <PetForm pet={pet} />
    </>
  );
}
