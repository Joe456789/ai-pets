import { NextResponse } from "next/server";
import { startSession } from "@/lib/auth";
import { ensureOwner } from "@/lib/repo";

/** 本機開發專用的假登入，正式環境一律 404。 */
export async function POST() {
  if (process.env.NODE_ENV === "production") return new NextResponse("Not found", { status: 404 });
  await ensureOwner("dev-owner", "本機測試飼主");
  await startSession("dev-owner");
  return NextResponse.json({ ok: true });
}
