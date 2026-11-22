import { NextResponse } from "next/server";
import { claimNextMemorial } from "@/lib/repo";
import { denied, workerAuthorized } from "@/lib/worker";

/** 工作站領下一個 3D 紀念任務。沒有任務回 204。照片用 /api/worker/photo 下載。 */
export async function POST(req: Request) {
  if (!workerAuthorized(req)) return denied();
  const m = await claimNextMemorial();
  if (!m) return new Response(null, { status: 204 });
  return NextResponse.json({ id: m.id, kind: m.kind, photos: m.photos.length });
}
