import { randomBytes, randomUUID } from "node:crypto";
import { addMonths, nextDueOf } from "@/lib/care";
import { getDb } from "@/lib/db";
import { nowIso, taipeiDate } from "@/lib/time";
import type {
  AssessmentDoc, CareItem, ChangeDoc, LessonProgress, LineCreds, MemorialDoc, MemorialStatus, OwnerDoc, OwnerState, PetDoc, RecordDoc, ReminderDoc,
} from "@/lib/types";

const db = () => getDb();

/** 示範帳號：評審不用 LINE 也能看完整流程，但不能修改資料。 */
export const DEMO_UID = "demo-owner";
export const isDemo = (uid: string) => uid === DEMO_UID;

/* 平台 LINE 憑證：放在私密路徑，不會顯示在任何頁面 */
export const getLineCreds = () => db().get<LineCreds>("private/line");
export const setLineCreds = (c: LineCreds) => db().set("private/line", c);

/** LINE 重送的事件 ID 相同，只處理一次。 */
export const markEventOnce = (eventId: string) => db().create(`lineEvents/${eventId}`, { at: nowIso() });

/* 飼主 */
export const getOwner = (uid: string) => db().get<OwnerDoc>(`owners/${uid}`);
export async function ensureOwner(uid: string, displayName: string) {
  const cur = await getOwner(uid);
  if (cur) {
    if (displayName && cur.displayName !== displayName) await db().update(`owners/${uid}`, { displayName });
    return { ...cur, displayName: displayName || cur.displayName };
  }
  const doc: OwnerDoc = { uid, displayName: displayName || "飼主", createdAt: nowIso(), state: { mode: "none" } };
  await db().set(`owners/${uid}`, doc);
  return doc;
}
export const setOwnerState = (uid: string, state: OwnerState) => db().update(`owners/${uid}`, { state });

