"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addCareAction } from "@/app/actions";
import type { CareKind } from "@/lib/types";

type Suggestion = { kind: CareKind; label: string; everyMonths: number };
type PetOpt = { id: string; name: string; suggestions: Suggestion[] };
const KINDS: CareKind[] = ["驅蟲", "疫苗", "健康檢查", "其他"];

/** 加入照顧項目。先列出這隻還沒加的建議項目，點一下就填好，只要補上次做的日期。 */
export function CareForm({ pets, today }: { pets: PetOpt[]; today: string }) {
  const router = useRouter();
  const [petId, setPetId] = useState(pets[0]?.id ?? "");
  const [kind, setKind] = useState<CareKind>("驅蟲");
  const [label, setLabel] = useState("");
  const [every, setEvery] = useState(1);
  const [lastDone, setLastDone] = useState("");
  const [unknown, setUnknown] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [pending, start] = useTransition();
  const pet = pets.find((p) => p.id === petId);

  const fill = (s: Suggestion) => { setKind(s.kind); setLabel(s.label); setEvery(s.everyMonths); setDone(""); setError(""); };

  const submit = () => start(async () => {
    setError("");
    if (!label.trim()) { setError("請填項目名稱"); return; }
    if (!unknown && !lastDone) { setError("請填上次做的日期，或勾「不記得」"); return; }
    const r = await addCareAction({ petId, kind, label, everyMonths: every, lastDone: unknown ? "" : lastDone });
    if (!r.ok) { setError(r.error); return; }
    setDone(`已加入：${pet?.name}的${label}`);
    setLabel(""); setLastDone(""); setUnknown(false);
    router.refresh();
  });

  return (
    <section className="card stack">
      <h2 style={{ margin: 0 }}>加入照顧項目</h2>
      {pets.length > 1 && (
        <label className="field">哪一隻
          <select value={petId} onChange={(e) => setPetId(e.target.value)}>{pets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        </label>
      )}
      {pet && pet.suggestions.length > 0 && (
        <div className="field">
          <span>建議項目（點一下就填好）</span>
          <div className="row" style={{ gap: 6 }}>
            {pet.suggestions.map((s) => (
              <button key={s.label} type="button" className={`chip ${label === s.label ? "on" : ""}`} onClick={() => fill(s)}>{s.label}・每 {s.everyMonths} 個月</button>
            ))}
          </div>
        </div>
      )}
      <div className="grid2">
        <label className="field">項目名稱<input value={label} maxLength={20} onChange={(e) => setLabel(e.target.value)} placeholder="例如：體內外寄生蟲預防" /></label>
        <label className="field">種類
          <select value={kind} onChange={(e) => setKind(e.target.value as CareKind)}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select>
        </label>
        <label className="field">每幾個月一次<input type="number" min={1} max={36} value={every} onChange={(e) => setEvery(Math.max(1, Math.min(36, Number(e.target.value) || 1)))} /></label>
        <label className="field">上次做的日期
          <input type="date" max={today} value={lastDone} disabled={unknown} onChange={(e) => setLastDone(e.target.value)} />
        </label>
      </div>
      <label className="check"><input type="checkbox" checked={unknown} onChange={(e) => setUnknown(e.target.checked)} />不記得上次是什麼時候（會標成「該做了」，可以先問獸醫）</label>
      {error && <p className="error-box">{error}</p>}
      {done && <p className="ok-box">{done}</p>}
      <button className="btn primary" disabled={pending || !petId} onClick={submit}>{pending ? "加入中…" : "加入"}</button>
      <p className="tiny">間隔是常見的做法，實際請照你的獸醫安排調整，例如有的驅蟲藥是三個月一次。</p>
    </section>
  );
}
