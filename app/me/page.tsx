import Link from "next/link";
import { ActionButton } from "@/components/ActionButton";
import { DemoBanner, SignInCard } from "@/components/Gate";
import { Badge, PageHead, PetAvatar } from "@/components/ui";
import { logoutAction } from "@/app/actions";
import { currentUid } from "@/lib/auth";
import { ageYears } from "@/lib/records";
import { dueLabel } from "@/lib/care";
import { getOwner, isDemo, listAssessments, listCare, listChanges, listMemorials, listPets, listRecords } from "@/lib/repo";
import { fmtDate, taipeiDate } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const uid = await currentUid();
  if (!uid) return <SignInCard what="管理你的毛孩和紀錄" />;
  const [owner, pets, assessments, memorials, care, changes] = await Promise.all([getOwner(uid), listPets(uid), listAssessments(uid), listMemorials(uid), listCare(uid), listChanges(uid)]);
  const hasAlive = pets.some((p) => p.status === "在世");
  const memorialOf = new Map(memorials.map((m) => [m.petId, m]));
  const today = taipeiDate();
  const recordsOf = new Map(await Promise.all(pets.map(async (p) => [p.id, await listRecords(uid, p.id)] as const)));
  const nextVisit = (id: string) => (recordsOf.get(id) ?? []).map((r) => r.followUp).filter((d) => d && d >= today).sort()[0];
  return (
    <>
      <DemoBanner uid={uid} />
      <PageHead title={`${owner?.displayName ?? "你"}的毛孩`} action={!isDemo(uid) ? <Link className="btn small primary" href="/pets/new">新增毛孩</Link> : undefined} />

      {hasAlive && (
        <section className="card stack" style={{ marginBottom: 16 }}>
          <div className="row between">
            <h2 style={{ margin: 0 }}>接下來的照顧</h2>
            <Link className="btn small" href="/care">{care.length ? "照顧日曆" : "設定提醒"}</Link>
          </div>
          {care.length === 0 && <p className="small muted">加入驅蟲、疫苗、健康檢查，到期前一天用 LINE 提醒你。</p>}
          {care.slice(0, 3).map((c) => {
            const due = dueLabel(c.nextDue, today);
            return (
              <div className="row between" key={c.id}>
                <span>{c.petName}・{c.label}</span>
                <Badge tone={due.tone === "late" ? "bad" : due.tone === "soon" ? "warn" : "muted"}>{due.text}</Badge>
              </div>
            );
          })}
        </section>
      )}

      <section className="list">
        {pets.length === 0 && <div className="card empty">還沒有毛孩。<br />還在考慮的話，可以先做<Link href="/assess">飼養前評估</Link>。</div>}
        {pets.map((p) => {
          const age = ageYears(p, p.status === "已離開" && p.passedAt ? new Date(p.passedAt) : undefined);
          const m = memorialOf.get(p.id);
          const next = p.status === "在世" ? nextVisit(p.id) : undefined;
          const count = recordsOf.get(p.id)?.length ?? 0;
          return (
            <div className="item" key={p.id}>
              <PetAvatar name={p.name} photo={p.photo} />
              <div className="grow">
                <div className="row" style={{ gap: 8 }}><b>{p.name}</b><Badge>{p.status}</Badge></div>
                <span className="small muted">{[p.kind, p.size, p.sex, age !== null ? `${age} 歲` : ""].filter(Boolean).join("・")}</span>
                {next && <span className="next-visit">下次回診 {next.slice(5).replace("-", "/")}</span>}
                <div className="row" style={{ gap: 6, marginTop: 6 }}>
                  <Link className={`btn small ${p.status === "在世" ? "primary" : ""}`} href={`/pets/${p.id}/records`}>醫療紀錄{count ? `（${count}）` : ""}</Link>
                  {p.status === "在世" && <Link className="btn small" href={`/change?pet=${p.id}`}>生活變動</Link>}
                  {!isDemo(uid) && <Link className="btn small" href={`/pets/${p.id}`}>編輯</Link>}
                  {m ? <Link className="btn small" href={`/memorial/${m.id}`}>3D 紀念</Link>
                    : p.status === "已離開" && !isDemo(uid) && <Link className="btn small" href={`/memorial/new?pet=${p.id}`}>建立紀念</Link>}
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {(hasAlive || changes.length > 0) && (
        <section className="card" style={{ marginTop: 18 }}>
          <div className="row between">
            <h2 style={{ margin: 0 }}>生活變動準備清單</h2>
            <Link className="btn small" href="/change">做一次檢查</Link>
          </div>
          {changes.length === 0 && <p className="small muted" style={{ marginTop: 8 }}>要搬家、懷孕、出國或工作變忙時，先做一次，拿到分階段的準備清單。</p>}
          <div className="list" style={{ marginTop: changes.length ? 10 : 0 }}>
            {changes.slice(0, 5).map((c) => (
              <Link className="item" key={c.id} href={`/change/${c.id}`}>
                <div className="grow"><b>{c.petName}・{c.answers.change}</b>　<span className="small muted">{fmtDate(c.at)}</span></div>
                <Badge tone={c.plan.level === "高" ? "bad" : c.plan.level === "中" ? "warn" : "good"}>{`準備：${c.plan.level}`}</Badge>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="card" style={{ marginTop: 18 }}>
        <h2>飼養前評估</h2>
        {assessments.length === 0 && <p className="small muted">還沒做過。<Link href="/assess">現在做</Link></p>}
        <div className="list">
          {assessments.slice(0, 5).map((a) => (
            <Link className="item" key={a.id} href={`/assess/${a.id}`}>
              <div className="grow"><b>{a.result.total} 分</b>　<span className="small muted">{fmtDate(a.at)}</span></div>
              <Badge>{a.result.verdict}</Badge>
            </Link>
          ))}
        </div>
      </section>

      <div style={{ marginTop: 18 }}><ActionButton small label="登出" run={logoutAction} /></div>
    </>
  );
}
