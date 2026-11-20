import Link from "next/link";
import { SupplyList } from "@/components/PledgeForm";
import { listShelters } from "@/lib/repo";
import { publicSupplies } from "@/lib/supplies";

export const dynamic = "force-dynamic";

/** 各協會需要的物資。網址帶 ?s=協會代號 時只顯示那一家（募集貼文的連結）。 */
export default async function SuppliesPublic({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s: only } = await searchParams;
  const shelters = (await listShelters()).filter((s) => s.status !== "已停用" && (!only || s.id === only));
  const rows = (await Promise.all(shelters.map(async (s) => ({ s, items: await publicSupplies(s.id) }))))
    .filter((r) => r.items.length > 0 || only)
    .sort((a, b) => Number(b.items.some((i) => i.urgent)) - Number(a.items.some((i) => i.urgent)) || b.items.length - a.items.length);
  return (
    <>
      <section className="pub-hero" style={{ gridTemplateColumns: "1fr" }}>
        <div>
          <h1 style={{ fontSize: 34 }}>捐物資</h1>
          <p>不方便領養，也可以幫忙。各協會列出目前缺的物資，登記後協會會跟你確認寄送或送達方式。這裡只登記實體物資，不收款。</p>
          {only && <Link className="small" href="/adopt/supplies">看所有協會的物資需求</Link>}
        </div>
      </section>
      {rows.length === 0 && <p className="muted">目前沒有協會列出物資需求。</p>}
      {rows.map(({ s, items }) => (
        <section key={s.id} style={{ marginBottom: 28 }}>
          <div className="row between" style={{ marginBottom: 10 }}>
            <h2 style={{ margin: 0 }}>{s.name}</h2>
            <span className="small muted">{[s.area, s.hours].filter(Boolean).join("・")}　<Link href={`/adopt/shelters/${s.id}`}>協會頁面</Link></span>
          </div>
          <SupplyList sid={s.id} shelterName={s.name} supplies={items} />
        </section>
      ))}
    </>
  );
}
