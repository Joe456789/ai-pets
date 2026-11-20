import Link from "next/link";
import { PetImage } from "@/components/PetImage";
import { listPublicAnimals } from "@/lib/repo";

export const dynamic = "force-dynamic";

const steps = [
  { t: "拍照、講一句話就建檔", d: "現場人員在 LINE 傳照片和語音，AI 整理成動物檔案，確認後存檔。" },
  { t: "只回報有狀況的", d: "「A 區都正常，小黑今天沒吃」一句話，AI 自動拆到每隻動物，連續異常會提醒。" },
  { t: "AI 寫送養介紹", d: "依檔案寫公開頁介紹和社群貼文，人員確認後才公開，不寫任何健康保證。" },
  { t: "配對與申請", d: "領養人回答幾個問題，系統依條件計分推薦，申請直接送到協會後台。" },
];

export default async function Home() {
  const pets = (await listPublicAnimals()).slice(0, 3);
  return (
    <main className="hub">
      <div className="hub-hero">
        <span className="logo-mark" aria-hidden>浪</span>
        <h1>浪浪夥伴</h1>
      </div>
      <p className="hub-lede">給民間動物協會的 AI 收容夥伴。現場人員用 LINE 就能建檔和回報照護，管理者在網頁後台送養和審核，領養人在網站找到適合的毛孩。</p>
      <div className="hub-grid">
        <Link href="/adopt" className="hub-col adopt home-entry">
          <h2>我想領養</h2>
          <p>瀏覽各協會正在等家的貓狗，或回答幾個問題讓系統幫你配對。</p>
          <span className="btn small clay">找毛孩</span>
        </Link>
        <Link href="/login/shelter" className="hub-col home-entry">
          <h2>協會後台</h2>
          <p>協會管理者登入，管理動物、送養內容、領養申請和人員工作號。</p>
          <span className="btn small primary">協會登入</span>
        </Link>
        <Link href="/login/admin" className="hub-col admin home-entry">
          <h2>平台總後台</h2>
          <p>平台管理者登入，開通協會、串接 LINE、查看收費與 AI 用量。</p>
          <span className="btn small">平台登入</span>
        </Link>
      </div>
      <section style={{ marginTop: 36 }}>
        <h2 style={{ font: "900 22px var(--serif)", marginBottom: 12 }}>怎麼運作</h2>
        <div className="grid-even">
          {steps.map((s, i) => <div className="card" key={s.t}><b>{i + 1}. {s.t}</b><p className="small muted" style={{ marginTop: 4 }}>{s.d}</p></div>)}
        </div>
      </section>
      {pets.length > 0 && (
        <section style={{ marginTop: 36 }}>
          <h2 style={{ font: "900 22px var(--serif)", marginBottom: 12 }}>正在等家</h2>
          <div className="hero-pets" style={{ maxWidth: 420 }}>{pets.map((p) => <Link key={p.id} href={`/adopt/animals/${p.id}`}><PetImage pet={p} /></Link>)}</div>
        </section>
      )}
      <p className="hub-foot">本網站提供之資訊僅供輔助參考，不能取代獸醫師之診斷、治療或專業建議。目前展示的協會與動物為虛構示範資料。</p>
    </main>
  );
}
