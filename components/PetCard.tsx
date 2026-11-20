import Link from "next/link";
import { PetImage } from "@/components/PetImage";
import type { PublicAnimal } from "@/lib/types";

export function PetCard({ a }: { a: PublicAnimal }) {
  return (
    <Link className="pet-card" href={`/adopt/animals/${a.id}`}>
      <PetImage pet={a} />
      <div className="pet-card-body">
        <h3>{a.name}</h3>
        <p className="small muted">{a.kind}・{a.sex}・{a.age || "年齡未填"}・{a.size}</p>
        <div className="chips">{a.traits.slice(0, 2).map((t) => <span className="chip" key={t}>{t}</span>)}</div>
        <p className="small muted">{a.shelterName}・{a.shelterArea}</p>
      </div>
    </Link>
  );
}
