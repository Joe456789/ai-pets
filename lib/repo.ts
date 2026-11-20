import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { daysUntil, nowIso, taipeiDate } from "@/lib/time";
import type {
  AnimalDoc, ApplicationDoc, ApplicationStatus, CareDoc, CareDraft, ChatMessage, ConversationDoc, ConversationStatus, ConversationTag,
  IntakeDraft, LineCreds, LineUserDoc, ManagerDoc, PublicAnimal, ShelterDoc, StaffDoc,
} from "@/lib/types";

const db = () => getDb();

// 不含容易看錯的 0、O、1、I，產生後不好猜也不易抄錯。
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
function randomCode(len: number) {
  const bytes = randomBytes(len);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}
// 工作號是 1 個英文字母加 8 位數字，不會和電話號碼混淆。靠「猜錯暫停」和「未綁定 7 天失效」降低被猜中的風險。
export const STAFF_CODE_RE = /^[A-HJ-NP-Z]\d{8}$/;
export const STAFF_CODE_TTL_MS = 7 * 864e5;
export const APP_CODE_RE = /^LL-[2-9A-Z]{6}$/;

/* 協會 */
export const getShelter = (sid: string) => db().get<ShelterDoc>(`shelters/${sid}`);
export const listShelters = () => db().list<ShelterDoc>("shelters");
export const updateShelter = (sid: string, patch: Partial<ShelterDoc>) => db().update(`shelters/${sid}`, patch);
export const getLineCreds = (sid: string) => db().get<LineCreds>(`shelters/${sid}/private/line`);
export const setLineCreds = (sid: string, creds: LineCreds) => db().set(`shelters/${sid}/private/line`, creds);

/* 管理者 */
export const getManager = (email: string) => db().get<ManagerDoc>(`managers/${email.toLowerCase()}`);

/* 人員與工作號 */
export const listStaff = (sid: string) => db().list<StaffDoc>(`shelters/${sid}/staff`);
export const getStaff = (sid: string, code: string) => db().get<StaffDoc>(`shelters/${sid}/staff/${code}`);

export async function createStaff(sid: string, input: Pick<StaffDoc, "name" | "role" | "area">) {
  let code = "";
  do { code = "ABCDEFGHJKLMNPQRSTUVWXYZ"[randomInt(24)] + String(randomInt(10000000, 100000000)); } while (await getStaff(sid, code));
  const doc: StaffDoc = { ...input, code, disabled: false, createdAt: nowIso() };
  await db().set(`shelters/${sid}/staff/${code}`, doc);
  return doc;
}

export const updateStaff = (sid: string, code: string, patch: Partial<StaffDoc>) => db().update(`shelters/${sid}/staff/${code}`, patch);

/* LINE 使用者狀態 */
export async function getLineUser(sid: string, id: string): Promise<LineUserDoc> {
  return (await db().get<LineUserDoc>(`shelters/${sid}/lineUsers/${id}`)) ?? { id, state: { mode: "none" } };
}
export const saveLineUser = (sid: string, user: LineUserDoc) => db().set(`shelters/${sid}/lineUsers/${user.id}`, user);
export const markEventOnce = (sid: string, eventId: string) => db().create(`shelters/${sid}/lineEvents/${eventId}`, { at: nowIso() });

/* 動物 */
export const listAnimals = (sid: string) => db().list<AnimalDoc>(`shelters/${sid}/animals`);
export const getAnimal = (sid: string, id: string) => db().get<AnimalDoc>(`shelters/${sid}/animals/${id}`);
export const updateAnimal = (sid: string, id: string, patch: Partial<AnimalDoc>) => db().update(`shelters/${sid}/animals/${id}`, patch);

export async function findAnimals(sid: string, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const all = await listAnimals(sid);
  const exact = all.filter((a) => a.name.toLowerCase() === q || a.code.toLowerCase() === q);
  return exact.length ? exact : all.filter((a) => a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q));
}

export async function createAnimalFromDraft(sid: string, draft: IntakeDraft, photos: string[], area: string) {
  const shelter = await getShelter(sid);
  const n = await db().nextCounter(`shelters/${sid}/counters/animal`);
  const id = randomUUID();
  const animal: AnimalDoc = {
    id,
    code: `${shelter?.codePrefix ?? "LL"}-${String(n).padStart(4, "0")}`,
    name: draft.name.trim() || "待取名",
    kind: draft.kind === "未知" ? "其他" : draft.kind,
    sex: draft.sex,
    age: draft.age,
    ageGroup: draft.ageGroup,
    size: draft.size,
    coat: draft.coat,
    foundAt: draft.foundAt,
    area,
    neutered: draft.neutered,
    status: "在所照護",
    intakeAt: nowIso(),
    vaccineDue: "",
    traits: draft.traits,
    story: "",
    needs: [],
    goodFor: [],
    photos,
    tags: { energy: "未知", beginnerOk: "未知", kidOk: "未知", apartmentOk: "未知" },
    published: false,
  };
  await db().set(`shelters/${sid}/animals/${id}`, animal);
  return animal;
}

