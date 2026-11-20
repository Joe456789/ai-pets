"use client";
import { useState } from "react";
import { PetCard } from "@/components/PetCard";
import type { PublicAnimal } from "@/lib/types";

export function AdoptBrowser({ animals }: { animals: PublicAnimal[] }) {
  const [kind, setKind] = useState("全部");
  const [size, setSize] = useState("全部");
  const [age, setAge] = useState("全部");
  const [area, setArea] = useState("全部");
  const rows = animals.filter((a) =>
    (kind === "全部" || a.kind === kind) && (size === "全部" || a.size === size) &&
    (age === "全部" || a.ageGroup === age) && (area === "全部" || a.shelterArea === area));
  const sel = (label: string, v: string, set: (x: string) => void, opts: string[]) => (
    <label className="field">{label}
      <select value={v} onChange={(e) => set(e.target.value)}>{["全部", ...opts].map((o) => <option key={o}>{o}</option>)}</select>
    </label>
  );
  return (
    <>
      <div className="filters">
        {sel("種類", kind, setKind, ["狗", "貓"])}
        {sel("體型", size, setSize, ["小型", "中型", "大型"])}
        {sel("年齡", age, setAge, ["幼年", "成年", "老年"])}
        {sel("地區", area, setArea, [...new Set(animals.map((a) => a.shelterArea))])}
      </div>
      <p className="small muted" style={{ marginBottom: 10 }}>共 {rows.length} 隻</p>
      <div className="pet-grid">{rows.map((a) => <PetCard a={a} key={a.id} />)}</div>
      {rows.length === 0 && <p className="muted">沒有符合條件的動物，試著放寬篩選條件。</p>}
    </>
  );
}
