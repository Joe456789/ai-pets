import Link from "next/link";
import { NewShelterForm } from "@/components/NewShelterForm";
import { Badge, PageHead } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { platformOverview, shelterLabel } from "@/lib/insights";

export default async function AdminShelters() {
  await requireAdmin();
  const { rows } = await platformOverview();
  return (
    <>
      <PageHead title="協會管理" sub="開通協會、調整方案、串接 LINE 官方帳號。" />
      <NewShelterForm />
      <section className="card table-wrap">
        <table>
          <thead><tr><th>協會</th><th>地區</th><th>方案</th><th>到期日</th><th className="num">在所動物</th><th>LINE</th><th>狀態</th><th></th></tr></thead>
          <tbody>
            {rows.map(({ s, animals, line }) => (
              <tr key={s.id}>
                <td><b>{s.name}</b><br /><span className="small muted">{s.id}</span></td>
                <td>{s.area}</td>
                <td><Badge>{s.plan}</Badge></td>
                <td>{s.due}{shelterLabel(s) && <><br /><span className="small" style={{ color: "var(--clay)" }}>{shelterLabel(s)}</span></>}</td>
                <td className="num">{animals.filter((a) => a.status !== "已領養").length}</td>
                <td><Badge tone={line ? "good" : "warn"}>{line ? "已串接" : "未串接"}</Badge></td>
                <td><Badge>{s.status}</Badge></td>
                <td><Link className="btn small" href={`/admin/shelters/${s.id}`}>管理</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
