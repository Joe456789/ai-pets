import { createHash, timingSafeEqual } from "node:crypto";

/**
 * 3D 工作站（在飼主看不到的另一台電腦上跑 TRELLIS）用 WORKER_TOKEN 呼叫 /api/worker/*。
 * 沒設定 WORKER_TOKEN 時一律拒絕。比對雜湊值，避免長度不同時洩漏時間差。
 */
export function workerAuthorized(req: Request) {
  const token = process.env.WORKER_TOKEN;
  if (!token || token.length < 24) return false;
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const h = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(h(given), h(token));
}

export const denied = () => new Response("Unauthorized", { status: 401 });
