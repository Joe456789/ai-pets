"use client";
import Link from "next/link";
import { useState } from "react";
import { PetImage } from "@/components/PetImage";
import { Badge } from "@/components/ui";
import { fmtDate } from "@/lib/time";
import type { AnimalDoc } from "@/lib/types";

const statuses = ["全部", "開放領養", "在所照護", "送醫中", "已領養"];

export type AnimalRow = AnimalDoc & { days: number; flagged: boolean };

export function AnimalsTable({ animals }: { animals: AnimalRow[] }) {
  const [status, setStatus] = useState("全部");
  const [q, setQ] = useState("");
  const rows = animals.filter((a) => (status === "全部" || a.status === status) && (a.name.includes(q) || a.code.includes(q)));
  return (
    <>
      <div className="tabs">
        {statuses.map((s) => <button key={s} className={status === s ? "on" : ""} onClick={() => setStatus(s)}>{s}</button>)}
      </div>
      <section className="card">
        <label className="field" style={{ maxWidth: 280, marginBottom: 10 }}>搜尋名字或編號<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="例如：小黑、NW-0231" /></label>
        <div className="table-wrap">
          <table>
            <thead><tr><th>動物</th><th>編號</th><th>區域</th><th>狀態</th><th className="num" title="已領養的動物顯示到被領養為止的天數">收容天數</th><th>疫苗到期</th><th>最新狀況</th></tr></thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td><Link href={`/shelter/animals/${a.id}`} className="pet-cell"><span className="thumb"><PetImage pet={a} /></span><span><b>{a.name}</b><br /><span className="small muted">{a.kind}・{a.sex}・{a.age || "年齡未填"}</span></span></Link></td>
                  <td>{a.code}</td>
                  <td>{a.area}</td>
                  <td><Badge>{a.status}</Badge></td>
                  <td className="num">{a.days}</td>
                  <td>{a.status === "已領養" ? "—" : a.vaccineDue || "未填寫"}</td>
                  <td className={a.flagged ? "" : "muted"}>{a.status === "已領養" ? `${a.adoptedAt ? fmtDate(a.adoptedAt) : ""} 已領養` : a.flagged ? a.flagNote : "無異常回報"}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="muted">沒有符合條件的動物。</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
