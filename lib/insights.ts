import { estimateCostTwd, getUsage } from "@/lib/ai/gemini";
import * as repo from "@/lib/repo";
import { daysSince, daysUntil, monthKey, taipeiDate } from "@/lib/time";
import type { AnimalDoc, ShelterDoc } from "@/lib/types";

// 從現有資料算出建議和報表。判斷都是規則，AI 只負責把結果寫成摘要。

const lastMonths = (n: number) => {
  const out: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) out.push(monthKey(new Date(d.getFullYear(), d.getMonth() - i, 15)));
  return out;
};
export const monthLabel = (key: string) => `${Number(key.slice(5))}月`;

export type Suggestion = { kind: "送養" | "照護" | "資源" | "資料" | "申請"; title: string; why: string; href: string; action: string };

export async function shelterSuggestions(sid: string): Promise<Suggestion[]> {
  const [animals, apps] = await Promise.all([repo.listAnimals(sid), repo.listApplications(sid)]);
  const inCare = animals.filter((a) => a.status !== "已領養");
  const out: Suggestion[] = [];

  const wanted = new Set(apps.filter((a) => a.status === "待審核" || a.status === "面談中").map((a) => a.animalId));
  const waiting = inCare.filter((a) => a.status === "開放領養" && !wanted.has(a.id)).sort((a, b) => a.intakeAt.localeCompare(b.intakeAt)).slice(0, 3);
  for (const a of waiting) {
    out.push({ kind: "送養", title: `優先曝光：${a.name}`, why: `已收容 ${daysSince(a.intakeAt)} 天，目前沒有人申請。`, href: `/shelter/content?animal=${a.id}`, action: "重寫介紹或社群貼文" });
  }
  for (const a of inCare.filter(repo.isFlagged)) {
    out.push({ kind: "照護", title: `留意：${a.name}`, why: `現場回報「${a.flagNote ?? ""}」，建議持續留意，必要時諮詢獸醫。`, href: `/shelter/animals/${a.id}`, action: "查看照護紀錄" });
  }
  const soon = inCare.filter((a) => { const d = daysUntil(a.vaccineDue); return d !== null && d <= 30; });
  if (soon.length) {
    out.push({ kind: "資源", title: `${soon.length} 隻疫苗 30 天內到期`, why: `${soon.map((a) => `${a.name} ${a.vaccineDue}`).join("、")}。合併預約可以減少往返。`, href: "/shelter/animals", action: "查看名單" });
  }
  const incomplete = inCare.filter((a) => a.status === "開放領養" && (a.photos.length === 0 || Object.values(a.tags).includes("未知")));
  if (incomplete.length) {
    out.push({ kind: "資料", title: `${incomplete.length} 隻資料不完整`, why: `${incomplete.slice(0, 5).map((a) => a.name).join("、")}缺少照片或媒合條件，配對分數會比較不準。`, href: `/shelter/content?animal=${incomplete[0].id}`, action: "補資料" });
  }
  const stale = apps.filter((a) => a.status === "待審核" && daysSince(a.createdAt) >= 3);
  if (stale.length) {
    out.push({ kind: "申請", title: `${stale.length} 件申請等超過 3 天`, why: "等太久領養人可能會放棄，建議盡快回覆。", href: "/shelter/applications", action: "前往審核" });
  }
  return out;
}

export async function shelterReport(sid: string) {
  const [animals, apps, convs] = await Promise.all([repo.listAnimals(sid), repo.listApplications(sid), repo.listConversations(sid)]);
  const months = lastMonths(6);
  const adopted = animals.filter((a) => a.status === "已領養" && a.adoptedAt);
  const perMonth = months.map((m) => {
    const rows = adopted.filter((a) => taipeiDate(a.adoptedAt!).startsWith(m));
    const avg = rows.length ? Math.round(rows.reduce((s, a) => s + (new Date(a.adoptedAt!).getTime() - new Date(a.intakeAt).getTime()) / 864e5, 0) / rows.length) : 0;
    return { m, label: monthLabel(m), adopted: rows.length, avgDays: avg, applications: apps.filter((x) => taipeiDate(x.createdAt).startsWith(m)).length };
  });
  const inCare = animals.filter((a) => a.status !== "已領養");
  return {
    perMonth,
    inCare: inCare.length,
    open: inCare.filter((a) => a.status === "開放領養").length,
    adoptedTotal: adopted.length,
    aiHandled: convs.filter((c) => c.status === "AI 已回覆").length,
    handedOff: convs.filter((c) => c.status !== "AI 已回覆").length,
    usage: await getUsage(sid),
  };
}

export async function platformOverview() {
  const shelters = await repo.listShelters();
  const months = lastMonths(6);
  const rows = await Promise.all(shelters.map(async (s) => {
    const [animals, apps, creds, usage] = await Promise.all([repo.listAnimals(s.id), repo.listApplications(s.id), repo.getLineCreds(s.id), getUsage(s.id)]);
    return { s, animals, apps, line: Boolean(creds), usage };
  }));
  const all = rows.flatMap((r) => r.animals);
  const adopted = all.filter((a: AnimalDoc) => a.status === "已領養" && a.adoptedAt);
  const platform = await getUsage("platform");
  const usageRows = rows.map((r) => ({ s: r.s, ...r.usage }));
  const tokens = [...usageRows, platform].reduce((t, u) => ({ i: t.i + (u.inputTokens ?? 0), o: t.o + (u.outputTokens ?? 0), v: t.v + (u.videoTokens ?? 0), c: t.c + (u.calls ?? 0) }), { i: 0, o: 0, v: 0, c: 0 });
  return {
    shelters,
    rows,
    inCare: all.filter((a) => a.status !== "已領養").length,
    open: all.filter((a) => a.status === "開放領養").length,
    adoptedThisMonth: adopted.filter((a) => taipeiDate(a.adoptedAt!).startsWith(monthKey())).length,
    perMonth: months.map((m) => ({ label: monthLabel(m), value: adopted.filter((a) => taipeiDate(a.adoptedAt!).startsWith(m)).length })),
    aiCalls: tokens.c,
    aiCostTwd: estimateCostTwd(tokens.i, tokens.o, tokens.v),
    usageRows,
    platformUsage: platform,
  };
}

export const shelterLabel = (s: Pick<ShelterDoc, "status" | "due">) => {
  const d = daysUntil(s.due);
  return d !== null && d <= 30 && s.status !== "已停用" ? `${d < 0 ? "已過期" : `${d} 天後到期`}` : "";
};
