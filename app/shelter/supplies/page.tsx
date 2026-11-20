import { SuppliesPanel } from "@/components/SuppliesPanel";
import { PageHead } from "@/components/ui";
import { requireManager } from "@/lib/auth";
import { listPledges, listSupplies } from "@/lib/supplies";

export default async function Supplies() {
  const { sid } = await requireManager();
  const [supplies, pledges] = await Promise.all([listSupplies(sid), listPledges(sid)]);
  return (
    <>
      <PageHead title="物資需求" sub="列出缺的物資，會顯示在協會的公開頁。民眾登記捐贈後，收到再按「已收到」，數量會自動累計。" />
      <SuppliesPanel supplies={supplies} pledges={pledges} publicUrl={`${process.env.APP_URL ?? ""}/adopt/supplies?s=${sid}`} />
    </>
  );
}
