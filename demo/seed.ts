import { hashPassword } from "@/lib/password";
import { animals as demoAnimals, applications as demoApps, conversations as demoConvs, shelters as demoShelters, staff as demoStaff } from "@/demo/data";
import { getDb } from "@/lib/db";
import { publicId, publishAnimal } from "@/lib/repo";
import { taipeiDate } from "@/lib/time";
import type { AnimalDoc, ApplicationDoc, ConversationDoc, MatchTags, ShelterDoc, StaffDoc } from "@/lib/types";

// 寫入虛構的示範資料。協會、人員、動物皆非真實。
const PREFIX: Record<string, string> = { nuanwo: "NW", shanqiu: "SQ", gangbian: "GB", daotian: "DT" };
const AREAS: Record<string, string[]> = { nuanwo: ["A 區", "B 區"], shanqiu: ["前院", "室內區"], gangbian: ["貓房"], daotian: ["前院"] };
const CODES: Record<string, string> = { "HP-7K3Q": "A27391568", "HP-2M9X": "K68412093", "HP-5T8R": "M15937426", "HP-9C4L": "T40278651" };

// 已經做好 3D 模型的示範動物（public/models）
const DEMO_MODELS: Record<string, string> = { afu: "/models/afu-v2.glb" };

const DEMO_TAGS: Record<string, MatchTags> = {
  afu: { energy: "中", beginnerOk: "是", kidOk: "未知", apartmentOk: "否" },
  douhua: { energy: "高", beginnerOk: "否", kidOk: "是", apartmentOk: "是" },
  atu: { energy: "低", beginnerOk: "是", kidOk: "是", apartmentOk: "是" },
  mochi: { energy: "低", beginnerOk: "是", kidOk: "未知", apartmentOk: "是" },
  juzi: { energy: "高", beginnerOk: "未知", kidOk: "未知", apartmentOk: "是" },
  zhima: { energy: "低", beginnerOk: "是", kidOk: "否", apartmentOk: "是" },
  naicha: { energy: "中", beginnerOk: "是", kidOk: "是", apartmentOk: "未知" },
  xiaohei: { energy: "中", beginnerOk: "否", kidOk: "否", apartmentOk: "未知" },
};

const FAQ = [
  { q: "領養要多少錢？", a: "領養不收費，但會請你負擔晶片登記和疫苗的實際費用。詳細金額可以在面談時向協會確認。" },
  { q: "怎麼預約參觀？", a: "請告訴我們想看哪一隻和方便的時間，協會人員會回覆你確認。" },
  { q: "領養流程是什麼？", a: "線上申請、協會審核、預約面談與互動、簽署領養切結書，最後帶牠回家。" },
];

const ago = (days: number) => new Date(Date.now() - days * 864e5).toISOString();

// 示範資料的日期都以「寫入當天」為準。data.ts 裡的疫苗到期日是以 2026/11/05 寫的，換算成距離今天的天數。
const DEMO_REF = Date.UTC(2026, 10, 5);
function shiftDue(due: string) {
  const t = Date.parse(`${due.replaceAll("/", "-")}T00:00:00Z`);
  if (Number.isNaN(t)) return due;
  return taipeiDate(new Date(Date.now() + (t - DEMO_REF))).replaceAll("-", "/");
}
const careOffset = (t: string) => (t.startsWith("今天") ? 0 : t.startsWith("昨天") ? 1 : 5);
function careAt(t: string, i: number) {
  const hm = t.match(/(\d{1,2}):(\d{2})/);
  const day = taipeiDate(new Date(Date.now() - careOffset(t) * 864e5));
  const at = hm ? Date.parse(`${day}T${hm[1].padStart(2, "0")}:${hm[2]}:00+08:00`) : NaN;
  const fallback = Date.now() - careOffset(t) * 864e5 - (i + 1) * 10 * 60_000;
  return new Date(Number.isNaN(at) || at > Date.now() ? fallback : at).toISOString();
}
const convAt = (i: number) => ago(i * 0.3 + 0.01);

export const DEMO_MANAGER_EMAIL = "demo@langlang.test";

