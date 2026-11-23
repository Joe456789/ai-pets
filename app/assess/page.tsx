import Link from "next/link";
import { AssessForm } from "@/components/AssessForm";
import { DemoBanner } from "@/components/Gate";
import { PageHead } from "@/components/ui";
import { currentUid } from "@/lib/auth";
import { listPets } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function AssessPage() {
  const uid = await currentUid();
  // 已經在養的人從選單點進來，多半是生活有變動，先把生活變動檢查放在最上面。
  const hasPet = uid ? (await listPets(uid)).some((p) => p.status === "在世") : false;
  const changeCard = (
    <Link className="item" href="/change" style={{ marginBottom: 16 }}>
      <div className="grow">
        <b>已經在養了？做「生活變動檢查」</b><br />
        <span className="small muted">搬家、懷孕、出國、工作變忙、經濟變緊時，拿到分階段的準備清單。</span>
      </div>
      <span className="btn small primary">開始</span>
    </Link>
  );
  return (
    <>
      {uid && <DemoBanner uid={uid} />}
      {hasPet && changeCard}
      <PageHead title="飼養前評估" sub="貓狗會陪你 10 到 15 年。先花三分鐘想清楚時間、經濟、住處、家人和自己的未來，養了就能照顧牠一輩子。不用登入也能做。" />
      <AssessForm />
      <p className="small muted" style={{ marginTop: 12 }}>每一題都有研究或專業建議當依據：<Link href="/assess/basis">看評估的依據</Link></p>
      {!hasPet && <div style={{ marginTop: 16 }}>{changeCard}</div>}
    </>
  );
}
