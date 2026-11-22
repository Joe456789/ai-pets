import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { TabBar } from "@/components/TabBar";
import { isAppMode } from "@/lib/appMode";
import "./globals.css";

export const metadata: Metadata = {
  title: "從此有你",
  description: "從決定養貓狗、照顧牠一輩子，到最後好好說再見。用 AI 陪飼主實踐終養不棄養。",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f8f3ea", viewportFit: "cover" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // 在 LINE 裡（LIFF）打開：不要網站頁首和頁尾，改用底部分頁，像 App 一樣。
  const app = await isAppMode();
  return (
    <html lang="zh-Hant">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&family=Noto+Serif+TC:wght@500;900&display=swap" rel="stylesheet" />
      </head>
      <body className={app ? "in-line" : undefined}>
        {!app && (
          <header className="site-head">
            <Link className="brand" href="/"><span className="brand-mark" aria-hidden>有</span>從此有你</Link>
            <nav className="site-nav" aria-label="主要">
              <Link href="/assess">飼養前評估</Link>
              <Link href="/me">我的毛孩</Link>
              <Link href="/learn">小學堂</Link>
              <Link href="/memorial">紀念</Link>
            </nav>
          </header>
        )}
        <main className="wrap">{children}</main>
        {app ? <TabBar /> : (
          <footer className="site-foot">
            <span>本作品提供之資訊僅供輔助參考，不能取代獸醫師之診斷、治療或專業建議。</span>
            <span>示範帳號的毛孩、單據和紀念都是虛構資料。</span>
          </footer>
        )}
      </body>
    </html>
  );
}
