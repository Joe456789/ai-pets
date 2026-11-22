import { NextResponse } from "next/server";
import { startDemoSession } from "@/lib/auth";

/** 「看示範」：不用 LINE，用唯讀的示範帳號看完整流程。 */
export async function GET() {
  await startDemoSession();
  // 用相對網址：Cloud Run 裡 req.url 是容器內部位址（0.0.0.0:8080），不能拿來組轉址。
  return new NextResponse(null, { status: 303, headers: { Location: "/me" } });
}