/* 公開資料：只有管理者發布的動物才會複製到這裡，照護紀錄不會公開。 */
export const publicId = (sid: string, animalId: string) => `${sid}__${animalId}`;
/** 停用中的協會不出現在公開頁。 */
export async function listPublicAnimals() {
  const [rows, shelters] = await Promise.all([db().list<PublicAnimal>("publicAnimals"), listShelters()]);
  const off = new Set(shelters.filter((s) => s.status === "已停用").map((s) => s.id));
  return rows.filter((r) => !off.has(r.sid));
}
export const listPublicAnimalsOf = (sid: string) => db().list<PublicAnimal>("publicAnimals", [["sid", sid]]);
export const getPublicAnimal = (pid: string) => db().get<PublicAnimal>(`publicAnimals/${pid}`);

export async function publishAnimal(sid: string, animalId: string, opts: { keepPublishedAt?: boolean } = {}) {
  const [a, s, prev] = await Promise.all([getAnimal(sid, animalId), getShelter(sid), getPublicAnimal(publicId(sid, animalId))]);
  if (!a || !s) throw new Error("找不到動物或協會");
  const m = a.motion;
  const doc: PublicAnimal = {
    id: publicId(sid, animalId), sid, animalId, shelterName: s.name, shelterArea: s.area,
    publishedAt: opts.keepPublishedAt && prev ? prev.publishedAt : nowIso(),
    cutout: a.cutout,
    model3d: a.model3d,
    motion: m?.approved && m.status === "完成" && m.idle ? { idle: m.idle, reactions: m.reactions } : undefined,
    name: a.name, kind: a.kind, sex: a.sex, age: a.age, ageGroup: a.ageGroup, size: a.size, coat: a.coat, neutered: a.neutered,
    traits: a.traits, story: a.story, needs: a.needs, goodFor: a.goodFor, photos: a.photos, color: a.color, bg: a.bg, tags: a.tags,
  };
  await db().set(`publicAnimals/${doc.id}`, doc);
  await updateAnimal(sid, animalId, { published: true, status: "開放領養" });
}

export async function unpublishAnimal(sid: string, animalId: string, status: AnimalDoc["status"] = "在所照護") {
  await db().delete(`publicAnimals/${publicId(sid, animalId)}`);
  await updateAnimal(sid, animalId, { published: false, status, ...(status === "已領養" ? { adoptedAt: nowIso() } : {}) });
}

/* 照護紀錄 */
export const listCare = (sid: string) => db().list<CareDoc>(`shelters/${sid}/care`);
export async function listCareOf(sid: string, animalId: string) {
  const rows = await db().list<CareDoc>(`shelters/${sid}/care`, [["animalId", animalId]]);
  return rows.sort((a, b) => b.at.localeCompare(a.at));
}

/** 是否連續 2 天以上有同一類需留意的回報（含今天）。用規則判斷，不交給 AI。 */
export function hasConsecutiveConcern(logs: CareDoc[], category: CareDoc["category"]) {
  const days = new Set(logs.filter((l) => l.concerning && l.category === category).map((l) => taipeiDate(l.at)));
  const today = taipeiDate();
  const yesterday = taipeiDate(new Date(Date.now() - 864e5));
  return days.has(today) && days.has(yesterday);
}

export async function saveCareDraft(sid: string, draft: CareDraft, who: string, staffCode: string) {
  const now = nowIso();
  const alerts: { animal: AnimalDoc; category: CareDoc["category"]; text: string }[] = [];
  for (const e of draft.entries) {
    if (!e.animalId) continue;
    const animal = await getAnimal(sid, e.animalId);
    if (!animal) continue;
    const doc: CareDoc = { id: randomUUID(), animalId: e.animalId, at: now, who, text: e.text, category: e.category, concerning: e.concerning };
    await db().set(`shelters/${sid}/care/${doc.id}`, doc);
    if (e.concerning) {
      await updateAnimal(sid, e.animalId, { flaggedUntil: new Date(Date.now() + 3 * 864e5).toISOString(), flagNote: e.text });
      const logs = await listCareOf(sid, e.animalId);
      if (hasConsecutiveConcern(logs, e.category)) alerts.push({ animal, category: e.category, text: e.text });
    }
  }
  for (const area of draft.areas) await reportArea(sid, area, who);
  await updateStaff(sid, staffCode, { lastReportAt: now });
  return alerts;
}

