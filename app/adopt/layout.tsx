import Link from "next/link";
import { HEALTH_NOTICE } from "@/lib/constants";

export default function AdoptLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="pub-top">
        <div className="pub-top-in">
          <Link href="/adopt" className="pub-brand"><span className="logo-mark" aria-hidden>浪</span>浪浪夥伴</Link>
          <nav className="pub-nav">
            <Link href="/adopt">找動物</Link>
            <Link href="/adopt/shelters">合作協會</Link>
            <Link href="/adopt/supplies">捐物資</Link>
            <Link className="btn small clay" href="/adopt/match">幫我配對</Link>
          </nav>
        </div>
      </header>
      <main className="pub-main">{children}</main>
      <footer className="pub-foot">
        <p>{HEALTH_NOTICE}</p>
        <p>動物介紹由各協會提供，AI 協助撰寫並經協會人員確認後公開。目前展示的協會與動物為虛構示範資料。</p>
      </footer>
    </>
  );
}