export async function seedDemo(managerPassword: string) {
  const db = getDb();
  for (const s of demoShelters) {
    const doc: ShelterDoc = {
      id: s.id, name: s.name, area: s.area, intro: s.intro, hours: s.hours, phone: "", codePrefix: PREFIX[s.id] ?? "LL",
      areas: AREAS[s.id] ?? [], faq: FAQ, plan: s.plan, due: s.due, status: s.status,
    };
    await db.set(`shelters/${s.id}`, doc);
    await db.set(`shelters/${s.id}/counters/animal`, { n: 400 });
  }

  await db.set(`managers/${DEMO_MANAGER_EMAIL}`, { email: DEMO_MANAGER_EMAIL, name: "周怡君", sid: "nuanwo", passwordHash: hashPassword(managerPassword) });

  for (const st of demoStaff) {
    const code = CODES[st.code] ?? st.code;
    const doc: StaffDoc = { code, name: st.name, role: st.role as StaffDoc["role"], area: st.area, disabled: false };
    await db.set(`shelters/nuanwo/staff/${code}`, doc);
  }

  for (const a of demoAnimals) {
    const doc: AnimalDoc = {
      id: a.id, code: a.code, name: a.name, kind: a.kind, sex: a.sex, age: a.age, ageGroup: a.ageGroup, size: a.size, coat: a.coat, foundAt: "",
      area: a.area, neutered: a.neutered ? "是" : "否", status: a.status, intakeAt: ago(a.days), vaccineDue: shiftDue(a.vaccineDue), traits: a.traits, story: a.story,
      needs: a.needs, goodFor: a.goodFor, photos: [], color: a.color, bg: a.bg, tags: DEMO_TAGS[a.id] ?? { energy: "未知", beginnerOk: "未知", kidOk: "未知", apartmentOk: "未知" },
      published: false,
      ...(DEMO_MODELS[a.id] ? { model3d: DEMO_MODELS[a.id] } : {}),
    };
    await db.set(`shelters/${a.shelterId}/animals/${a.id}`, doc);
    if (a.status === "開放領養") await publishAnimal(a.shelterId, a.id);
    let i = 0;
    for (const c of a.care) {
      const id = `${a.id}-${i}`;
      await db.set(`shelters/${a.shelterId}/care/${id}`, {
        id, animalId: a.id, at: careAt(c.time, i++), who: c.who, text: c.text,
        category: /吃|餐/.test(c.text) ? "食慾" : /便/.test(c.text) ? "排便" : "其他", concerning: Boolean(c.flag),
      });
    }
    if (a.flagged) await db.update(`shelters/${a.shelterId}/animals/${a.id}`, { flaggedUntil: new Date(Date.now() + 3 * 864e5).toISOString(), flagNote: a.note });
  }

  for (const ap of demoApps) {
    const animal = demoAnimals.find((x) => x.id === ap.animalId);
    const doc: ApplicationDoc = {
      id: ap.id, publicCode: `LL-DEM22${demoApps.indexOf(ap) + 2}`, animalId: ap.animalId, animalName: animal?.name ?? "", who: ap.who, phone: "0900-000-000（虛構）",
      housing: ap.home, family: "—", plan: ap.exp, message: "", status: ap.status as ApplicationDoc["status"], createdAt: ago(demoApps.indexOf(ap) + 1), score: ap.match, reason: ap.reason,
    };
    await db.set(`shelters/nuanwo/applications/${ap.id}`, doc);
  }

  for (const c of demoConvs) {
    const doc: ConversationDoc = {
      id: c.id, displayName: c.who, tag: c.tag as ConversationDoc["tag"], status: c.status as ConversationDoc["status"], lastAt: convAt(demoConvs.indexOf(c)),
      messages: [{ at: convAt(demoConvs.indexOf(c)), from: "user", text: c.last }, { at: convAt(demoConvs.indexOf(c)), from: "ai", text: c.ai }],
    };
    await db.set(`shelters/nuanwo/conversations/${c.id}`, doc);
  }
  await seedHistory();
  await seedSupplies();
  await seedAreaReports();
}

// 有「今天」照護紀錄的區域，標成今天已回報，總覽的「現場回報狀況」才會和「需要留意」一致。
async function seedAreaReports() {
  const today = taipeiDate();
  for (const a of demoAnimals) {
    const c = a.care.find((x) => x.time.startsWith("今天"));
    if (!c || !a.area) continue;
    await getDb().set(`shelters/${a.shelterId}/areaReports/${today}__${a.area}`, { date: today, area: a.area, who: c.who, at: careAt(c.time, 0) });
  }
}

