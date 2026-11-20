import { HEALTH_NOTICE } from "@/lib/constants";
import type { LineMessage } from "@/lib/line/client";
import { daysSince } from "@/lib/time";
import type { AnimalDoc, ApplicationDoc, CareDoc, CareDraft, IntakeDraft, ShelterDoc, StaffDoc } from "@/lib/types";

const MOSS = "#2F5D50";
const CLAY = "#BD5A33";
const INK = "#26302B";
const MUTED = "#6B736D";

type Button = { label: string; data: string; primary?: boolean };

export function text(body: string, quick?: { label: string; data?: string; text?: string }[]): LineMessage {
  const msg: LineMessage = { type: "text", text: body.slice(0, 4900) };
  if (quick?.length) {
    msg.quickReply = {
      items: quick.slice(0, 13).map((q) => ({
        type: "action",
        action: q.data
          ? { type: "postback", label: q.label.slice(0, 20), data: q.data, displayText: q.label }
          : { type: "message", label: q.label.slice(0, 20), text: q.text ?? q.label },
      })),
    };
  }
  return msg;
}

function row(key: string, value: string) {
  return {
    type: "box", layout: "baseline", spacing: "md",
    contents: [
      { type: "text", text: key, size: "sm", color: MUTED, flex: 3, wrap: true },
      { type: "text", text: value || "未填寫", size: "sm", color: value ? INK : MUTED, flex: 5, wrap: true, align: "end" },
    ],
  };
}

export function card(opts: { alt: string; head: string; alert?: boolean; rows?: [string, string][]; note?: string; notice?: boolean; buttons?: Button[] }): LineMessage {
  const body: unknown[] = (opts.rows ?? []).map(([k, v]) => row(k, v));
  if (opts.note) body.push({ type: "text", text: opts.note, size: "sm", color: INK, wrap: true });
  if (opts.notice) body.push({ type: "text", text: HEALTH_NOTICE, size: "xxs", color: MUTED, wrap: true, margin: "md" });
  const bubble: Record<string, unknown> = {
    type: "bubble",
    header: {
      type: "box", layout: "vertical", backgroundColor: opts.alert ? CLAY : MOSS, paddingAll: "12px",
      contents: [{ type: "text", text: opts.head, color: "#FFFFFF", weight: "bold", size: "md", wrap: true }],
    },
    body: { type: "box", layout: "vertical", spacing: "sm", paddingAll: "14px", contents: body.length ? body : [{ type: "text", text: " " }] },
  };
  if (opts.buttons?.length) {
    bubble.footer = {
      type: "box", layout: "horizontal", spacing: "sm",
      contents: opts.buttons.map((b) => ({
        type: "button", style: b.primary ? "primary" : "secondary", color: b.primary ? MOSS : undefined, height: "sm",
        action: { type: "postback", label: b.label, data: b.data, displayText: b.label },
      })),
    };
  }
  return { type: "flex", altText: opts.alt.slice(0, 390), contents: bubble };
}

export const bindOkCard = (staff: StaffDoc, shelter: ShelterDoc) =>
  card({
    alt: `綁定成功：${staff.name}`, head: "綁定成功",
    rows: [["姓名", staff.name], ["協會", shelter.name], ["負責區域", staff.area]],
    note: "下方已切換成工作選單。這組工作號已綁定你的 LINE 帳號，其他人無法再使用。",
  });

export const intakeDraftCard = (d: IntakeDraft, token: string, photoCount: number) =>
  card({
    alt: "AI 整理好動物檔案，請確認", head: "AI 整理好了，請確認",
    rows: [
      ["名字", d.name || "待取名"], ["種類", d.kind], ["性別", d.sex], ["年齡", d.age], ["體型", d.size], ["毛色", d.coat],
      ["發現地點", d.foundAt], ["絕育", d.neutered], ["個性", d.traits.join("、")], ["照片", `${photoCount} 張`],
      ...(d.notes ? ([["備註", d.notes]] as [string, string][]) : []),
    ],
    buttons: [{ label: "確認存檔", data: `a=intake_ok&t=${token}`, primary: true }, { label: "修改", data: `a=intake_edit&t=${token}` }, { label: "取消", data: "a=cancel" }],
  });

