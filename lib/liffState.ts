/**
 * LINE 打開 https://liff.line.me/<LIFF ID>/assess 時，會先開網站首頁並帶 ?liff.state=/assess。
 * 這裡算出要直接轉去的網址：只接受本站的相對路徑，其他參數（例如登入回來的 code）一併帶過去。
 */
export function liffTarget(params: Record<string, string | string[] | undefined>): string | null {
  const raw = params["liff.state"];
  const state = Array.isArray(raw) ? raw[0] : raw;
  if (!state || !state.startsWith("/") || state.startsWith("//") || state.includes("\\")) return null;
  const url = new URL(state, "https://x.invalid");
  if (url.origin !== "https://x.invalid") return null;
  for (const [k, v] of Object.entries(params)) {
    if (k === "liff.state" || v === undefined) continue;
    for (const one of Array.isArray(v) ? v : [v]) url.searchParams.append(k, one);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

/** LINE 內建瀏覽器（含 LIFF）的 User-Agent 會有「 Line/版本」。 */
export const inLine = (ua: string | null) => /\bLine\/\d/i.test(ua ?? "");
