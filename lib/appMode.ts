import { cookies, headers } from "next/headers";
import { inLine } from "@/lib/liffState";

/** 是否在 LINE 裡（LIFF）打開。本機開發可以用 cy_inline=1 這個 cookie 模擬，正式環境只看 User-Agent。 */
export async function isAppMode() {
  const devForce = process.env.NODE_ENV !== "production" && (await cookies()).get("cy_inline")?.value === "1";
  return devForce || inLine((await headers()).get("user-agent"));
}
