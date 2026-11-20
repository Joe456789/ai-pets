"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createInvoiceAction } from "@/app/admin/actions";

export function InvoiceForm({ shelters }: { shelters: { id: string; name: string }[] }) {
  const router = useRouter();
  const [sid, setSid] = useState(shelters[0]?.id ?? "");
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7).replace("-", "/"));
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const add = () => start(async () => {
    setError(null);
    const r = await createInvoiceAction({ sid, period, amount: Number(amount) });
    if (!r.ok) { setError(r.error); return; }
    setAmount("");
    router.refresh();
  });
  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <h2>新增收費紀錄</h2>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <label className="field">協會<select value={sid} onChange={(e) => setSid(e.target.value)}>{shelters.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="field">期間<input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2026/11" /></label>
        <label className="field">金額（NT$）<input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
        <button className="btn primary" disabled={pending || !amount} onClick={add}>新增</button>
      </div>
      {error && <p className="error-box" style={{ marginTop: 8 }}>{error}</p>}
    </section>
  );
}
