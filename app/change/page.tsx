import { ChangeForm } from "@/components/ChangeForm";
import { DemoBanner } from "@/components/Gate";
import { PageHead } from "@/components/ui";
import { currentUid } from "@/lib/auth";
import { listPets } from "@/lib/repo";
import { taipeiDate } from "@/lib/time";

export const dynamic = "force-dynamic";

/** 生活變動檢查。不用登入也能做；登入後可以選自己的毛孩、存檔、設提醒。 */
export default async function ChangePage({ searchParams }: { searchParams: Promise<{ pet?: string }> }) {
  const uid = await currentUid();
  const pets = uid ? (await listPets(uid)).filter((p) => p.status === "在世").map((p) => ({ id: p.id, name: p.name, kind: p.kind })) : [];
  const { pet } = await searchParams;
  return (
    <>
      {uid && <DemoBanner uid={uid} />}
      <PageHead title="生活變動檢查" sub="搬家、懷孕、出國、工作變忙、經濟變緊……生活有變動，是很多人放棄毛孩的時候。回答 7 個問題，拿到分階段的準備清單，讓牠可以繼續留在你身邊。" />
      <ChangeForm pets={pets} initialPet={pet} today={taipeiDate()} />
    </>
  );
}