export function careDraftCard(d: CareDraft, names: Map<string, string>, token: string) {
  const rows: [string, string][] = [
    ...d.areas.map((a): [string, string] => [a, "無異常回報"]),
    ...d.entries.map((e): [string, string] => [e.animalId ? names.get(e.animalId) ?? e.mentionedName : `${e.mentionedName}（找不到）`, e.text]),
  ];
  const unresolved = d.entries.filter((e) => !e.animalId);
  const note = unresolved.length
    ? `有 ${unresolved.length} 筆對不上動物，存檔時會略過。${unresolved.flatMap((e) => e.candidates ?? []).length ? `同名：${unresolved.flatMap((e) => e.candidates ?? []).join("、")}，請改用編號再回報一次。` : "請確認名字或改用編號。"}`
    : undefined;
  return card({
    alt: "AI 整理好照護回報，請確認", head: `AI 拆成 ${rows.length} 筆，請確認`, rows, note,
    buttons: [{ label: "確認", data: `a=care_ok&t=${token}`, primary: true }, { label: "重講一次", data: "a=care" }, { label: "取消", data: "a=cancel" }],
  });
}

export const careAlertCard = (name: string, category: string) =>
  card({
    alt: `請留意：${name}`, head: `請留意：${name}`, alert: true,
    note: `紀錄顯示${name}連續 2 天有「${category}」方面的回報，建議持續留意，必要時諮詢獸醫。`, notice: true,
  });

export function animalCard(a: AnimalDoc, care: CareDoc[]) {
  const latest = care[0];
  return card({
    alt: `${a.name} ${a.code}`, head: `${a.name}　${a.code}`,
    rows: [
      ["狀態", a.status], ["區域", a.area], ["已收容", `${daysSince(a.intakeAt)} 天`], ["疫苗到期", a.vaccineDue],
      ["最近回報", latest ? latest.text : "無異常回報"], ["前次回報", care[1]?.text ?? "—"],
    ],
    notice: care.some((c) => c.concerning),
  });
}

export function digestCard(d: { unreported: string[]; partial?: string[]; flagged: AnimalDoc[]; vaccines: AnimalDoc[]; pendingApps: unknown[]; pendingConvs: unknown[] }, dateLabel: string) {
  const partial = d.partial ?? [];
  return card({
    alt: `今日摘要 ${dateLabel}`, head: `今日摘要　${dateLabel}`,
    rows: [
      ["尚未回報", d.unreported.join("、") || (partial.length ? "無" : "都回報了")],
      ...(partial.length ? [["只有個別回報", partial.join("、")] as [string, string]] : []),
      ["需留意", d.flagged.map((a) => `${a.name}（${a.flagNote ?? ""}）`).join("、") || "無"],
      ["疫苗 14 天內到期", d.vaccines.map((a) => `${a.name} ${a.vaccineDue}`).join("、") || "無"],
      ["待審申請", `${d.pendingApps.length} 件`],
      ["待處理訊息", `${d.pendingConvs.length} 則`],
    ],
    note: "其餘動物為「無異常回報」，代表沒有人回報狀況，不等於確認健康。",
    notice: d.flagged.length > 0,
  });
}

export const staffInfoCard = (s: StaffDoc, shelter: ShelterDoc) =>
  card({ alt: `我的資料：${s.name}`, head: "我的資料", rows: [["姓名", s.name], ["身分", s.role], ["工作號", s.code], ["協會", shelter.name], ["負責區域", s.area]] });

export const STAFF_HELP = `使用說明

新增動物：按「新增動物」，傳照片，再講一段話或打字說明。AI 整理好後要由你確認才會存檔。

回報照護：按「回報照護」，只講有狀況的動物，例如「A 區都正常，小黑今天沒吃」。

查詢動物：按「查詢動物」後輸入名字或編號。

隨時可以傳「取消」結束目前的動作。`;

export const applicationCard = (a: ApplicationDoc) => {
  const next: Record<ApplicationDoc["status"], string> = {
    待審核: "協會審核中，會再與你聯絡。", 面談中: "協會會與你約面談和互動時間。", 已通過: "恭喜！協會會與你確認帶牠回家的安排。", 未通過: "這次沒有通過，協會會說明原因，也歡迎再認識其他毛孩。",
  };
  return card({ alt: `申請進度：${a.status}`, head: `申請：${a.animalName}`, rows: [["申請編號", a.publicCode], ["目前進度", a.status]], note: next[a.status] });
};

export const healthNoticeCard = (body: string) => card({ alt: "建議諮詢獸醫", head: "建議諮詢獸醫", alert: true, note: body, notice: true });

export const handoffCard = (shelterName: string) => card({ alt: "已轉給協會人員", head: "已轉給協會人員", rows: [["協會", shelterName], ["狀態", "等待人員回覆"]] });
