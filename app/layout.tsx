import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "浪浪夥伴",
  description: "給民間動物協會使用的 AI 收容平台。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&family=Noto+Serif+TC:wght@600;900&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