/* 毛孩 */
export async function listPets(uid: string) {
  const rows = await db().list<PetDoc>(`owners/${uid}/pets`);
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
export const getPet = (uid: string, id: string) => db().get<PetDoc>(`owners/${uid}/pets/${id}`);
export async function savePet(uid: string, input: Omit<PetDoc, "id" | "createdAt" | "status"> & { id?: string; status?: PetDoc["status"] }) {
  const cur = input.id ? await getPet(uid, input.id) : null;
  const doc: PetDoc = {
    ...cur, ...input,
    id: cur?.id ?? randomUUID(),
    status: input.status ?? cur?.status ?? "在世",
    createdAt: cur?.createdAt ?? nowIso(),
  };
  await db().set(`owners/${uid}/pets/${doc.id}`, doc);
  return doc;
}

/* 飼養前評估 */
export async function listAssessments(uid: string) {
  const rows = await db().list<AssessmentDoc>(`owners/${uid}/assessments`);
  return rows.sort((a, b) => b.at.localeCompare(a.at));
}
export const getAssessment = (uid: string, id: string) => db().get<AssessmentDoc>(`owners/${uid}/assessments/${id}`);
export async function saveAssessment(uid: string, doc: Omit<AssessmentDoc, "id" | "at">) {
  const full: AssessmentDoc = { ...doc, id: randomUUID(), at: nowIso() };
  await db().set(`owners/${uid}/assessments/${full.id}`, full);
  return full;
}

/* 醫療紀錄 */
export async function listRecords(uid: string, petId: string) {
  const rows = await db().list<RecordDoc>(`owners/${uid}/records`, [["petId", petId]]);
  return rows.sort((a, b) => (b.visitDate || b.createdAt).localeCompare(a.visitDate || a.createdAt));
}
export const getRecord = (uid: string, id: string) => db().get<RecordDoc>(`owners/${uid}/records/${id}`);
export async function saveRecord(uid: string, petName: string, rec: Omit<RecordDoc, "id" | "createdAt">) {
  const doc: RecordDoc = { ...rec, id: randomUUID(), createdAt: nowIso() };
  await db().set(`owners/${uid}/records/${doc.id}`, doc);
  // 回診日在未來的話，前一天用 LINE 提醒。
  if (doc.followUp && doc.followUp > taipeiDate()) {
    const r: ReminderDoc = { id: doc.id, uid, petId: doc.petId, petName, date: doc.followUp, text: `${petName}明天（${doc.followUp.slice(5).replace("-", "/")}）要回診${doc.clinic ? `：${doc.clinic}` : ""}。`, sent: false };
    await db().set(`reminders/${r.id}`, r);
  }
  return doc;
}
export async function deleteRecord(uid: string, id: string) {
  await db().delete(`owners/${uid}/records/${id}`);
  await db().delete(`reminders/${id}`);
}

/** 明天要回診、還沒提醒過的。 */
export async function dueReminders(today = taipeiDate()) {
  const tomorrow = taipeiDate(new Date(new Date(`${today}T12:00:00+08:00`).getTime() + 864e5));
  return (await db().list<ReminderDoc>("reminders", [["date", tomorrow]])).filter((r) => !r.sent);
}
export const markReminderSent = (id: string) => db().update(`reminders/${id}`, { sent: true });

/* 生活變動檢查 */
export async function listChanges(uid: string) {
  const rows = await db().list<ChangeDoc>(`owners/${uid}/changes`);
  return rows.sort((a, b) => b.at.localeCompare(a.at));
}
export const getChange = (uid: string, id: string) => db().get<ChangeDoc>(`owners/${uid}/changes/${id}`);
export async function saveChange(uid: string, input: Omit<ChangeDoc, "id" | "at">) {
  const doc: ChangeDoc = { ...input, id: randomUUID(), at: nowIso() };
  await db().set(`owners/${uid}/changes/${doc.id}`, doc);
  return doc;
}
export const addReminder = (r: ReminderDoc) => db().set(`reminders/${r.id}`, r);

/* 照顧日曆 */
export async function listCare(uid: string) {
  const rows = await db().list<CareItem>("care", [["uid", uid]]);
  return rows.sort((a, b) => a.nextDue.localeCompare(b.nextDue) || a.createdAt.localeCompare(b.createdAt));
}
export const getCare = (id: string) => db().get<CareItem>(`care/${id}`);
export async function addCare(input: Omit<CareItem, "id" | "createdAt" | "nextDue" | "remindedFor">, today = taipeiDate()) {
  const nextDue = nextDueOf(input.lastDone, input.everyMonths, today);
  // 一加進來就已經到期的，不另外推播（畫面上會標「該做了」），免得一次收到好幾則。
  const doc: CareItem = { ...input, id: randomUUID(), nextDue, remindedFor: nextDue <= today ? nextDue : "", createdAt: nowIso() };
  await db().set(`care/${doc.id}`, doc);
  return doc;
}
/** 做完了：上次日期改成今天，算出下一次。 */
export async function completeCare(id: string, today = taipeiDate()) {
  const cur = await getCare(id);
  if (!cur) return null;
  const next: CareItem = { ...cur, lastDone: today, nextDue: addMonths(today, cur.everyMonths), remindedFor: "" };
  await db().set(`care/${id}`, next);
  return next;
}
export const deleteCare = (id: string) => db().delete(`care/${id}`);
export const saveCareName = (id: string, petName: string) => db().update(`care/${id}`, { petName });
/** 毛孩離開了，照顧提醒就不要再發。 */
export async function deleteCareForPet(uid: string, petId: string) {
  for (const c of await listCare(uid)) if (c.petId === petId) await deleteCare(c.id);
}
/** 今天或明天到期、還沒提醒過的。查兩天：排程漏跑一天也不會錯過。 */
export async function dueCare(today = taipeiDate()) {
  const tomorrow = taipeiDate(new Date(new Date(`${today}T12:00:00+08:00`).getTime() + 864e5));
  const rows = [...(await db().list<CareItem>("care", [["nextDue", today]])), ...(await db().list<CareItem>("care", [["nextDue", tomorrow]]))];
  return rows.filter((c) => c.remindedFor !== c.nextDue);
}
export const markCareReminded = (id: string, nextDue: string) => db().update(`care/${id}`, { remindedFor: nextDue });

/* 飼主小學堂 */
export const listProgress = (uid: string) => db().list<LessonProgress>(`owners/${uid}/learn`);
export const saveProgress = (uid: string, p: LessonProgress) => db().set(`owners/${uid}/learn/${p.id}`, p);
export const listOwners = () => db().list<OwnerDoc>("owners");
export const setLessonMonth = (uid: string, month: string) => db().update(`owners/${uid}`, { lessonMonth: month });
export const setLessonPushed = (uid: string, ids: string[], date: string) => db().update(`owners/${uid}`, { lessonPushed: ids, lessonPushedAt: date });

/* 紀念與告別 */
export const getMemorial = (id: string) => db().get<MemorialDoc>(`memorials/${id}`);
export const listMemorials = (uid: string) => db().list<MemorialDoc>("memorials", [["uid", uid]]);
export async function createMemorial(doc: Omit<MemorialDoc, "id" | "createdAt" | "updatedAt" | "status" | "tribute" | "tributeOk">) {
  const now = nowIso();
  const full: MemorialDoc = { ...doc, id: randomUUID(), status: "排隊中", tribute: "", tributeOk: false, createdAt: now, updatedAt: now };
  await db().set(`memorials/${full.id}`, full);
  return full;
}
export const updateMemorial = (id: string, patch: Partial<MemorialDoc>) => db().update(`memorials/${id}`, { ...patch, updatedAt: nowIso() });

export const deleteMemorial = (id: string) => db().delete(`memorials/${id}`);

/* 生前留下的 3D：跟紀念共用工作站和 3D 頁面，只是多一個 keepsake 標記 */
export const keepsakeOf = async (uid: string, petId: string) =>
  (await listMemorials(uid)).find((m) => m.keepsake && m.petId === petId) ?? null;

/** 牠離開後，把生前留下的 3D 直接轉成紀念（不用重做模型）。 */
export async function keepsakeToMemorial(uid: string, petId: string, memories: string) {
  const k = await keepsakeOf(uid, petId);
  if (!k) return null;
  await updateMemorial(k.id, { keepsake: false, memories });
  return { ...k, keepsake: false, memories };
}

/** 工作站領下一個任務。太久沒回報的「製作中」視為工作站中斷，重新排隊。 */
export async function claimNextMemorial(staleMs = 60 * 60 * 1000) {
  const all = await db().list<MemorialDoc>("memorials");
  const stale = (m: MemorialDoc) => m.status === "製作中" && Date.now() - new Date(m.updatedAt).getTime() >= staleMs;
  const next = all.filter((m) => m.status === "排隊中" || stale(m)).sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  if (!next) return null;
  await updateMemorial(next.id, { status: "製作中" as MemorialStatus, error: "" });
  return next;
}
/**
 * 刪除毛孩和跟牠有關的一切：醫療紀錄、回診和生活變動提醒、照顧日曆、生活變動清單、3D 紀念。
 * 回傳要另外刪掉的檔案（照片、單據、模型）網址。
 */
export async function deletePet(uid: string, petId: string): Promise<string[]> {
  const pet = await getPet(uid, petId);
  if (!pet) return [];
  const files: string[] = pet.photo ? [pet.photo] : [];
  for (const r of await listRecords(uid, petId)) {
    if (r.photo) files.push(r.photo);
    await deleteRecord(uid, r.id);
  }
  await deleteCareForPet(uid, petId);
  for (const c of await listChanges(uid)) {
    if (c.petId !== petId) continue;
    await db().delete(`owners/${uid}/changes/${c.id}`);
    await db().delete(`reminders/chg-${c.id}`);
  }
  for (const m of await listMemorials(uid)) {
    if (m.petId !== petId) continue;
    files.push(...m.photos);
    if (m.glb) files.push(m.glb);
    await db().delete(`memorials/${m.id}`);
  }
  await db().delete(`owners/${uid}/pets/${petId}`);
  return files;
}

export const newShareToken = () => randomBytes(12).toString("base64url");
