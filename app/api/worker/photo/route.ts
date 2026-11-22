import { readFileByUrl } from "@/lib/media";
import { getMemorial } from "@/lib/repo";
import { denied, workerAuthorized } from "@/lib/worker";

/** 下載紀念任務的第 i 張照片（只限製作中的任務）。 */
export async function GET(req: Request) {
  if (!workerAuthorized(req)) return denied();
  const q = new URL(req.url).searchParams;
  const m = await getMemorial(q.get("id") ?? "");
  const i = Number(q.get("i"));
  if (!m || m.status !== "製作中" || !Number.isInteger(i) || !m.photos[i]) return new Response("Not found", { status: 404 });
  const data = await readFileByUrl(m.photos[i]);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), { headers: { "Content-Type": "image/jpeg" } });
}
