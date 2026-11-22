import { NextResponse } from "next/server";
import { getMemorial, updateMemorial } from "@/lib/repo";
import { denied, workerAuthorized } from "@/lib/worker";

/** 工作站回報做不出來（例如照片裡找不到動物）。錯誤訊息會顯示給飼主，所以只收簡短中文。 */
export async function POST(req: Request) {
  if (!workerAuthorized(req)) return denied();
  const m = await getMemorial(new URL(req.url).searchParams.get("id") ?? "");
  if (!m || m.status !== "製作中") return NextResponse.json({ error: "任務不存在或不是製作中" }, { status: 404 });
  const { error } = (await req.json().catch(() => ({}))) as { error?: string };
  await updateMemorial(m.id, { status: "失敗", error: (error ?? "製作失敗").slice(0, 120) });
  return NextResponse.json({ ok: true });
}