// 虛構的物資需求和捐贈登記。用固定 ID，已存在就只更新日期，不會覆蓋協會改過的數量。
const DEMO_SUPPLIES = [
  { sid: "nuanwo", id: "5d1f0c3e-1a2b-4c3d-8e4f-000000000001", name: "成犬乾糧", unit: "包", need: 20, got: 6, note: "15 公斤裝，未開封", urgent: true },
  { sid: "nuanwo", id: "5d1f0c3e-1a2b-4c3d-8e4f-000000000002", name: "尿布墊", unit: "包", need: 30, got: 12, note: "L 號以上", urgent: false },
  { sid: "nuanwo", id: "5d1f0c3e-1a2b-4c3d-8e4f-000000000003", name: "牽繩和項圈", unit: "組", need: 10, got: 3, note: "中大型犬用", urgent: false },
  { sid: "shanqiu", id: "5d1f0c3e-1a2b-4c3d-8e4f-000000000004", name: "老犬罐頭", unit: "箱", need: 8, got: 2, note: "", urgent: true },
  { sid: "gangbian", id: "5d1f0c3e-1a2b-4c3d-8e4f-000000000005", name: "貓砂", unit: "包", need: 25, got: 10, note: "豆腐砂或礦砂皆可", urgent: false },
];
const DEMO_PLEDGES = [
  { sid: "nuanwo", id: "5d1f0c3e-1a2b-4c3d-8e4f-0000000000a1", supply: 0, qty: 2, who: "林小姐（虛構）", contact: "line: demo-lin", note: "週六下午送過去", status: "待確認", days: 0.2 },
  { sid: "nuanwo", id: "5d1f0c3e-1a2b-4c3d-8e4f-0000000000a2", supply: 1, qty: 5, who: "王先生（虛構）", contact: "0900-000-000", note: "", status: "已收到", days: 3 },
];

export async function seedSupplies() {
  const db = getDb();
  for (const s of DEMO_SUPPLIES) {
    const path = `shelters/${s.sid}/supplies/${s.id}`;
    const at = ago(2);
    if (await db.get(path)) { await db.update(path, { updatedAt: at }); continue; }
    const { sid: _sid, ...doc } = s;
    await db.set(path, { ...doc, status: "需要", createdAt: ago(10), updatedAt: at });
  }
  for (const p of DEMO_PLEDGES) {
    const path = `shelters/${p.sid}/pledges/${p.id}`;
    const s = DEMO_SUPPLIES[p.supply];
    if (await db.get(path)) { await db.update(path, { createdAt: ago(p.days) }); continue; }
    await db.set(path, { id: p.id, supplyId: s.id, supplyName: s.name, unit: s.unit, qty: p.qty, who: p.who, contact: p.contact, note: p.note, status: p.status, createdAt: ago(p.days) });
  }
}

/**
 * 把示範資料的日期更新到今天：收容天數、疫苗到期日、照護回報、申請和訊息時間、歷史領養紀錄。
 * 不會動到照片、AI 動態影片、人員綁定、協會設定，以及示範以外新增的資料。比賽評審前執行一次即可。
 */
export async function refreshDemoDates() {
  const db = getDb();
  let n = 0;
  for (const a of demoAnimals) {
    const path = `shelters/${a.shelterId}/animals/${a.id}`;
    const cur = await db.get<AnimalDoc>(path);
    if (!cur) continue;
    const patch: Record<string, unknown> = { intakeAt: ago(a.days), vaccineDue: shiftDue(a.vaccineDue) };
    const model3d = DEMO_MODELS[a.id];
    if (model3d && cur.model3d !== model3d) {
      patch.model3d = model3d;
      const pub = `publicAnimals/${publicId(a.shelterId, a.id)}`;
      if (await db.get(pub)) await db.update(pub, { model3d });
    }
    if (a.flagged && cur.status !== "已領養") Object.assign(patch, { flaggedUntil: new Date(Date.now() + 3 * 864e5).toISOString(), flagNote: a.note });
    await db.update(path, patch);
    for (let i = 0; i < a.care.length; i++) {
      const cp = `shelters/${a.shelterId}/care/${a.id}-${i}`;
      if (await db.get(cp)) await db.update(cp, { at: careAt(a.care[i].time, i) });
    }
    n++;
  }
  for (const ap of demoApps) {
    const path = `shelters/nuanwo/applications/${ap.id}`;
    if (await db.get(path)) await db.update(path, { createdAt: ago(demoApps.indexOf(ap) + 1) });
  }
  for (const c of demoConvs) {
    const path = `shelters/nuanwo/conversations/${c.id}`;
    const cur = await db.get<ConversationDoc>(path);
    if (!cur) continue;
    const at = convAt(demoConvs.indexOf(c));
    // 只更新示範的兩則訊息，之後真的回覆過的訊息保留原本時間
    await db.update(path, { lastAt: cur.messages.length > 2 ? cur.lastAt : at, messages: cur.messages.map((m, i) => (i < 2 ? { ...m, at } : m)) });
  }
  await seedHistory();
  await seedSupplies();
  await seedAreaReports();
  return n;
}

