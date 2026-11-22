import { currentUid } from "@/lib/auth";
import { mediaType, readFile, scopeOf, validFile, verifyFileSig } from "@/lib/media";

// 私人檔案：本人登入才能讀；分享頁和工作站要帶伺服器簽發的簽章（?s=）。
export async function GET(req: Request, { params }: { params: Promise<{ scope: string; file: string }> }) {
  const { scope, file } = await params;
  if (!validFile(scope, file)) return new Response("Not found", { status: 404 });
  const url = `/files/${scope}/${file}`;
  const uid = await currentUid();
  const allowed = (uid && scopeOf(uid) === scope) || verifyFileSig(url, new URL(req.url).searchParams.get("s"));
  // 沒有權限和不存在回一樣的結果，不透露檔案是否存在。
  if (!allowed) return new Response("Not found", { status: 404 });
  const data = await readFile(scope, file);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": mediaType(file),
      "Content-Length": String(data.length),
      // 醫療單據是私人資料：不讓瀏覽器留快取，登出後或共用手機上就看不到。
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
