import Link from "next/link";
import { notFound } from "next/navigation";
import { retryMemorialAction, shareMemorialAction } from "@/app/actions";
import { ActionButton } from "@/components/ActionButton";
import { DemoBanner } from "@/components/Gate";
import { MemorialViewer } from "@/components/MemorialViewer";
import { RealSizeAr } from "@/components/RealSizeAr";
import { TributeEditor } from "@/components/TributeEditor";
import { currentUid } from "@/lib/auth";
import { signedUrl } from "@/lib/media";
import { getMemorial, getPet, isDemo } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function MemorialPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const [{ id }, { t }] = await Promise.all([params, searchParams]);
  const m = await getMemorial(id);
  if (!m) notFound();
  const uid = await currentUid();
  const owner = uid === m.uid;
  const shared = Boolean(m.shareToken && t && t === m.shareToken);
  // 不是本人、也沒有正確的分享連結，就當作不存在。
  if (!owner && !shared) notFound();
  const editable = owner && !isDemo(m.uid);
  const pet = await getPet(m.uid, m.petId);
  // 分享頁的訪客沒有登入，私人檔案要帶簽章才讀得到。
  const asset = (u: string) => (u.startsWith("/files/") && !owner ? signedUrl(u) : u);
  const keep = Boolean(m.keepsake);
  const years = keep ? "" : pet?.birth ? `${pet.birth.slice(0, 4)} — ${(pet.passedAt ?? m.createdAt).slice(0, 4)}` : "";
  const shareUrl = m.shareToken ? `${(process.env.APP_URL ?? "").replace(/\/$/, "")}/memorial/${m.id}?t=${m.shareToken}` : "";

  return (
    <>
      {owner && <DemoBanner uid={m.uid} />}
      <article className="memorial">
        {m.status === "完成" && m.glb ? (
          <MemorialViewer url={asset(m.glb)} name={m.petName} />
        ) : (
          <div className="memorial-stage" style={{ display: "grid", placeItems: "center", padding: 20, textAlign: "center" }}>
            <div className="stack" style={{ justifyItems: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {m.photos[0] && <img src={asset(m.photos[0])} alt={`${m.petName}的照片`} style={{ width: 180, height: 180, objectFit: "cover", borderRadius: "50%", border: "4px solid rgba(255,255,255,.25)" }} />}
              <span className="status-pill">{m.status === "失敗" ? "這次沒有做成功" : m.status === "製作中" ? "3D 工作站正在重建牠的樣子…" : "排隊中，輪到時就會開始製作"}</span>
              {m.status === "失敗" && <span className="small">{m.error}</span>}
              {m.status !== "失敗" && <span className="small" style={{ opacity: .8 }}>完成後會用 LINE 通知你。</span>}
            </div>
          </div>
        )}
        <div className="memorial-body">
          <h1>{m.petName}</h1>
          {years && <p className="years">{years}</p>}
          {keep && <p className="years">趁牠還在時留下的 3D</p>}
          {!keep && m.tributeOk && m.tribute && <p className="tribute">{m.tribute}</p>}
          <div className="row" style={{ marginTop: 16 }}>
            {m.status === "完成" && m.glb && <Link className="btn primary" href={`/memorial/${m.id}/ar${!owner && t ? `?t=${t}` : ""}`}>打開鏡頭，讓{m.petName}陪你</Link>}
            {m.status === "完成" && m.glb && <RealSizeAr modelUrl={asset(m.glb)} heightCm={m.heightCm} name={m.petName} />}
            {editable && m.status === "失敗" && <ActionButton label="重新排隊" run={retryMemorialAction.bind(null, m.id)} />}
            {editable && keep && <Link className="btn" href={`/pets/${m.petId}/keep`}>重拍</Link>}
          </div>
        </div>
      </article>

      {editable && (
        <div className="stack" style={{ marginTop: 16 }}>
          {!keep && <TributeEditor id={m.id} initial={m.tribute} hasMemories={Boolean(m.memories.trim())} />}
          <section className="card stack">
            <h2 style={{ margin: 0 }}>分享給家人朋友</h2>
            {m.shareToken ? (
              <>
                <p className="small">有這個連結的人都能看這個紀念頁（不能修改）：</p>
                <input className="field" readOnly value={shareUrl} style={{ padding: 10, border: "1px solid var(--line)", borderRadius: 10 }} aria-label="分享連結" />
                <ActionButton small label="關閉分享" run={shareMemorialAction.bind(null, m.id, false)} />
              </>
            ) : (
              <>
                <p className="small muted">預設只有你看得到。開啟後會產生一個分享連結。</p>
                <ActionButton small label="開啟分享連結" run={shareMemorialAction.bind(null, m.id, true)} />
              </>
            )}
          </section>
          {keep ? (
            <section className="card">
              <h2>以後也會在</h2>
              <p className="small muted">這份 3D 會一直留在這裡。很久以後的某一天，如果需要為牠建立紀念，可以直接用這份，不用再找照片。</p>
            </section>
          ) : <section className="card">
            <h2>如果你很難過</h2>
            <p className="small muted">失去陪伴多年的家人，難過很正常，不需要急著走出來。可以和家人朋友聊聊牠，或寫下想對牠說的話。如果悲傷影響到睡眠、工作或生活很久，可以撥打安心專線 1925（24 小時、免付費），和專業的人談談。</p>
          </section>}
        </div>
      )}
      {!owner && <p className="small muted" style={{ marginTop: 14, textAlign: "center" }}>這是 {m.petName} 的{keep ? " 3D " : "紀念"}頁，由「<Link href="/">從此有你</Link>」用照片重建 3D 模型。</p>}
    </>
  );
}
