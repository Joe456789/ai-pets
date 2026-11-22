import { ageYears } from "@/lib/records";
import type { CareKind, PetDoc, Stage } from "@/lib/types";

/** 2026-01-31 加一個月是 2026-02-28：月底不夠天數時停在該月最後一天。 */
export function addMonths(date: string, n: number) {
  const [y, m, d] = date.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

/** 下次該做的日期。不記得上次是什麼時候，就是「現在就該做」。 */
export const nextDueOf = (lastDone: string, everyMonths: number, today: string) => (lastDone ? addMonths(lastDone, everyMonths) : today);

/** 兩個日期差幾天（b - a）。 */
export function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);
}

export function dueLabel(nextDue: string, today: string) {
  const n = daysBetween(today, nextDue);
  if (n < 0) return { text: `超過 ${-n} 天`, tone: "late" as const };
  if (n === 0) return { text: "今天", tone: "soon" as const };
  if (n === 1) return { text: "明天", tone: "soon" as const };
  if (n <= 7) return { text: `${n} 天後`, tone: "soon" as const };
  return { text: nextDue.replaceAll("-", "/"), tone: "later" as const };
}

/** 老年：狗 8 歲、貓 10 歲以上（和醫療預備金同一個標準）。 */
export function isSenior(pet: Pick<PetDoc, "kind" | "birth">, now = new Date()) {
  const age = ageYears(pet, now);
  return age !== null && age >= (pet.kind === "貓" ? 10 : 8);
}

/** 毛孩現在是哪個階段。不知道生日就當成年。 */
export function stageOf(pet: Pick<PetDoc, "kind" | "birth">, now = new Date()): Stage {
  const age = ageYears(pet, now);
  if (age === null) return "成年";
  if (age < 1) return "幼年";
  return isSenior(pet, now) ? "老年" : "成年";
}

/** 建議的照顧項目。間隔是常見的做法，實際請照獸醫的安排調整。 */
export function careSuggestions(pet: Pick<PetDoc, "kind" | "birth">, now = new Date()): { kind: CareKind; label: string; everyMonths: number }[] {
  const senior = isSenior(pet, now);
  return [
    { kind: "驅蟲", label: "體內外寄生蟲預防", everyMonths: 1 },
    { kind: "疫苗", label: "疫苗補強", everyMonths: 12 },
    { kind: "健康檢查", label: senior ? "老年健康檢查" : "健康檢查", everyMonths: senior ? 6 : 12 },
  ];
}

export const CARE_KINDS: CareKind[] = ["驅蟲", "疫苗", "健康檢查", "其他"];
