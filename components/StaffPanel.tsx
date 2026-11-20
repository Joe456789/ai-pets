"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addStaffAction, disableStaffAction } from "@/app/shelter/actions";
import { Badge } from "@/components/ui";
import { fmtDateTime } from "@/lib/time";
import type { StaffDoc } from "@/lib/types";

export function StaffPanel({ staff, areas }: { staff: StaffDoc[]; areas: string[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [role, setRole] = useState<"現場人員" | "志工">("現場人員");
  const [area, setArea] = useState(areas.join("、"));
  const [created, setCreated] = useState<{ name: string; code: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const add = () => start(async () => {
    setError(null);
    const res = await addStaffAction({ name, role, area });
    if (!res.ok) { setError(res.error); return; }
    setCreated({ name, code: res.data! });
    setName("");
    router.refresh();
  });
  const disable = (code: string) => start(async () => { await disableStaffAction(code); router.refresh(); });

  return (
    <>
      <section className="card" style={{ marginBottom: 16 }}>
        <h2>新增人員</h2>
        <div className="row" style={{ alignItems: "flex-end" }}>
          <label className="field" style={{ flex: 1, minWidth: 150 }}>姓名<input value={name} onChange={(e) => setName(e.target.value)} placeholder="輸入姓名" /></label>
          <label className="field">身分<select value={role} onChange={(e) => setRole(e.target.value as typeof role)}><option>現場人員</option><option>志工</option></select></label>
          <label className="field" style={{ flex: 1, minWidth: 150 }}>負責區域<input value={area} onChange={(e) => setArea(e.target.value)} /></label>
          <button className="btn primary" disabled={pending} onClick={add}>產生工作號</button>
        </div>
        {error && <p className="error-box" style={{ marginTop: 10 }}>{error}</p>}
        {created && (
          <div className="ok-box" style={{ marginTop: 12 }}>
            {created.name}的工作號是<br /><span className="code-pill">{created.code}</span><br />
            請把這組號碼交給本人，請對方加入協會的 LINE 官方帳號後，直接傳送這組號碼。7 天內沒有綁定就會失效。
          </div>
        )}
      </section>
      <section className="card table-wrap">
        <table>
          <thead><tr><th>姓名</th><th>身分</th><th>工作號</th><th>負責區域</th><th>LINE 綁定</th><th>最後回報</th><th></th></tr></thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.code} style={s.disabled ? { opacity: 0.55 } : undefined}>
                <td><b>{s.name}</b></td>
                <td>{s.role}</td>
                <td><code>{s.code}</code></td>
                <td>{s.area}</td>
                <td><Badge>{s.disabled ? "已停用" : s.lineUserId ? "已綁定" : "未綁定"}</Badge></td>
                <td className="muted">{s.lastReportAt ? fmtDateTime(s.lastReportAt) : "—"}</td>
                <td>{!s.disabled && <button className="btn small" disabled={pending} onClick={() => disable(s.code)}>停用</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
