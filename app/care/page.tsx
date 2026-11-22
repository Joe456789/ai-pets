import Link from "next/link";
import { completeCareAction, deleteCareAction } from "@/app/actions";
import { ActionButton } from "@/components/ActionButton";
import { CareForm } from "@/components/CareForm";
import { DemoBanner, SignInCard } from "@/components/Gate";
import { Badge, Notice, PageHead } from "@/components/ui";
import { currentUid } from "@/lib/auth";
import { careSuggestions, dueLabel } from "@/lib/care";
import { isDemo, listCare, listPets } from "@/lib/repo";
import { taipeiDate } from "@/lib/time";

export const dynamic = "force-dynamic";

const TONE = { late: "bad", soon: "warn", later: "muted" } as const;

export default async function CarePage() {
  const uid = await currentUid();
  const head = <PageHead title="照顧日曆" sub="驅蟲、疫苗、健康檢查這些定期要做的事，到期前一天用 LINE 提醒你。做完按「完成了」，自動算下一次。" />;
  if (!uid) return <>{head}<SignInCard what="設定照顧提醒" /></>;
  const [items, pets] = await Promise.all([listCare(uid), listPets(uid)]);
  const today = taipeiDate();
  const alive = pets.filter((p) => p.status === "在世");
  const readOnly = isDemo(uid);

  return (
    <>
      <DemoBanner uid={uid} />
      {head}

      {alive.length === 0 ? (
        <div className="card empty">先在「我的毛孩」<Link href="/pets/new">新增毛孩</Link>，就可以設定照顧提醒。</div>
      ) : (
        <div className="list">
          {items.length === 0 && <div className="card empty">還沒有照顧項目。從下面的建議開始加。</div>}
          {items.map((c) => {
            const due = dueLabel(c.nextDue, today);
            return (
              <div className="item" key={c.id}>
                <div className="grow">
                  <div className="row" style={{ gap: 8 }}><b>{c.label}</b><Badge tone={TONE[due.tone]}>{due.text}</Badge></div>
                  <span className="small muted">{c.petName}・每 {c.everyMonths} 個月・上次 {c.lastDone ? c.lastDone.replaceAll("-", "/") : "不記得"}</span>
                </div>
                {!readOnly && (
                  <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                    <ActionButton small primary label="完成了" pending="…" run={completeCareAction.bind(null, c.id)} />
                    <ActionButton small label="刪除" pending="…" confirm={`刪除「${c.petName}的${c.label}」？`} run={deleteCareAction.bind(null, c.id)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!readOnly && alive.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <CareForm
            today={today}
            pets={alive.map((p) => {
              const have = new Set(items.filter((c) => c.petId === p.id).map((c) => c.kind));
              return { id: p.id, name: p.name, suggestions: careSuggestions(p).filter((s) => !have.has(s.kind)) };
            })}
          />
        </div>
      )}
      <div style={{ marginTop: 16 }}><Notice /></div>
    </>
  );
}
