import { DemoBanner, SignInCard } from "@/components/Gate";
import { PetForm } from "@/components/PetForm";
import { PageHead } from "@/components/ui";
import { currentUid } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewPet() {
  const uid = await currentUid();
  if (!uid) return <SignInCard what="新增毛孩" />;
  return (
    <>
      <DemoBanner uid={uid} />
      <PageHead title="新增毛孩" sub="之後的醫療單據和紀錄都會存在牠底下。" />
      <PetForm />
    </>
  );
}
