import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { addMonths } from "@/lib/care";
import { getDb } from "@/lib/db";
import { lifetimeCost } from "@/lib/lifetimeCost";
import { savePhoto } from "@/lib/media";
import { changeReminder, planChange } from "@/lib/lifeChange";
import { assessReadiness, costProfileOf } from "@/lib/readiness";
import { DEMO_UID } from "@/lib/repo";
import { taipeiDate } from "@/lib/time";
import type { AssessAnswers, AssessmentDoc, CareItem, ChangeAnswers, ChangeDoc, LessonProgress, MemorialDoc, OwnerDoc, PetDoc, RecordDoc, ReminderDoc } from "@/lib/types";

// 示範帳號的虛構資料：一位飼主、一份評估、一隻在世的貓（三張虛構單據、一份搬家的準備清單）、一隻已離開的狗（3D 紀念）。
// 用固定 ID，重複執行會覆蓋成最新日期。單據圖片是程式畫的，醫院和內容都是虛構的。

const day = (offset: number) => taipeiDate(new Date(Date.now() + offset * 864e5));
const iso = (offset: number) => new Date(Date.now() + offset * 864e5).toISOString();

type Receipt = { id: string; date: number; follow?: number; items: [string, string][]; meds: [string, string][]; total: number; terms: [string, string][] };

const RECEIPTS: Receipt[] = [
  {
    id: "demo-rec-1", date: -128, items: [["理學檢查", ""], ["貓三合一疫苗", "第 1 劑"], ["血液檢查 CBC、生化", ""]], meds: [], total: 3850,
    terms: [["CBC", "全血球計數，看紅血球、白血球和血小板的數量。"], ["生化", "血液生化檢查，用來了解肝、腎等器官的指數。"]],
  },
  {
    id: "demo-rec-2", date: -41, items: [["耳道檢查", "雙側"], ["耳道清潔", ""], ["診斷：外耳炎", ""]], meds: [["耳滴劑", "一天兩次，每次每耳 2 滴，共 7 天"]], total: 1200,
    terms: [["外耳炎", "外耳道發炎的統稱，原因很多，要由獸醫判斷。"], ["耳道清潔", "用清耳液清除耳垢和分泌物。"]],
  },
  {
    id: "demo-rec-3", date: -9, follow: 5, items: [["耳道複診", ""], ["牙齒檢查", ""]], meds: [], total: 600,
    terms: [["複診", "回到醫院讓獸醫追蹤上次看診的狀況。"]],
  },
];

/** 把虛構單據畫成一張像收據的圖片。 */
async function receiptImage(r: Receipt) {
  const lines = [
    ...r.items.map(([a, b]) => `${a}${b ? `（${b}）` : ""}`),
    ...r.meds.map(([a, b]) => `藥品：${a}　${b}`),
    ...(r.follow !== undefined ? [`回診日期：${day(r.follow).replaceAll("-", "/")}`] : []),
  ];
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="${560 + lines.length * 52}">
  <rect width="100%" height="100%" fill="#fbfaf6"/>
  <g font-family="Microsoft JhengHei, Noto Sans TC, PingFang TC, sans-serif" fill="#222">
    <text x="60" y="90" font-size="40" font-weight="700">示範動物醫院（虛構）</text>
    <text x="60" y="140" font-size="26" fill="#555">診療明細　　飼主：示範飼主　　病患：麻糬（貓）</text>
    <text x="60" y="190" font-size="26" fill="#555">看診日期：${day(r.date).replaceAll("-", "/")}</text>
    <line x1="60" y1="220" x2="840" y2="220" stroke="#999" stroke-width="2"/>
    ${lines.map((l, i) => `<text x="60" y="${280 + i * 52}" font-size="30">${esc(l)}</text>`).join("")}
    <line x1="60" y1="${300 + lines.length * 52}" x2="840" y2="${300 + lines.length * 52}" stroke="#999" stroke-width="2"/>
    <text x="60" y="${360 + lines.length * 52}" font-size="34" font-weight="700">合計　NT$ ${r.total.toLocaleString()}</text>
    <text x="60" y="${430 + lines.length * 52}" font-size="22" fill="#888">此單據為「從此有你」示範用的虛構資料</text>
  </g></svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toBuffer();
}

