import Link from "next/link";
import { HandoverCard } from "@/components/HandoverCard";
import { PetImage } from "@/components/PetImage";
import { Badge, Notice, PageHead, Stat } from "@/components/ui";
import { requireManager } from "@/lib/auth";
import { listAnnouncements } from "@/lib/platform";
import * as repo from "@/lib/repo";
import { listPledges } from "@/lib/supplies";
import { daysSince, fmtDate, fmtToday, taipeiDate } from "@/lib/time";

export default async function ShelterHome() {
  const { sid } = await requireManager();
  const [animals, apps, convs, digest, handover, notices, pledges] = await Promise.all([
    repo.listAnimals(sid), repo.listApplications(sid), repo.listConversations(sid), repo.dailyDigest(sid), repo.getHandover(sid), listAnnouncements(3), listPledges(sid),
  ]);
  const waitingPledges = pledges.filter((p) => p.status === "待確認");
  const inCare = animals.filter((a) => a.status !== "已領養");
  const dogs = inCare.filter((a) => a.kind === "狗").length;
  const open = inCare.filter((a) => a.status === "開放領養");
  const longest = [...open].sort((a, b) => a.intakeAt.localeCompare(b.intakeAt)).slice(0, 3);
  const pendingApps = apps.filter((a) => a.status === "待審核");
  const pendingConvs = convs.filter((c) => c.status === "待處理");
  const unpublished = inCare.filter((a) => !a.published);
  const thisMonth = taipeiDate().slice(0, 7);

  return (
    <>
      <PageHead title="今日總覽" sub={fmtToday()} />
      {notices.map((n) => <p className="notice" key={n.id} style={{ marginBottom: 12 }}><b>平台公告　</b>{n.text}<span className="small muted">　{fmtDate(n.at)}</span></p>)}
      <div className="stats">
        <Stat label="在所動物" value={inCare.length} hint={`狗 ${dogs}、貓 ${inCare.length - dogs}`} />
        <Stat label="開放領養" value={open.length} />
        <Stat label="待審申請" value={pendingApps.length} hint={pendingApps.at(-1) ? `最早是 ${fmtDate(pendingApps.at(-1)!.createdAt)}` : undefined} />
        <Stat label="本月已領養" value={animals.filter((a) => a.adoptedAt && taipeiDate(a.adoptedAt).startsWith(thisMonth)).length} />
      </div>
      <div className="grid-2">
        <div className="stack">
          <section className="card">
            <div className="row between"><h2>需要留意</h2><span className="small muted">來自現場回報</span></div>
            {digest.flagged.length === 0 && <p className="small muted">目前沒有需要留意的回報。</p>}
            <ul className="list-plain">
              {digest.flagged.map((a) => (
                <li className="todo" key={a.id}>
                  <div className="pet-cell">
                    <div className="thumb"><PetImage pet={a} /></div>
                    <div><Link href={`/shelter/animals/${a.id}`}><b>{a.name}</b></Link><div className="small muted">{a.flagNote}</div></div>
                  </div>
                  <Badge tone="warn">留意</Badge>
                </li>
              ))}
            </ul>
            <p className="small muted" style={{ marginTop: 8 }}>其餘動物顯示「無異常回報」，代表沒有人回報狀況，不等於確認健康。</p>
          </section>
          <section className="card">
            <h2>今日待辦</h2>
            <ul className="list-plain">
              {pendingApps.slice(0, 3).map((a) => (
                <li className="todo" key={a.id}><span>審核{a.who}申請領養{a.animalName}</span><Link className="btn small" href="/shelter/applications">前往</Link></li>
              ))}
              {pendingConvs.slice(0, 3).map((c) => (
                <li className="todo" key={c.id}><span>處理{c.displayName}的訊息（{c.tag}）</span><Link className="btn small" href="/shelter/messages">前往</Link></li>
              ))}
              {waitingPledges.length > 0 && (
                <li className="todo"><span>{waitingPledges.length} 筆物資捐贈等你確認（最新：{waitingPledges[0].who}的{waitingPledges[0].supplyName}）</span><Link className="btn small" href="/shelter/supplies">前往</Link></li>
              )}
              {digest.vaccines.slice(0, 3).map((a) => (
                <li className="todo" key={a.id}><span>{a.name}疫苗 {a.vaccineDue} 到期，安排回診</span><Link className="btn small" href={`/shelter/animals/${a.id}`}>查看</Link></li>
              ))}
              {unpublished.slice(0, 3).map((a) => (
                <li className="todo" key={a.id}><span>{a.name}（{a.code}）還沒有公開的送養介紹</span><Link className="btn small" href={`/shelter/content?animal=${a.id}`}>前往</Link></li>
              ))}
            </ul>
          </section>
        </div>
        <div className="stack">
          <HandoverCard initial={handover?.summary ?? null} />
          <Notice compact />
          <section className="card">
            <h2>收容最久、待領養</h2>
            {longest.length === 0 && <p className="small muted">目前沒有開放領養的動物。</p>}
            {longest.map((a) => (
              <div className="todo" key={a.id}>
                <div className="pet-cell">
                  <div className="thumb"><PetImage pet={a} /></div>
                  <Link href={`/shelter/animals/${a.id}`}>{a.name}</Link>
                </div>
                <span className="small muted">{daysSince(a.intakeAt)} 天</span>
              </div>
            ))}
          </section>
          <section className="card">
            <h2>現場回報狀況</h2>
            {digest.reported.map((a) => <div className="todo" key={a}><span>{a}</span><Badge tone="good">已回報</Badge></div>)}
            {digest.partial.map((a) => <div className="todo" key={a}><span>{a}</span><Badge tone="warn">只有個別回報</Badge></div>)}
            {digest.unreported.map((a) => <div className="todo" key={a}><span>{a}</span><Badge tone="warn">尚未回報</Badge></div>)}
            {digest.partial.length > 0 && <p className="small muted">「只有個別回報」是有人回報了區域裡的某隻動物，但還沒確認整區都正常。</p>}
            {digest.reported.length + digest.partial.length + digest.unreported.length === 0 &&<p className="small muted">請到設定頁填寫區域。</p>}
          </section>
        </div>
      </div>
    </>
  );
}
