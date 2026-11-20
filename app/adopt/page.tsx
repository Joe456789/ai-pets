import Link from "next/link";
import { AdoptBrowser } from "@/components/AdoptBrowser";
import { PetImage } from "@/components/PetImage";
import { listPublicAnimals } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function AdoptList() {
  const animals = (await listPublicAnimals()).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return (
    <>
      <section className="pub-hero">
        <div>
          <h1>每一隻都在等<br /><mark>對的那個家</mark></h1>
          <p>瀏覽各協會正在等家的貓狗。不知道哪隻適合你？回答幾個問題，AI 幫你找找看。</p>
          <Link className="btn clay" href="/adopt/match">開始配對</Link>
        </div>
        <div className="hero-pets">
          {animals.slice(0, 3).map((a) => <div key={a.id}><PetImage pet={a} /></div>)}
        </div>
      </section>
      <AdoptBrowser animals={animals} />
      <section className="card open-cta">
        <div>
          <h2 style={{ margin: 0 }}>也看看公立收容所的毛孩</h2>
          <p className="small muted">全國公立收容所開放認養的貓狗，每天依農業部開放資料更新，AI 幫忙整理成好讀的介紹。</p>
        </div>
        <Link className="btn primary" href="/adopt/public">瀏覽公立收容所</Link>
      </section>
    </>
  );
}