export async function seedDemo() {
  const db = getDb();
  const uid = DEMO_UID;
  const owner: OwnerDoc = { uid, displayName: "示範飼主", createdAt: iso(-400), state: { mode: "none" } };
  await db.set(`owners/${uid}`, owner);

  const afuPhoto = await savePhoto(uid, readFileSync(join(/*turbopackIgnore: true*/ process.cwd(), "demo", "assets", "afu.jpg")));
  const pets: PetDoc[] = [
    { id: "demo-mochi", name: "麻糬", kind: "貓", sex: "母", birth: "2019-04", neutered: true, chipped: true, status: "在世", createdAt: iso(-400) },
    { id: "demo-afu", name: "阿福", kind: "狗", size: "大型", sex: "公", birth: "2012-06", photo: afuPhoto, status: "已離開", passedAt: iso(-60), createdAt: iso(-399) },
  ];
  for (const p of pets) await db.set(`owners/${uid}/pets/${p.id}`, p);

  for (const r of RECEIPTS) {
    const photo = await savePhoto(uid, await receiptImage(r));
    const doc: RecordDoc = {
      id: r.id, petId: "demo-mochi", photo, createdAt: iso(r.date), isMedicalDoc: true,
      visitDate: day(r.date), clinic: "示範動物醫院（虛構）", followUp: r.follow !== undefined ? day(r.follow) : "",
      items: r.items.map(([name, note]) => ({ name, note })), meds: r.meds.map(([name, usage]) => ({ name, usage })),
      total: r.total, terms: r.terms.map(([term, plain]) => ({ term, plain })),
    };
    await db.set(`owners/${uid}/records/${r.id}`, doc);
    if (doc.followUp) {
      const rem: ReminderDoc = { id: r.id, uid, petId: "demo-mochi", petName: "麻糬", date: doc.followUp, text: `麻糬明天要回診：${doc.clinic}。`, sent: false };
      await db.set(`reminders/${r.id}`, rem);
    }
  }

  // 照顧日曆：驅蟲快到了、疫苗還早、健檢已經超過幾天，三種狀態都看得到。
  const care: [string, CareItem["kind"], string, number, number][] = [
    ["demo-care-deworm", "驅蟲", "體內外寄生蟲預防", 1, -25],
    ["demo-care-vaccine", "疫苗", "疫苗補強", 12, -200],
    ["demo-care-check", "健康檢查", "健康檢查", 12, -370],
  ];
  for (const [id, kind, label, everyMonths, offset] of care) {
    const nextDue = addMonths(day(offset), everyMonths);
    const doc: CareItem = { id, uid, petId: "demo-mochi", petName: "麻糬", kind, label, everyMonths, lastDone: day(offset), nextDue, remindedFor: nextDue, createdAt: iso(-300) };
    await db.set(`care/${id}`, doc);
  }
  // 小學堂：已經上過兩課。麻糬已結紮、已登記，那兩課不會出現。
  const progress: LessonProgress[] = [{ id: "adult-weight", correct: false, at: iso(-40) }, { id: "adult-teeth", correct: true, at: iso(-10) }];
  for (const old of await db.list<LessonProgress>(`owners/${uid}/learn`)) await db.delete(`owners/${uid}/learn/${old.id}`);
  for (const p of progress) await db.set(`owners/${uid}/learn/${p.id}`, p);

  const answers: AssessAnswers = {
    kind: "還沒決定", alone: "8～10 小時", activity: "30 分鐘～1 小時", travel: "每月 1～2 次", budget: "2,000～4,000 元", fund: "1 萬元以內",
    housing: "租屋，還沒問房東", space: "公寓或大樓", family: [], otherPets: "沒有", changes: ["可能搬家"], experience: "養過貓或狗", backup: "朋友",
    ownerHealth: "應該可以", reason: "想了很久",
  };
  const result = assessReadiness(answers);
  const assessment: AssessmentDoc = {
    id: "demo-assess-1", at: iso(-420), answers, result,
    report: {
      summary: `你的準備度是「${result.verdict}」。最需要先處理的是房東還沒確認，以及白天不在家的時間比較長。`,
      strengths: ["你養過貓狗，知道日常照顧要花多少心力。", "已經有朋友可以在你出差時幫忙。"],
      prepare: ["先請房東同意，最好寫在租約上。", "每月固定存一筆醫療預備金，先存到 3 萬元。", "找房子時把「可以養寵物」列為必要條件。"],
      ifNotReady: ["房東同意後，準備度就會明顯提高。", "如果白天不在家的時間長，可以考慮比較能獨處的成貓。"],
    },
  };
  await db.set(`owners/${uid}/assessments/${assessment.id}`, assessment);
  void lifetimeCost(costProfileOf(result.fit));

  // 生活變動檢查：麻糬一個多月後要搬家，新房東還沒確認。
  const changeAnswers: ChangeAnswers = { petKind: "貓", change: "搬家", when: "一到三個月", date: day(40), detail: "還不確定", helper: "朋友", worry: "有點擔心", note: "新家離公司比較近，但還沒問房東能不能養貓。" };
  const change: ChangeDoc = {
    id: "demo-change-1", at: iso(-3), petId: "demo-mochi", petName: "麻糬", answers: changeAnswers, plan: planChange(changeAnswers),
    aiNote: "搬家是很多人和毛孩分開的時候，你提早想到麻糬，已經走在前面了。現在最重要的一件事，是在簽約前先問清楚新房東能不能養貓，最好寫進租約；只要這一步確認了，其他像更新晶片地址、找新家附近的動物醫院，都可以慢慢來。",
    remindOn: changeReminder(changeAnswers, "麻糬", day(0))?.on,
  };
  await db.set(`owners/${uid}/changes/${change.id}`, change);

  const memorial: MemorialDoc = {
    id: "demo-memorial-afu", uid, petId: "demo-afu", petName: "阿福", kind: "狗", heightCm: 65,
    photos: [afuPhoto], glb: "/models/afu-v2.glb", status: "完成",
    memories: "每天傍晚一定要去河堤散步，走到一半會停下來回頭確認我有沒有跟上。最喜歡趴在陽台曬太陽，聽到塑膠袋的聲音就會衝過來。",
    tribute: "阿福是個很有原則的大個子。每天傍晚，河堤散步是牠一定要守住的約定，走到一半還會停下來回頭，確認你有沒有跟上。午後的陽台是牠的地盤，一趴就是一個下午；但只要廚房傳來塑膠袋的聲音，牠總是第一個衝過來。十四年的日子裡，你陪牠走過每一段河堤，也陪牠走完了最後一段路。謝謝你，讓牠這一生都有人等、有人陪。",
    tributeOk: true, createdAt: iso(-55), updatedAt: iso(-55),
  };
  await db.set(`memorials/${memorial.id}`, memorial);
}
