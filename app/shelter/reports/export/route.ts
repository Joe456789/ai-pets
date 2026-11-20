import { requireManager } from "@/lib/auth";
import { shelterReport } from "@/lib/insights";
import { planOf } from "@/lib/plans";
import { getShelter, listAnimals } from "@/lib/repo";
import { taipeiDate } from "@/lib/time";

// 進階方案：匯出 CSV，用 Excel 開啟（開頭加 BOM，中文才不會亂碼）。
const cell = (v: string | number) => {
  const s = String(v);
  // 避免儲存格被 Excel 當成公式執行
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
};
const line = (cols: (string | number)[]) => cols.map(cell).join(",");

export async function GET() {
  const { sid } = await requireManager();
  const shelter = await getShelter(sid);
  if (!shelter || !planOf(shelter).export) return new Response("報表匯出是進階方案的功能", { status: 403 });

  const [report, animals] = await Promise.all([shelterReport(sid), listAnimals(sid)]);
  const adopted = animals.filter((a) => a.status === "已領養" && a.adoptedAt).sort((a, b) => b.adoptedAt!.localeCompare(a.adoptedAt!));
  const rows = [
    line([`${shelter.name} 成果報表`, `匯出日期 ${taipeiDate()}`]),
    "",
    line(["月份", "領養數", "領養申請", "領養前平均收容天數"]),
    ...report.perMonth.map((m) => line([m.m, m.adopted, m.applications, m.adopted ? m.avgDays : ""])),
    "",
    line(["目前在所", report.inCare, "開放領養", report.open]),
    line(["領養人訊息：AI 直接回覆", report.aiHandled, "轉人工", report.handedOff]),
    "",
    line(["已領養動物", "編號", "種類", "入所日期", "領養日期", "收容天數"]),
    ...adopted.map((a) => line([a.name, a.code, a.kind, taipeiDate(a.intakeAt), taipeiDate(a.adoptedAt!), Math.round((new Date(a.adoptedAt!).getTime() - new Date(a.intakeAt).getTime()) / 864e5)])),
  ];
  const filename = encodeURIComponent(`${shelter.name}-成果報表-${taipeiDate()}.csv`);
  return new Response(`﻿${rows.join("\r\n")}`, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename*=UTF-8''${filename}`, "Cache-Control": "no-store" },
  });
}
