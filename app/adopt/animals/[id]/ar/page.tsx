import Link from "next/link";
import { notFound } from "next/navigation";
import { ArStage } from "@/components/ArStage";
import { estimateHeightCm, reactionsFor } from "@/lib/ar";
import { getPublicAnimal } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function ArPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await getPublicAnimal(id);
  if (!a) notFound();
  if (!a.photos.length && !a.cutout) {
    return (
      <div className="quiz card" style={{ textAlign: "center" }}>
        <h1>{a.name}還沒有照片</h1>
        <p className="muted">協會上傳{a.name}的照片後，就能把牠放進你家看看。也可以先看看牠的介紹，或直接到現場認識牠。</p>
        <div className="row" style={{ justifyContent: "center", marginTop: 12 }}>
          <Link className="btn" href={`/adopt/animals/${a.id}`}>看{a.name}的介紹</Link>
          <Link className="btn clay" href={`/adopt/apply/${a.id}`}>申請領養</Link>
        </div>
      </div>
    );
  }
  return (
    <ArStage
      pet={{
        id: a.id, name: a.name, kind: a.kind, size: a.size, photo: a.photos[0] ?? null, cutout: a.cutout ?? null, motion: a.motion ?? null, model3d: a.model3d ?? null,
        heightCm: estimateHeightCm(a), reactions: reactionsFor(a.traits), shelterName: a.shelterName,
      }}
    />
  );
}
