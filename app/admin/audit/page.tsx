import { PageHead } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { listAudit } from "@/lib/platform";
import { listShelters } from "@/lib/repo";
import { fmtDateTime } from "@/lib/time";

export default async function Audit() {
  await requireAdmin();
  const [logs, shelters] = await Promise.all([listAudit(150), listShelters()]);
  const name = new Map(shelters.map((s) => [s.id, s.name]));
  return (
    <>
      <PageHead title="操作紀錄" sub="最近 150 筆後台操作：誰在什麼時候改了什麼。" />
      <section className="card table-wrap">
        <table>
          <thead><tr><th>時間</th><th>操作者</th><th>協會</th><th>內容</th></tr></thead>
          <tbody>
            {logs.map((l) => <tr key={l.id}><td style={{ whiteSpace: "nowrap" }}>{fmtDateTime(l.at)}</td><td>{l.actor}</td><td>{name.get(l.sid) ?? (l.sid || "—")}</td><td>{l.action}</td></tr>)}
            {logs.length === 0 && <tr><td colSpan={4} className="muted">還沒有紀錄。</td></tr>}
          </tbody>
        </table>
      </section>
    </>
  );
}
