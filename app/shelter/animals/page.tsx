import { AnimalsTable } from "@/components/AnimalsTable";
import { PageHead } from "@/components/ui";
import { requireManager } from "@/lib/auth";
import { isFlagged, listAnimals } from "@/lib/repo";
import { daysSince } from "@/lib/time";

export default async function Animals() {
  const { sid } = await requireManager();
  const animals = await listAnimals(sid);
  const rows = animals
    .map((a) => ({
      ...a,
      days: a.adoptedAt ? Math.max(0, Math.round((Date.parse(a.adoptedAt) - Date.parse(a.intakeAt)) / 864e5)) : daysSince(a.intakeAt),
      flagged: a.status !== "已領養" && isFlagged(a),
    }))
    .sort((a, b) => Number(a.status === "已領養") - Number(b.status === "已領養") || Number(b.flagged) - Number(a.flagged) || b.days - a.days);
  return (
    <>
      <PageHead title="動物管理" sub="現場人員在 LINE 建檔後會出現在這裡，管理者可以補充和修改。" />
      <AnimalsTable animals={rows} />
    </>
  );
}
