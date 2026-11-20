import { getDb } from "@/lib/db";
import { daysUntil, taipeiDate } from "@/lib/time";
import type { ManagerDoc, ShelterDoc, StaffDoc } from "@/lib/types";

// 三種方案的限制。月費金額還沒決定，這裡只管功能和數量。
export type PlanName = ShelterDoc["plan"];
export type Plan = { aiCap: number; staff: number | null; managers: number; export: boolean; period: string };

export const PLANS: Record<PlanName, Plan> = {
  試用: { aiCap: 300, staff: 5, managers: 1, export: false, period: "30 天" },
  基本: { aiCap: 1000, staff: 15, managers: 1, export: false, period: "月費" },
  進階: { aiCap: 3000, staff: null, managers: 3, export: true, period: "月費" },
};
export const PLAN_NAMES = Object.keys(PLANS) as PlanName[];
export const TRIAL_DAYS = 30;

export const planOf = (s: Pick<ShelterDoc, "plan">) => PLANS[s.plan] ?? PLANS.試用;
/** 平台管理者可以替個別協會調高或調低，沒設定時用方案預設值。 */
export const aiCapOf = (s: Pick<ShelterDoc, "plan" | "aiCap">) => s.aiCap ?? planOf(s).aiCap;
export const limitText = (n: number | null) => (n === null ? "不限" : String(n));

export function planExpired(s: Pick<ShelterDoc, "due">) {
  const d = daysUntil(s.due);
  return d !== null && d < 0;
}
/** 試用到期後 AI 功能暫停；付費方案到期只提醒續約，不中斷服務。 */
export const trialExpired = (s: Pick<ShelterDoc, "plan" | "due">) => s.plan === "試用" && planExpired(s);

export function trialDue(from = new Date()) {
  return taipeiDate(new Date(from.getTime() + TRIAL_DAYS * 864e5)).replaceAll("-", "/");
}

export async function staffQuota(s: Pick<ShelterDoc, "id" | "plan">) {
  const used = (await getDb().list<StaffDoc>(`shelters/${s.id}/staff`)).filter((x) => !x.disabled).length;
  const limit = planOf(s).staff;
  return { used, limit, full: limit !== null && used >= limit };
}

export async function managerQuota(s: Pick<ShelterDoc, "id" | "plan">) {
  const used = (await getDb().list<ManagerDoc>("managers", [["sid", s.id]])).length;
  const limit = planOf(s).managers;
  return { used, limit, full: used >= limit };
}
