// 伺服器時區可能是 UTC，所有顯示和「今天」都明確用台灣時間計算。
const TZ = "Asia/Taipei";

export const nowIso = () => new Date().toISOString();

export function taipeiDate(d: Date | string = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(d));
}

export function monthKey(d: Date = new Date()) {
  return taipeiDate(d).slice(0, 7);
}

export function fmtDateTime(iso: string) {
  const d = new Date(iso);
  const today = taipeiDate();
  const yesterday = taipeiDate(new Date(Date.now() - 864e5));
  const day = taipeiDate(d);
  const hm = new Intl.DateTimeFormat("zh-TW", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  if (day === today) return `今天 ${hm}`;
  if (day === yesterday) return `昨天 ${hm}`;
  return `${day.slice(5).replace("-", "/")} ${hm}`;
}

export function fmtDate(iso: string) {
  return taipeiDate(iso).slice(5).replace("-", "/");
}

export function fmtToday() {
  return new Intl.DateTimeFormat("zh-TW", { timeZone: TZ, year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(new Date());
}

export function daysSince(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 864e5));
}

/** vaccineDue 格式為 2026/11/20；空字串或無法解析時回傳 null。 */
export function daysUntil(dateStr: string) {
  if (!dateStr) return null;
  const t = new Date(`${dateStr.replaceAll("/", "-")}T00:00:00+08:00`).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 864e5);
}
