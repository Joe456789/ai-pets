// 請 LINE 官方驗證所有訊息卡片的格式，不會真的傳送給任何人。
// 用法：npx tsx --env-file=.env.local scripts/check-line.ts
import * as msg from "@/lib/line/messages";
import type { LineMessage } from "@/lib/line/client";
import type { AnimalDoc, ApplicationDoc, IntakeDraft, ShelterDoc, StaffDoc } from "@/lib/types";

const shelter = { id: "s", name: "暖窩動物協會", area: "新北市", intro: "", hours: "", phone: "", codePrefix: "NW", areas: ["A 區"], faq: [], plan: "基本", due: "", status: "使用中" } as ShelterDoc;
const staff: StaffDoc = { code: "A27391568", name: "林小芸", role: "現場人員", area: "A 區、B 區", disabled: false };
const animal = { id: "a", code: "NW-0231", name: "小黑", status: "在所照護", area: "A 區", intakeAt: new Date().toISOString(), vaccineDue: "", flagNote: "今天沒吃" } as AnimalDoc;
const app = { publicCode: "LL-ABC234", animalName: "阿福", status: "待審核" } as ApplicationDoc;
const draft: IntakeDraft = { kind: "狗", sex: "公", name: "", age: "", ageGroup: "未知", size: "中型", coat: "棕色", foundAt: "", neutered: "未知", traits: [], notes: "很親人" };
const care = { areas: ["A 區"], entries: [
  { animalId: "a", mentionedName: "小黑", text: "今天沒吃", category: "食慾", concerning: true },
  { animalId: "", mentionedName: "不明", text: "精神不好", category: "精神", concerning: true, candidates: ["小花（NW-1）", "小花（NW-2）"] },
] } as const;

const messages: [string, LineMessage][] = [
  ["文字加快速回覆", msg.text("請選擇", [{ label: "取消", data: "a=cancel" }, { label: "領養要多少錢？", text: "領養要多少錢？" }])],
  ["綁定成功", msg.bindOkCard(staff, shelter)],
  ["建檔確認", msg.intakeDraftCard(draft, "abcd1234", 2)],
  ["照護確認", msg.careDraftCard({ areas: [...care.areas], entries: care.entries.map((e) => ({ ...e, candidates: "candidates" in e ? [...e.candidates] : undefined })) }, new Map([["a", "小黑"]]), "abcd1234")],
  ["留意提醒", msg.careAlertCard("小黑", "食慾")],
  ["動物資料", msg.animalCard(animal, [])],
  ["今日摘要", msg.digestCard({ unreported: ["B 區"], flagged: [animal], vaccines: [], pendingApps: [], pendingConvs: [] }, "11/06")],
  ["今日摘要（無事）", msg.digestCard({ unreported: [], flagged: [], vaccines: [], pendingApps: [], pendingConvs: [] }, "11/06")],
  ["我的資料", msg.staffInfoCard(staff, shelter)],
  ["申請進度", msg.applicationCard(app)],
  ["健康提醒", msg.healthNoticeCard("建議諮詢獸醫。")],
  ["轉人工", msg.handoffCard(shelter.name)],
];

async function main() {
  let failed = 0;
  for (const [name, m] of messages) {
    const res = await fetch("https://api.line.me/v2/bot/message/validate/reply", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [m] }),
    });
    if (res.ok) console.log("✓", name);
    else { failed++; console.log("✗", name, res.status, await res.text()); }
  }
  console.log(failed ? `${failed} 個格式有問題` : "全部通過");
  process.exit(failed ? 1 : 0);
}

main();
