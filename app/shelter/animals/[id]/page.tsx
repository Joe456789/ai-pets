import Link from "next/link";
import { notFound } from "next/navigation";
import { updateAnimalAction } from "@/app/shelter/actions";
import { PetImage } from "@/components/PetImage";
import { Badge, Notice } from "@/components/ui";
import { requireManager } from "@/lib/auth";
import { getAnimal, isFlagged, listCareOf } from "@/lib/repo";
import { daysSince, fmtDate, fmtDateTime } from "@/lib/time";

export default async function AnimalProfile({ params }: { params: Promise<{ id: string }> }) {
  const { sid } = await requireManager();
  const { id } = await params;
  const a = await getAnimal(sid, id);
  if (!a) notFound();
  const care = await listCareOf(sid, id);
  const flagged = isFlagged(a);
  const lastConcern = care.find((c) => c.concerning);
  const status = a.status === "已領養"
    ? `已於 ${a.adoptedAt ? fmtDate(a.adoptedAt) : "先前"}被領養。`
    : flagged
      ? `${a.flagNote}。建議現場持續留意，如情況持續請諮詢獸醫。`
      : lastConcern
        ? `最近一次需留意的回報是 ${fmtDate(lastConcern.at)}（${daysSince(lastConcern.at)} 天前）：「${lastConcern.text}」，之後沒有新的異常回報。沒有回報不等於確認健康。`
        : "目前沒有需留意的回報。沒有人回報狀況，不等於確認健康。";
  const save = updateAnimalAction.bind(null, a.id);
  return (
    <>
      <p className="small muted" style={{ marginBottom: 10 }}><Link href="/shelter/animals">動物管理</Link> ／ {a.name}</p>
      <div className="grid-2">
        <div className="stack">
          <section className="card profile-head">
            <div className="art"><PetImage pet={a} /></div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div className="row between">
                <h1 style={{ font: "900 26px var(--serif)" }}>{a.name}</h1>
                <Badge>{a.status}</Badge>
              </div>
              <p className="small muted" style={{ marginBottom: 10 }}>{[a.code, a.area].filter(Boolean).join("・")}・{a.adoptedAt ? `收容 ${Math.max(0, Math.round((Date.parse(a.adoptedAt) - Date.parse(a.intakeAt)) / 864e5))} 天後被領養` : `已收容 ${daysSince(a.intakeAt)} 天`}</p>
              <div className="kv">
                <div><span>種類</span>{a.kind}・{a.sex}</div>
                <div><span>年齡</span>{a.age || "未填寫"}</div>
                <div><span>體型</span>{a.size}</div>
                <div><span>毛色</span>{a.coat || "未填寫"}</div>
                <div><span>絕育</span>{a.neutered === "是" ? "已絕育" : a.neutered === "否" ? "尚未絕育" : "未知"}</div>
                <div><span>發現地點</span>{a.foundAt || "未填寫"}</div>
              </div>
              {a.photos.length > 1 && <div className="photo-row" style={{ marginTop: 10 }}>{a.photos.map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p} alt={`${a.name}的照片`} key={p} />
              ))}</div>}
            </div>
          </section>
          <section className="card">
            <div className="row between"><h2>照護紀錄</h2><span className="small muted">由現場人員在 LINE 回報</span></div>
            {care.length === 0 && <p className="small muted">目前無異常回報。</p>}
            <ul className="timeline">
              {care.map((c) => (
                <li key={c.id} className={c.concerning ? "flag" : ""}>
                  <div>{c.text}</div>
                  <div className="small muted">{fmtDateTime(c.at)}・{c.who}</div>
                </li>
              ))}
            </ul>
          </section>
        </div>
        <div className="stack">
          <section className="card">
            <h2>近況</h2>
            <div className="summary-box">{status}</div>
            <div style={{ marginTop: 10 }}><Notice compact /></div>
          </section>
          <form className="card stack" style={{ gap: 10 }} action={save}>
            <h2 style={{ margin: 0 }}>基本資料</h2>
            <label className="field">名字<input name="name" defaultValue={a.name} /></label>
            <label className="field">區域<input name="area" defaultValue={a.area} /></label>
            <label className="field">疫苗到期日<input name="vaccineDue" type="date" defaultValue={a.vaccineDue.replaceAll("/", "-")} /></label>
            <button className="btn small primary" style={{ justifySelf: "start" }}>儲存</button>
          </form>
          <section className="card">
            <h2>個性與送養資訊</h2>
            <div className="chips" style={{ marginBottom: 8 }}>{a.traits.map((t) => <span className="chip" key={t}>{t}</span>)}</div>
            <p className="small">{a.story || "還沒有送養介紹。"}</p>
            <div className="row" style={{ marginTop: 12 }}>
              <Link className="btn small primary" href={`/shelter/content?animal=${a.id}`}>編輯送養內容</Link>
              {a.published && <Link className="btn small" href={`/adopt/animals/${sid}__${a.id}`}>看公開頁</Link>}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
