import { NextResponse, type NextRequest } from "next/server";
import { inLine, liffTarget } from "@/lib/liffState";

/**
 * LIFF 一定先打開網站根目錄，要去的頁面放在 liff.state。在畫任何東西之前就轉過去，首頁不會閃一下。
 * 在 LINE 裡沒有首頁，直接進「我的毛孩」。
 * Cloud Run 上 request.url 的主機是 0.0.0.0:8080，所以用 Host 和 X-Forwarded-Proto 組回使用者看到的網址。
 */
export function proxy(req: NextRequest) {
  const params: Record<string, string[]> = {};
  for (const [k, v] of req.nextUrl.searchParams) (params[k] ??= []).push(v);
  const target = liffTarget(params) ?? (inLine(req.headers.get("user-agent")) ? "/me" : null);
  if (!target) return NextResponse.next();
  return NextResponse.redirect(new URL(target, origin(req)), 307);
}

// 正式環境用固定的 APP_URL，不相信請求帶來的 Host（可以被偽造）；本機開發才看 Host。
function origin(req: NextRequest) {
  if (process.env.NODE_ENV === "production" && process.env.APP_URL) return process.env.APP_URL;
  return `${req.nextUrl.protocol}//${req.headers.get("host") ?? req.nextUrl.host}`;
}

export const config = { matcher: "/" };