// 過去幾個月的虛構領養紀錄、收費紀錄和公告，讓報表和總後台有內容可看。
// 用固定 ID，重複執行不會重複新增，也不會動到人員綁定和新建的動物。
const HISTORY_SURNAMES = ["陳先生", "林小姐", "黃先生", "張小姐", "吳先生", "劉小姐", "蔡先生"];
const HISTORY_NAMES = ["大寶", "小花", "黑糖", "布丁", "饅頭", "可樂", "花生", "湯圓", "米漿", "雪球", "皮蛋", "咖啡", "肉圓", "柚子"];

export async function seedHistory() {
  const db = getDb();
  const shelterIds = ["nuanwo", "shanqiu", "gangbian"];
  const now = Date.now();
  for (let i = 0; i < HISTORY_NAMES.length; i++) {
    const sid = shelterIds[i % shelterIds.length];
    const adoptedDaysAgo = 2 + i * 11;
    const stayed = 40 + ((i * 37) % 260);
    const id = `history-${i}`;
    const doc: AnimalDoc = {
      id, code: `${PREFIX[sid]}-0${100 + i}`, name: HISTORY_NAMES[i], kind: i % 3 === 2 ? "貓" : "狗", sex: i % 2 ? "母" : "公", age: "", ageGroup: "成年",
      size: "中型", coat: "", foundAt: "", area: "", neutered: "是", status: "已領養", intakeAt: new Date(now - (adoptedDaysAgo + stayed) * 864e5).toISOString(),
      adoptedAt: new Date(now - adoptedDaysAgo * 864e5).toISOString(), vaccineDue: "", traits: [], story: "", needs: [], goodFor: [], photos: [],
      tags: { energy: "未知", beginnerOk: "未知", kidOk: "未知", apartmentOk: "未知" }, published: false,
    };
    await db.set(`shelters/${sid}/animals/${id}`, doc);
    // 每筆過去的領養都配一份通過的申請，隔一筆再多一份沒通過的，報表的「每月領養申請」才不會是 0。
    const apps: { status: ApplicationDoc["status"]; before: number }[] = [{ status: "已通過", before: 12 }, ...(i % 2 ? [{ status: "未通過" as const, before: 20 }] : [])];
    for (const [k, ap] of apps.entries()) {
      const app: ApplicationDoc = {
        id: `history-app-${i}-${k}`, publicCode: `LL-HIST${"ABCDEFGHJKLMNPQRSTUVWXYZ"[i]}${k + 2}`, animalId: id, animalName: doc.name,
        who: `${HISTORY_SURNAMES[(i + k) % HISTORY_SURNAMES.length]}（虛構）`, phone: "0900-000-000（虛構）", housing: "公寓或大樓", family: "—", plan: "養過貓或狗", message: "",
        status: ap.status, createdAt: new Date(now - (adoptedDaysAgo + ap.before) * 864e5).toISOString(), score: ap.status === "已通過" ? 80 : 45, reason: "",
      };
      await db.set(`shelters/${sid}/applications/${app.id}`, app);
    }
  }
  const month =(offset: number) => { const d = new Date(now); d.setMonth(d.getMonth() - offset); return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}`; };
  const invoices = [
    { id: "demo-inv-1", sid: "shanqiu", shelterName: "山丘毛孩之家", period: month(1), plan: "進階", amount: 980, state: "已收款" },
    { id: "demo-inv-2", sid: "nuanwo", shelterName: "暖窩動物協會", period: month(1), plan: "基本", amount: 490, state: "已收款" },
    { id: "demo-inv-3", sid: "daotian", shelterName: "稻田狗狗中途", period: month(0), plan: "基本", amount: 490, state: "待收款" },
  ];
  for (const inv of invoices) await db.set(`invoices/${inv.id}`, { ...inv, at: new Date(now - 5 * 864e5).toISOString() });
  await db.set("announcements/demo-welcome", { id: "demo-welcome", at: new Date(now - 864e5).toISOString(), text: "歡迎使用浪浪夥伴！「AI 建議」頁新增本週重點整理，可以直接貼到協會群組。" });
}
