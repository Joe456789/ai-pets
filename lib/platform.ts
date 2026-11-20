import { randomBytes, randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { nowIso } from "@/lib/time";
import type { ManagerDoc, ShelterDoc } from "@/lib/types";

// 平台層級的資料：平台管理者、操作紀錄、AI 紀錄、錯誤、公告、收費。
const db = () => getDb();
const clip = (s: string, n = 200) => (s.length > n ? `${s.slice(0, n)}…` : s);

export type AdminDoc = { email: string; name: string; passwordHash: string };
export type AuditDoc = { id: string; at: string; actor: string; sid: string; action: string };
export type AiLogState = "正常" | "已攔截" | "已轉人工" | "已抽查";
export type AiLogDoc = { id: string; at: string; sid: string; kind: string; input: string; output: string; state: AiLogState };
export type ErrorDoc = { id: string; at: string; sid: string; where: string; message: string };
export type AnnouncementDoc = { id: string; at: string; text: string };
export type InvoiceDoc = { id: string; at: string; sid: string; shelterName: string; period: string; plan: string; amount: number; state: "待收款" | "已收款" };

/* 平台管理者 */
export const getAdmin = (email: string) => db().get<AdminDoc>(`admins/${email.toLowerCase()}`);
export const setAdmin = (doc: AdminDoc) => db().set(`admins/${doc.email.toLowerCase()}`, { ...doc, email: doc.email.toLowerCase() });

/** 臨時密碼只顯示一次，資料庫只存雜湊。 */
export const tempPassword = () => randomBytes(9).toString("base64url");

/* 協會開通 */
export const SHELTER_ID_RE = /^[a-z0-9-]{3,30}$/;
export const DEFAULT_FAQ = [
  { q: "領養要多少錢？", a: "請直接詢問協會人員，會依每隻動物的狀況說明。" },
  { q: "領養流程是什麼？", a: "線上申請、協會審核、預約面談與互動，通過後簽署領養切結書，再帶牠回家。" },
];

export async function createShelterWithManager(input: {
  id: string; name: string; area: string; codePrefix: string; plan: ShelterDoc["plan"]; due: string; managerEmail: string; managerName: string;
}) {
  const id = input.id.trim().toLowerCase();
  const email = input.managerEmail.trim().toLowerCase();
  if (!SHELTER_ID_RE.test(id)) throw new Error("協會代號只能用 3 到 30 個小寫英文、數字或減號");
  if (await db().get(`shelters/${id}`)) throw new Error("這個協會代號已經有人使用");
  if (await db().get(`managers/${email}`)) throw new Error("這個電子郵件已經是其他協會的管理者");
  const shelter: ShelterDoc = {
    id, name: input.name.trim(), area: input.area.trim(), intro: "", hours: "", phone: "", codePrefix: input.codePrefix.trim().toUpperCase().slice(0, 4) || "LL",
    areas: [], faq: DEFAULT_FAQ, plan: input.plan, due: input.due, status: input.plan === "試用" ? "試用中" : "使用中", createdAt: nowIso(),
  };
  await db().set(`shelters/${id}`, shelter);
  await db().set(`shelters/${id}/counters/animal`, { n: 0 });
  const password = tempPassword();
  const manager: ManagerDoc = { email, name: input.managerName.trim() || "管理者", sid: id, passwordHash: hashPassword(password) };
  await db().set(`managers/${email}`, manager);
  return { shelter, password };
}

export const listManagersOf = (sid: string) => db().list<ManagerDoc>("managers", [["sid", sid]]);

export async function resetManagerPassword(email: string) {
  const password = tempPassword();
  await db().update(`managers/${email.toLowerCase()}`, { passwordHash: hashPassword(password) });
  return password;
}
export const setManagerPassword = (email: string, password: string) => db().update(`managers/${email.toLowerCase()}`, { passwordHash: hashPassword(password) });

/* 操作紀錄 */
export async function audit(actor: string, sid: string, action: string) {
  const id = randomUUID();
  await db().set(`audit/${id}`, { id, at: nowIso(), actor, sid, action: clip(action, 120) } satisfies AuditDoc);
}
export const listAudit = (limit = 100) => db().listRecent<AuditDoc>("audit", "at", limit);

/* AI 回覆紀錄：只留前 200 字，給平台抽查用。 */
export async function logAi(sid: string, kind: string, input: string, output: string, state: AiLogState) {
  const id = randomUUID();
  await db().set(`aiLogs/${id}`, { id, at: nowIso(), sid, kind, input: clip(input), output: clip(output), state } satisfies AiLogDoc);
}
export const listAiLogs = (limit = 100) => db().listRecent<AiLogDoc>("aiLogs", "at", limit);
export const markAiLogReviewed = (id: string) => db().update(`aiLogs/${id}`, { state: "已抽查" });

/* 系統錯誤 */
export async function logError(sid: string, where: string, message: string) {
  const id = randomUUID();
  await db().set(`errors/${id}`, { id, at: nowIso(), sid, where, message: clip(message, 300) } satisfies ErrorDoc);
}
export const listErrors = (limit = 20) => db().listRecent<ErrorDoc>("errors", "at", limit);

/* 公告 */
export const listAnnouncements = (limit = 20) => db().listRecent<AnnouncementDoc>("announcements", "at", limit);
export async function createAnnouncement(text: string) {
  const id = randomUUID();
  await db().set(`announcements/${id}`, { id, at: nowIso(), text: clip(text.trim(), 500) } satisfies AnnouncementDoc);
}
export const deleteAnnouncement = (id: string) => db().delete(`announcements/${id}`);

/* 收費紀錄：先人工記錄，不串金流。 */
export const listInvoices = (limit = 200) => db().listRecent<InvoiceDoc>("invoices", "at", limit);
export async function createInvoice(input: Omit<InvoiceDoc, "id" | "at">) {
  const id = randomUUID();
  await db().set(`invoices/${id}`, { ...input, id, at: nowIso() } satisfies InvoiceDoc);
}
export const markInvoicePaid = (id: string) => db().update(`invoices/${id}`, { state: "已收款" });
