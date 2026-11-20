import { ContentEditor } from "@/components/ContentEditor";
import { PageHead } from "@/components/ui";
import { requireManager } from "@/lib/auth";
import { listAnimals } from "@/lib/repo";

export default async function Content({ searchParams }: { searchParams: Promise<{ animal?: string }> }) {
  const { sid } = await requireManager();
  const { animal } = await searchParams;
  const animals = (await listAnimals(sid)).filter((a) => a.status !== "已領養").sort((a, b) => Number(a.published) - Number(b.published));
  return (
    <>
      <PageHead title="送養內容" sub="AI 根據動物檔案寫草稿，人員確認後才會公開。" />
      <ContentEditor animals={animals} initialId={animal} />
    </>
  );
}
