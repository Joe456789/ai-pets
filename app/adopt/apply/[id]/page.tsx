import { notFound } from "next/navigation";
import { ApplyForm } from "@/components/ApplyForm";
import { PetImage } from "@/components/PetImage";
import { getPublicAnimal } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function Apply({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await getPublicAnimal(id);
  if (!a) notFound();
  return (
    <div className="quiz">
      <div className="pet-cell" style={{ marginBottom: 12 }}>
        <span className="thumb" style={{ width: 56, height: 56 }}><PetImage pet={a} /></span>
        <div><h1 style={{ margin: 0 }}>申請領養{a.name}</h1><span className="small muted">送給 {a.shelterName}</span></div>
      </div>
      <ApplyForm animalPublicId={a.id} shelterName={a.shelterName} />
    </div>
  );
}
