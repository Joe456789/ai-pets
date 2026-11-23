import { notFound } from "next/navigation";
import { PetCamera } from "@/components/PetCamera";
import { currentUid } from "@/lib/auth";
import { signedUrl } from "@/lib/media";
import { getMemorial, getPet } from "@/lib/repo";

export const dynamic = "force-dynamic";

/** 打開鏡頭，讓 3D 的牠在你身邊走走、跑跑、跳跳。權限跟紀念頁一樣：本人或有分享連結的人。 */
export default async function MemorialCameraPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const [{ id }, { t }] = await Promise.all([params, searchParams]);
  const m = await getMemorial(id);
  if (!m || m.status !== "完成" || !m.glb) notFound();
  const uid = await currentUid();
  const owner = uid === m.uid;
  const shared = Boolean(m.shareToken && t && t === m.shareToken);
  if (!owner && !shared) notFound();
  const pet = await getPet(m.uid, m.petId);
  const url = m.glb.startsWith("/files/") && !owner ? signedUrl(m.glb) : m.glb;
  const back = `/memorial/${m.id}${shared && !owner ? `?t=${m.shareToken}` : ""}`;
  return <PetCamera url={url} name={m.petName} heightCm={m.heightCm} traits={pet?.traits ?? []} backHref={back} />;
}
