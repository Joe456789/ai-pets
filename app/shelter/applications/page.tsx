import { ApplicationsPanel } from "@/components/ApplicationsPanel";
import { PageHead } from "@/components/ui";
import { requireManager } from "@/lib/auth";
import { listAnimals, listApplications } from "@/lib/repo";

export default async function Applications() {
  const { sid } = await requireManager();
  const [apps, animals] = await Promise.all([listApplications(sid), listAnimals(sid)]);
  return (
    <>
      <PageHead title="領養申請" sub="申請人的資料只有協會管理者看得到。" />
      <ApplicationsPanel applications={apps} adopted={animals.filter((a) => a.status === "已領養").map((a) => a.id)} />
    </>
  );
}
