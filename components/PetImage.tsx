import { PetArt } from "@/components/PetArt";

const PALETTE = [["#c98f45", "#f3e3c3"], ["#7a5433", "#ecdcc8"], ["#2d2a28", "#e7dfcf"], ["#dd8a3e", "#f6e6c9"], ["#c7a27c", "#efe2d4"], ["#e8e3da", "#dbe2ea"]];

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

type Pet = { name: string; kind: string; photos?: string[]; color?: string; bg?: string };

/** 有照片就顯示照片；還沒有照片時顯示插畫。 */
export function PetImage({ pet }: { pet: Pet }) {
  const photo = pet.photos?.[0];
  // eslint-disable-next-line @next/next/no-img-element
  if (photo) return <img src={photo} alt={`${pet.name}的照片`} className="pet-photo" />;
  const [color, bg] = pet.color && pet.bg ? [pet.color, pet.bg] : PALETTE[hash(pet.name) % PALETTE.length];
  return <PetArt pet={{ kind: pet.kind, name: pet.name, color, bg }} />;
}
