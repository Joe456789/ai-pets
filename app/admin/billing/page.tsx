import { markInvoicePaidAction } from "@/app/admin/actions";
import { ActionButton } from "@/components/ActionButton";
import { InvoiceForm } from "@/components/InvoiceForm";
import { Badge, PageHead, Stat } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { listInvoices } from "@/lib/platform";
import { listShelters } from "@/lib/repo";
import { fmtDate } from "@/lib/time";

export default async function Billing() {
  await requireAdmin();
  const [invoices, shelters] = await Promise.all([listInvoices(), listShelters()]);
  const paid = invoices.filter((i) => i.state === "已收款").reduce((s, i) => s + i.amount, 0);
  const unpaid = invoices.filter((i) => i.state === "待收款").reduce((s, i) => s + i.amount, 0);
  return (
    <>
      <PageHead title="訂閱與收費" sub="先手動記錄收款，還沒有串金流。月費定價尚未決定。" />
      <div className="stats">
        <Stat label="累計已收" value={`NT$${paid.toLocaleString()}`} />
        <Stat label="待收款" value={`NT$${unpaid.toLocaleString()}`} />
      </div>
      <InvoiceForm shelters={shelters.map((s) => ({ id: s.id, name: s.name }))} />
      <section className="card table-wrap">
        <table>
          <thead><tr><th>協會</th><th>期間</th><th>方案</th><th className="num">金額</th><th>建立日期</th><th>狀態</th><th></th></tr></thead>
          <tbody>
            {invoices.map((r) => (
              <tr key={r.id}>
                <td><b>{r.shelterName}</b></td>
                <td>{r.period}</td>
                <td><Badge>{r.plan}</Badge></td>
                <td className="num">NT${r.amount.toLocaleString()}</td>
                <td>{fmtDate(r.at)}</td>
                <td><Badge>{r.state}</Badge></td>
                <td>{r.state === "待收款" && <ActionButton small label="標記已收款" run={markInvoicePaidAction.bind(null, r.id)} />}</td>
              </tr>
            ))}
            {invoices.length === 0 && <tr><td colSpan={7} className="muted">還沒有收費紀錄。</td></tr>}
          </tbody>
        </table>
      </section>
    </>
  );
}
