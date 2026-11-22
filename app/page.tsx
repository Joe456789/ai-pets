import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { inLine, liffTarget } from "@/lib/liffState";

// 加好友網址是部署後才設定的環境變數，不能在建置時就固定下來。
export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // 從 LINE 打開時，proxy.ts 已經先轉走了；這裡是保險。
  const target = liffTarget(await searchParams);
  if (target) redirect(target);
  if (inLine((await headers()).get("user-agent"))) redirect("/me");
  const addUrl = process.env.LINE_ADD_URL;
  return (
    <>
      <section className="hero">
        <h1>從此有你，<br />就是一輩子。</h1>
        <p>養貓狗不是一時的決定。「從此有你」用 AI 陪你在養之前想清楚、養的時候把照顧記下來，到最後好好說再見。</p>
        <div className="row" style={{ marginTop: 18 }}>
          {addUrl && <a className="btn primary" href={addUrl}>加入 LINE 好友</a>}
          <Link className={`btn ${addUrl ? "" : "primary"}`} href="/assess">先做飼養前評估</Link>
          <Link className="btn" href="/demo">看示範（不用登入）</Link>
        </div>
      </section>

      <div className="journey">
        <Link className="step" href="/assess">
          <span className="step-n">1</span>
          <span className="tag">相遇之前</span>
          <h2>飼養前評估</h2>
          <p>15 個問題，看你的時間、經濟、住處、家人、未來幾年的變動，還有為什麼想養。規則算出準備度和風險，AI 寫成白話報告，再估算一輩子大約要花多少。</p>
        </Link>
        <Link className="step mid" href="/me">
          <span className="step-n">2</span>
          <span className="tag">相守的日子</span>
          <h2>照顧日曆、小學堂、醫療單據、生活變動</h2>
          <p>驅蟲、疫苗、健檢到期前一天用 LINE 提醒；飼主小學堂依毛孩的月齡和季節，在對的時候推對的課。看完診拍下單據，AI 照原文整理成紀錄、解釋看不懂的名詞，也幫你算每月該存多少醫療預備金。要搬家、懷孕或出國時，做一次生活變動檢查，拿到分階段的準備清單。</p>
        </Link>
        <Link className="step end" href="/memorial">
          <span className="step-n">3</span>
          <span className="tag">好好說再見</span>
          <h2>紀念與告別</h2>
          <p>當牠離開，用你手機裡的照片重建牠的 3D 樣子。可以轉動看看、用手機把牠放在身邊，再留下一段你們的故事。</p>
        </Link>
      </div>

      <section className="card" style={{ marginTop: 18 }}>
        <h2>為什麼要做這件事</h2>
        <p className="muted small">搬家、經濟壓力、家人反對、生小孩、醫療費用，是飼主放棄貓狗時常說出的理由，其中很多在養之前就看得到。從評估開始想清楚，養了之後把照顧和花費記下來，就更有機會陪牠走完一生。</p>
      </section>
    </>
  );
}
