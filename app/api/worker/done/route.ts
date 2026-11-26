import { NextResponse } from "next/server";
import { notifyMemorialReady } from "@/lib/line/handler";
import { saveGlb } from "@/lib/media";
import { getMemorial, updateMemorial } from "@/lib/repo";
import { denied, workerAuthorized } from "@/lib/worker";

/** 工作站上傳做好的 GLB：存到飼主的私人範圍，標記完成並用 LINE 通知。 */
export async function POST(req: Request) {
  if (!workerAuthorized(req)) return denied();
  const m = await getMemorial(new URL(req.url).searchParams.get("id") ?? "");
  if (!m || m.status !== "製作中") return NextResponse.json({ error: "任務不存在或不是製作中" }, { status: 404 });
  try {
    const glb = await saveGlb(m.uid, Buffer.from(await req.arrayBuffer()));
    await updateMemorial(m.id, { status: "完成", glb, error: "" });
    await notifyMemorialReady(m.uid, m.petName, m.id, m.keepsake);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