/* 區域回報 */
export const reportArea = (sid: string, area: string, who: string) =>
  db().set(`shelters/${sid}/areaReports/${taipeiDate()}__${area}`, { date: taipeiDate(), area, who, at: nowIso() });
export const listAreaReportsToday = (sid: string) =>
  db().list<{ date: string; area: string; who: string; at: string }>(`shelters/${sid}/areaReports`, [["date", taipeiDate()]]);

export const isFlagged = (a: AnimalDoc) => Boolean(a.flaggedUntil && a.flaggedUntil > nowIso());

/* 交班摘要 */
export const getHandover = (sid: string) => db().get<{ summary: string; at: string }>(`shelters/${sid}/handover/${taipeiDate()}`);
export const saveHandover = (sid: string, summary: string) => db().set(`shelters/${sid}/handover/${taipeiDate()}`, { summary, at: nowIso() });

/* 今日摘要：LINE 和後台共用，都是從資料算出來的。 */
export async function dailyDigest(sid: string) {
  const [shelter, animals, reports, apps, convs, care] = await Promise.all([
    getShelter(sid), listAnimals(sid), listAreaReportsToday(sid), listApplications(sid), listConversations(sid), listCare(sid),
  ]);
  const reported = new Set(reports.map((r) => r.area));
  const inCare = animals.filter((a) => a.status !== "已領養");
  const unreported = (shelter?.areas ?? []).filter((a) => !reported.has(a));
  // 今天有人回報了區域裡的某隻動物，但沒有確認全區：不算已回報，也不該顯示成沒人回報。
  const today = taipeiDate();
  const areaOf = new Map(animals.map((a) => [a.id, a.area]));
  const touched = new Set(care.filter((c) => taipeiDate(c.at) === today).map((c) => areaOf.get(c.animalId)));
  return {
    unreported: unreported.filter((a) => !touched.has(a)),
    partial: unreported.filter((a) => touched.has(a)),
    reported: [...reported],
    flagged: inCare.filter(isFlagged),
    vaccines: inCare.filter((a) => { const d = daysUntil(a.vaccineDue); return d !== null && d <= 14; }),
    pendingApps: apps.filter((a) => a.status === "待審核"),
    pendingConvs: convs.filter((c) => c.status === "待處理"),
  };
}

/* 領養申請 */
export async function listApplications(sid: string) {
  const rows = await db().list<ApplicationDoc>(`shelters/${sid}/applications`);
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function createApplication(sid: string, input: Omit<ApplicationDoc, "id" | "publicCode" | "status" | "createdAt">) {
  const doc: ApplicationDoc = { ...input, id: randomUUID(), publicCode: `LL-${randomCode(6)}`, status: "待審核", createdAt: nowIso() };
  await db().set(`shelters/${sid}/applications/${doc.id}`, doc);
  return doc;
}
export const getApplication = (sid: string, id: string) => db().get<ApplicationDoc>(`shelters/${sid}/applications/${id}`);
export const setApplicationStatus = (sid: string, id: string, status: ApplicationStatus) => db().update(`shelters/${sid}/applications/${id}`, { status });
export async function findApplicationByCode(sid: string, code: string) {
  const rows = await db().list<ApplicationDoc>(`shelters/${sid}/applications`, [["publicCode", code]]);
  return rows[0] ?? null;
}
export const linkApplicationLine = (sid: string, id: string, lineUserId: string) => db().update(`shelters/${sid}/applications/${id}`, { lineUserId });

/* 領養人對話 */
const MAX_MESSAGES = 60;
export async function listConversations(sid: string) {
  const rows = await db().list<ConversationDoc>(`shelters/${sid}/conversations`);
  return rows.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}
export const getConversation = (sid: string, id: string) => db().get<ConversationDoc>(`shelters/${sid}/conversations/${id}`);

export async function appendMessages(
  sid: string, id: string, messages: Omit<ChatMessage, "at">[],
  meta: { status?: ConversationStatus; tag?: ConversationTag; displayName?: string; lastAckAt?: string } = {},
) {
  const cur = await getConversation(sid, id);
  const at = nowIso();
  const doc: ConversationDoc = {
    id,
    displayName: meta.displayName ?? cur?.displayName ?? "領養人",
    tag: meta.tag ?? cur?.tag ?? "其他",
    status: meta.status ?? cur?.status ?? "AI 已回覆",
    lastAt: at,
    lastAckAt: meta.lastAckAt ?? cur?.lastAckAt,
    messages: [...(cur?.messages ?? []), ...messages.map((m) => ({ ...m, at }))].slice(-MAX_MESSAGES),
  };
  await db().set(`shelters/${sid}/conversations/${id}`, doc);
  return doc;
}
export const setConversationStatus = (sid: string, id: string, status: ConversationStatus) => db().update(`shelters/${sid}/conversations/${id}`, { status });
