import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteRecordAction } from "@/app/actions";
import { ActionButton } from "@/components/ActionButton";
import { DemoBanner, SignInCard } from "@/components/Gate";
import { RecordUpload } from "@/components/RecordUpload";
import { Notice, PageHead } from "@/components/ui";
import { currentUid } from "@/lib/auth";
import { monthlyReserve, spendByYear } from "@/lib/records";
import { getPet, isDemo, listRecords } from "@/lib/repo";
import { taipeiDate } from "@/lib/time";

export const dynamic = "force-dynamic";

const fmt = (d: string) => (d ? d.replaceAll("-", "/") : "日期不明");

export default async function Records({ params }: { params: Promise<{ id: string }> }) {
  const uid = await currentUid();
  if (!uid) return <SignInCard what="看醫療紀錄" />;
  const pet = await getPet(uid, (await params).id);
  if (!pet) notFound();
  const records = await listRecords(uid, pet.id);
  const spend = spendByYear(records);
  const reserve = monthlyReserve(pet, records);
  const today = taipeiDate();
  const next = records.map((r) => r.followUp).filter((d) => d && d >= today).sort()[0];

  return (
    <>
      <DemoBanner uid={uid} />
      <PageHead title={`${pet.name}的醫療紀錄`} sub="拍下單據，AI 照原文整理，你確認後才會存到這裡。在 LINE 聊天室按「拍醫療單據」也可以。" action={<Link className="btn small" href="/me">回我的毛孩</Link>} />

      {!isDemo(uid) && pet.status === "在世" && <RecordUpload petId={pet.id} petName={pet.name} />}

      <section className="card">
        <h2>醫療預備金</h2>
        {pet.status === "已離開" ? (
          <p className="small muted">{pet.name}已經離開了。這些紀錄會一直保留，也可以為牠<Link href={`/memorial/new?pet=${pet.id}`}>建立 3D 紀念</Link>。</p>
        ) : (
          <>
            <p className="cost-total">每月存 {reserve.amount.toLocaleString()} 元</p>
            <p className="small muted">
              最近一年醫療花費 {reserve.lastYear.toLocaleString()} 元，乘以 1.5 倍保留突發的空間後攤到每月
              {reserve.senior ? `；${pet.name}${reserve.age} 歲，進入老年期，再多抓 30%` : ""}，最少 500 元。
              醫療費是很多人放棄貓狗的原因，先存起來，遇到時就不會措手不及。
            </p>
          </>
        )}
        {next && <p className="ok-box" style={{ marginTop: 10 }}>下次回診：{fmt(next)}，前一天會用 LINE 提醒你。</p>}
        {spend.length > 0 && (
          <div className="spend" style={{ marginTop: 12 }}>
            {spend.map((s) => <div key={s.year}><span className="tiny">{s.year} 年</span><b>{s.amount.toLocaleString()}</b><span className="tiny">元</span></div>)}
          </div>
        )}
      </section>

      <h2 style={{ font: "900 18px var(--serif)", margin: "22px 0 10px" }}>每次看診</h2>
      <div className="timeline">
        {records.length === 0 && <div className="card empty">還沒有紀錄。看完診後拍下單據就可以新增。</div>}
        {records.map((r) => (
          <article className="rec" key={r.id}>
            <div className="rec-head">
              <span className="rec-date">{fmt(r.visitDate)}</span>
              <span className="small muted">{r.total ? `${r.total.toLocaleString()} 元` : ""}</span>
            </div>
            {r.clinic && <p className="small muted">{r.clinic}</p>}
            <dl>
              {r.items.length > 0 && <><dt>項目</dt><dd>{r.items.map((i) => (i.note ? `${i.name}（${i.note}）` : i.name)).join("、")}</dd></>}
              {r.meds.length > 0 && <><dt>藥品</dt><dd>{r.meds.map((m) => <div key={m.name}>{m.name}{m.usage && <span className="muted">：{m.usage}</span>}</div>)}</dd></>}
              {r.followUp && <><dt>回診</dt><dd>{fmt(r.followUp)}</dd></>}
            </dl>
            {r.terms.length > 0 && (
              <div className="terms">
                <b className="small">名詞白話說明</b>（一般意思，詳情請問你的獸醫）
                {r.terms.map((t) => <div key={t.term}>・<b>{t.term}</b>：{t.plain}</div>)}
              </div>
            )}
            <div className="row between" style={{ marginTop: 10 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <a href={r.photo} target="_blank" rel="noreferrer"><img className="thumb" src={r.photo} alt="單據照片" /></a>
              {!isDemo(uid) && <ActionButton small label="刪除" confirm="確定刪除這筆紀錄和單據照片？" run={deleteRecordAction.bind(null, r.id)} />}
            </div>
          </article>
        ))}
      </div>
      <div style={{ marginTop: 16 }}><Notice /></div>
    </>
  );
}
