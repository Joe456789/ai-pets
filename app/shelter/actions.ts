"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AiUnavailableError } from "@/lib/ai/gemini";
import { writeHandover, writeListing, writeSupplyPost, writeWeeklyFocus, type ListingDraft } from "@/lib/ai/tasks";
import { shelterSuggestions } from "@/lib/insights";
import { verifyPassword } from "@/lib/password";
import { audit, setManagerPassword, tempPassword } from "@/lib/platform";
import { managerQuota, planOf, staffQuota } from "@/lib/plans";
import { hashPassword } from "@/lib/password";
import { getDb } from "@/lib/db";
import { generateMotion, saveCutout, setMotionApproved } from "@/lib/motion";
import { requireManager } from "@/lib/auth";
import { lineClient } from "@/lib/line/client";
import { applicationCard, text as lineText } from "@/lib/line/messages";
import * as repo from "@/lib/repo";
import { createSupply, deleteSupply, getSupply, publicSupplies, setPledgeStatus, updateSupply, type PledgeStatus } from "@/lib/supplies";
import { nowIso, taipeiDate } from "@/lib/time";
import type { AnimalDoc, ApplicationStatus, Faq, MatchTags } from "@/lib/types";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const aiError = (e: unknown) => (e instanceof AiUnavailableError ? e.message : `AI 暫時無法使用：${(e as Error).message}`);

/* 送養內容 */
export async function generateListingAction(animalId: string): Promise<ActionResult<ListingDraft>> {
  const { sid } = await requireManager();
  const animal = await repo.getAnimal(sid, animalId);
  if (!animal) return { ok: false, error: "找不到這隻動物" };
  try {
    const draft = await writeListing(sid, animal, await repo.listCareOf(sid, animalId));
    await repo.updateAnimal(sid, animalId, { draft: { web: draft.web, social: draft.social, at: nowIso() } });
    return { ok: true, data: draft };
  } catch (e) {
    return { ok: false, error: aiError(e) };
  }
}

const listingInput = z.object({
  name: z.string().trim().min(1, "請填寫名字").max(30),
  story: z.string().trim().min(10, "公開介紹至少要 10 個字").max(1000),
  social: z.string().trim().max(1000),
  traits: z.array(z.string().trim().min(1).max(12)).max(6),
  needs: z.array(z.string().trim().min(1).max(40)).max(6),
  goodFor: z.array(z.string().trim().min(1).max(40)).max(6),
  tags: z.object({
    energy: z.enum(["低", "中", "高", "未知"]),
    beginnerOk: z.enum(["是", "否", "未知"]),
    kidOk: z.enum(["是", "否", "未知"]),
    apartmentOk: z.enum(["是", "否", "未知"]),
  }),
});
export type ListingInput = z.infer<typeof listingInput> & { tags: MatchTags };

export async function publishListingAction(animalId: string, input: ListingInput): Promise<ActionResult> {
  const { sid, name } = await requireManager();
  const who = `管理者 ${name}`;
  const parsed = listingInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "資料有誤" };
  if (parsed.data.name === "待取名") return { ok: false, error: "公開前請先幫牠取名字" };
  if (!(await repo.getAnimal(sid, animalId))) return { ok: false, error: "找不到這隻動物" };
  await repo.updateAnimal(sid, animalId, parsed.data);
  await repo.publishAnimal(sid, animalId);
  await audit(who, sid, `發布「${parsed.data.name}」的送養介紹`);
  revalidatePath("/shelter", "layout");
  revalidatePath("/adopt", "layout");
  return { ok: true };
}

export async function saveListingAction(animalId: string, input: ListingInput): Promise<ActionResult> {
  const { sid } = await requireManager();
  const parsed = listingInput.partial({ story: true }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "資料有誤" };
  if (!(await repo.getAnimal(sid, animalId))) return { ok: false, error: "找不到這隻動物" };
  await repo.updateAnimal(sid, animalId, parsed.data as Partial<AnimalDoc>);
  revalidatePath("/shelter", "layout");
  return { ok: true };
}

export async function unpublishAction(animalId: string, status: "在所照護" | "已領養" = "在所照護"): Promise<ActionResult> {
  const { sid, name } = await requireManager();
  const animal = await repo.getAnimal(sid, animalId);
  if (!animal) return { ok: false, error: "找不到這隻動物" };
  await repo.unpublishAnimal(sid, animalId, status);
  await audit(`管理者 ${name}`, sid, status === "已領養" ? `標記「${animal.name}」已領養` : `下架「${animal.name}」`);
  revalidatePath("/shelter", "layout");
  revalidatePath("/adopt", "layout");
  return { ok: true };
}

/* 動物資料 */
export async function updateAnimalAction(animalId: string, form: FormData) {
  const { sid } = await requireManager();
  const animal = await repo.getAnimal(sid, animalId);
  if (!animal) return;
  const vaccineDue = String(form.get("vaccineDue") ?? "").trim().replaceAll("-", "/");
  await repo.updateAnimal(sid, animalId, {
    name: String(form.get("name") ?? animal.name).trim().slice(0, 30) || animal.name,
    area: String(form.get("area") ?? animal.area).trim().slice(0, 20),
    vaccineDue: /^\d{4}\/\d{2}\/\d{2}$/.test(vaccineDue) ? vaccineDue : "",
  });
  revalidatePath("/shelter", "layout");
}

/* 交班摘要 */
export async function generateHandoverAction(): Promise<ActionResult<string>> {
  const { sid } = await requireManager();
  try {
    const [digest, care, animals] = await Promise.all([repo.dailyDigest(sid), repo.listCare(sid), repo.listAnimals(sid)]);
    const names = new Map(animals.map((a) => [a.id, a.name]));
    const today = care.filter((c) => taipeiDate(c.at) === taipeiDate());
    const summary = await writeHandover(sid, {
      reported: digest.reported, partial: digest.partial, unreported: digest.unreported,
      logs: today.map((c) => ({ name: names.get(c.animalId) ?? "", text: c.text, who: c.who })),
    });
    await repo.saveHandover(sid, summary);
    revalidatePath("/shelter");
    return { ok: true, data: summary };
  } catch (e) {
    return { ok: false, error: aiError(e) };
  }
}

/* 領養申請 */
/**
 * 更新申請進度。申請人曾在 LINE 輸入申請編號、而且管理者勾選通知時，用 LINE 傳進度卡給申請人。
 * 只在管理者按下時傳一次，不會自動追蹤或重複發送。
 */
export async function setApplicationStatusAction(id: string, status: ApplicationStatus, notify = false): Promise<ActionResult<string>> {
  const { sid, name } = await requireManager();
  const app = await repo.getApplication(sid, id);
  if (!app) return { ok: false, error: "找不到這份申請" };
  await repo.setApplicationStatus(sid, id, status);
  await audit(`管理者 ${name}`, sid, `${app.who}領養${app.animalName}的申請改為「${status}」`);
  revalidatePath("/shelter", "layout");
  if (!notify || !app.lineUserId) return { ok: true, data: `已改為「${status}」` };
  const creds = await repo.getLineCreds(sid);
  if (!creds) return { ok: true, data: `已改為「${status}」，但協會的 LINE 還沒串接，沒有通知申請人。` };
  try {
    await lineClient(creds).push(app.lineUserId, [applicationCard({ ...app, status })]);
    return { ok: true, data: `已改為「${status}」，並用 LINE 通知${app.who}。` };
  } catch (e) {
    return { ok: true, data: `已改為「${status}」，但 LINE 通知失敗：${(e as Error).message}` };
  }
}

/** 已通過的申請在帶回家後按「完成領養」：動物下架並標記已領養。 */
export async function completeAdoptionAction(id: string): Promise<ActionResult<string>> {
  const { sid, name } = await requireManager();
  const app = await repo.getApplication(sid, id);
  if (!app) return { ok: false, error: "找不到這份申請" };
  if (app.status !== "已通過") return { ok: false, error: "申請通過後才能完成領養" };
  const animal = await repo.getAnimal(sid, app.animalId);
  if (!animal) return { ok: false, error: "找不到這隻動物" };
  if (animal.status === "已領養") return { ok: false, error: `${animal.name}已經標記為已領養` };
  await repo.unpublishAnimal(sid, app.animalId, "已領養");
  await audit(`管理者 ${name}`, sid, `${app.who}完成領養「${animal.name}」，已下架`);
  revalidatePath("/shelter", "layout");
  revalidatePath("/adopt", "layout");
  const others = (await repo.listApplications(sid)).filter((a) => a.animalId === app.animalId && a.id !== id && (a.status === "待審核" || a.status === "面談中"));
  return { ok: true, data: others.length ? `${animal.name}已下架。還有 ${others.length} 件${animal.name}的申請在處理中，記得通知他們。` : `${animal.name}已下架並標記已領養。` };
}

/* 領養人訊息 */
export async function sendMessageAction(conversationId: string, message: string): Promise<ActionResult> {
  const { sid, name } = await requireManager();
  const body = message.trim().slice(0, 2000);
  if (!body) return { ok: false, error: "請輸入內容" };
  const conv = await repo.getConversation(sid, conversationId);
  if (!conv) return { ok: false, error: "找不到這個對話" };
  const creds = await repo.getLineCreds(sid);
  if (!creds) return { ok: false, error: "協會的 LINE 官方帳號還沒串接，訊息無法送出。" };
  try {
    await lineClient(creds).push(conversationId, [lineText(`${body}\n\n— ${name}`)]);
  } catch (e) {
    return { ok: false, error: `LINE 傳送失敗：${(e as Error).message}` };
  }
  await repo.appendMessages(sid, conversationId, [{ from: "staff", text: body }], { status: "處理中" });
  await audit(`管理者 ${name}`, sid, `回覆領養人 ${conv.displayName}`);
  revalidatePath("/shelter", "layout");
  return { ok: true };
}

export async function closeConversationAction(conversationId: string): Promise<ActionResult> {
  const { sid } = await requireManager();
  await repo.setConversationStatus(sid, conversationId, "已結案");
  revalidatePath("/shelter", "layout");
  return { ok: true };
}

/* 人員與工作號 */
export async function addStaffAction(input: { name: string; role: "現場人員" | "志工"; area: string }): Promise<ActionResult<string>> {
  const { sid, name: manager } = await requireManager();
  const name = input.name.trim().slice(0, 30);
  if (!name) return { ok: false, error: "請輸入姓名" };
  const shelter = await repo.getShelter(sid);
  const quota = await staffQuota(shelter!);
  if (quota.full) return { ok: false, error: `目前的${shelter!.plan}方案最多 ${quota.limit} 個工作號，可以先停用不用的工作號，或請平台升級方案。` };
  const doc = await repo.createStaff(sid, { name, role: input.role === "志工" ? "志工" : "現場人員", area: input.area.trim().slice(0, 40) || "未指定" });
  await audit(`管理者 ${manager}`, sid, `新增人員「${name}」`);
  revalidatePath("/shelter/staff");
  return { ok: true, data: doc.code };
}

/** 停用工作號：立刻失去工作選單，之後要回復就請管理者重新產生一組。 */
export async function disableStaffAction(code: string): Promise<ActionResult> {
  const { sid, name } = await requireManager();
  const staff = await repo.getStaff(sid, code);
  if (!staff) return { ok: false, error: "找不到這組工作號" };
  await repo.updateStaff(sid, code, { disabled: true });
  await audit(`管理者 ${name}`, sid, `停用人員「${staff.name}」的工作號`);
  if (staff.lineUserId) {
    const creds = await repo.getLineCreds(sid);
    if (creds) await lineClient(creds).unlinkRichMenu(staff.lineUserId).catch(() => undefined);
  }
  revalidatePath("/shelter/staff");
  return { ok: true };
}

/* 協會設定 */
export async function saveShelterAction(form: FormData) {
  const { sid, name } = await requireManager();
  const clean = (k: string, max: number) => String(form.get(k) ?? "").trim().slice(0, max);
  const faq: Faq[] = clean("faq", 4000).split("\n").map((l) => l.split("｜")).filter((p) => p.length >= 2 && p[0].trim() && p[1].trim())
    .map(([q, ...a]) => ({ q: q.trim().slice(0, 40), a: a.join("｜").trim().slice(0, 500) })).slice(0, 12);
  const lineAddUrl = clean("lineAddUrl", 200);
  await repo.updateShelter(sid, {
    name: clean("name", 40), area: clean("area", 20), hours: clean("hours", 60), phone: clean("phone", 30), intro: clean("intro", 300),
    areas: clean("areas", 200).split(/[、,，]/).map((a) => a.trim()).filter(Boolean),
    lineAddUrl: /^https:\/\//.test(lineAddUrl) ? lineAddUrl : "",
    faq,
  });
  await audit(`管理者 ${name}`, sid, "更新協會設定");
  revalidatePath("/shelter", "layout");
}

/* 本週重點：建議由規則算出，AI 只整理成一段話 */
export async function weeklyFocusAction(): Promise<ActionResult<string>> {
  const { sid } = await requireManager();
  const items = await shelterSuggestions(sid);
  if (!items.length) return { ok: true, data: "目前沒有需要特別處理的事項。" };
  try {
    return { ok: true, data: await writeWeeklyFocus(sid, items.map((i) => ({ title: i.title, why: i.why }))) };
  } catch (e) {
    return { ok: false, error: aiError(e) };
  }
}

/* 管理者帳號（進階方案可以有 3 位） */
export async function addManagerAction(input: { email: string; name: string }): Promise<ActionResult<string>> {
  const { sid, name: me } = await requireManager();
  const shelter = (await repo.getShelter(sid))!;
  const quota = await managerQuota(shelter);
  if (quota.full) return { ok: false, error: planOf(shelter).managers > 1 ? `最多 ${quota.limit} 位管理者` : "新增管理者是進階方案的功能" };
  const email = input.email.trim().toLowerCase();
  if (!z.email().safeParse(email).success) return { ok: false, error: "請填正確的電子郵件" };
  if (await repo.getManager(email)) return { ok: false, error: "這個電子郵件已經是管理者" };
  const password = tempPassword();
  await getDb().set(`managers/${email}`, { email, name: input.name.trim().slice(0, 30) || "管理者", sid, passwordHash: hashPassword(password) });
  await audit(`管理者 ${me}`, sid, `新增管理者 ${email}`);
  revalidatePath("/shelter/settings");
  return { ok: true, data: password };
}

export async function removeManagerAction(email: string): Promise<ActionResult> {
  const { sid, email: self, name } = await requireManager();
  if (email.toLowerCase() === self) return { ok: false, error: "不能移除自己" };
  const target = await repo.getManager(email);
  if (!target || target.sid !== sid) return { ok: false, error: "找不到這位管理者" };
  await getDb().delete(`managers/${target.email}`);
  await audit(`管理者 ${name}`, sid, `移除管理者 ${target.email}`);
  revalidatePath("/shelter/settings");
  return { ok: true };
}

/* AR 試放：去背圖與 AI 動態影片 */
const b64 = (s: string, max: number) => {
  if (!/^[A-Za-z0-9+/=]+$/.test(s) || s.length > max) throw new Error("檔案格式不正確或太大");
  return Buffer.from(s, "base64");
};

export async function saveCutoutAction(animalId: string, pngBase64: string): Promise<ActionResult> {
  const { sid, name } = await requireManager();
  try {
    await saveCutout(sid, animalId, b64(pngBase64, 5_500_000));
    await audit(`管理者 ${name}`, sid, "儲存 AR 去背圖");
    revalidatePath("/shelter/content");
    revalidatePath("/adopt", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function generateMotionAction(animalId: string, greenJpegBase64: string): Promise<ActionResult> {
  const { sid, name } = await requireManager();
  try {
    const r = await generateMotion(sid, animalId, b64(greenJpegBase64, 3_000_000));
    await audit(`管理者 ${name}`, sid, `產生 AI 動態影片（${r.status}）`);
    revalidatePath("/shelter/content");
    return r.status === "完成" ? { ok: true } : { ok: false, error: r.error ?? "影片生成失敗" };
  } catch (e) {
    return { ok: false, error: aiError(e) };
  }
}

export async function setMotionApprovedAction(animalId: string, approved: boolean): Promise<ActionResult> {
  const { sid, name } = await requireManager();
  try {
    await setMotionApproved(sid, animalId, approved);
    await audit(`管理者 ${name}`, sid, approved ? "公開 AI 動態影片" : "取消公開 AI 動態影片");
    revalidatePath("/shelter/content");
    revalidatePath("/adopt", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/* 變更密碼 */
export async function changePasswordAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { sid, email, name } = await requireManager();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  const manager = await repo.getManager(email);
  if (!manager || !verifyPassword(current, manager.passwordHash)) return { ok: false, error: "目前的密碼不正確" };
  if (next.length < 10) return { ok: false, error: "新密碼至少要 10 個字元" };
  if (next !== String(form.get("confirm") ?? "")) return { ok: false, error: "兩次輸入的新密碼不一樣" };
  await setManagerPassword(email, next);
  await audit(`管理者 ${name}`, sid, "變更密碼");
  return { ok: true };
}

/* 物資需求 */
const supplyInput = z.object({
  name: z.string().trim().min(1, "請填寫品項").max(40),
  unit: z.string().trim().min(1, "請填寫單位").max(6),
  need: z.coerce.number().int().min(1, "數量至少 1").max(9999),
  note: z.string().trim().max(80),
  urgent: z.boolean(),
});

export async function addSupplyAction(input: z.input<typeof supplyInput>): Promise<ActionResult> {
  const { sid, name } = await requireManager();
  const parsed = supplyInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "資料有誤" };
  await createSupply(sid, parsed.data);
  await audit(`管理者 ${name}`, sid, `新增物資需求「${parsed.data.name}」`);
  revalidatePath("/shelter", "layout");
  revalidatePath("/adopt", "layout");
  return { ok: true };
}

export async function updateSupplyAction(id: string, patch: { status?: "需要" | "已足夠"; urgent?: boolean; need?: number; got?: number }): Promise<ActionResult> {
  const { sid } = await requireManager();
  const s = await getSupply(sid, id);
  if (!s) return { ok: false, error: "找不到這個品項" };
  const clean: Parameters<typeof updateSupply>[2] = {};
  if (patch.status) clean.status = patch.status;
  if (typeof patch.urgent === "boolean") clean.urgent = patch.urgent;
  if (patch.need !== undefined) clean.need = Math.max(1, Math.min(9999, Math.round(patch.need)));
  if (patch.got !== undefined) clean.got = Math.max(0, Math.min(9999, Math.round(patch.got)));
  await updateSupply(sid, id, clean);
  revalidatePath("/shelter", "layout");
  revalidatePath("/adopt", "layout");
  return { ok: true };
}

export async function deleteSupplyAction(id: string): Promise<ActionResult> {
  const { sid, name } = await requireManager();
  const s = await getSupply(sid, id);
  if (!s) return { ok: false, error: "找不到這個品項" };
  await deleteSupply(sid, id);
  await audit(`管理者 ${name}`, sid, `刪除物資需求「${s.name}」`);
  revalidatePath("/shelter", "layout");
  revalidatePath("/adopt", "layout");
  return { ok: true };
}

export async function setPledgeAction(id: string, status: PledgeStatus): Promise<ActionResult> {
  const { sid, name } = await requireManager();
  try {
    const p = await setPledgeStatus(sid, id, status);
    await audit(`管理者 ${name}`, sid, `${p.who}捐贈的${p.supplyName} ${p.qty}${p.unit}：${status}`);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  revalidatePath("/shelter", "layout");
  revalidatePath("/adopt", "layout");
  return { ok: true };
}

/** AI 依目前還缺的物資寫募集貼文。只送品項、數量和備註，不送捐贈人資料。 */
export async function supplyPostAction(): Promise<ActionResult<string>> {
  const { sid } = await requireManager();
  const [shelter, items] = await Promise.all([repo.getShelter(sid), publicSupplies(sid)]);
  if (!shelter) return { ok: false, error: "找不到協會資料" };
  if (items.length === 0) return { ok: false, error: "目前沒有需要的物資，先新增品項再請 AI 寫貼文。" };
  try {
    const post = await writeSupplyPost(sid, {
      shelterName: shelter.name, hours: shelter.hours,
      items: items.map((s) => ({ name: s.name, short: `還缺 ${Math.max(0, s.need - s.got)} ${s.unit}`, urgent: s.urgent, note: s.note })),
      link: `${process.env.APP_URL ?? ""}/adopt/supplies?s=${sid}`,
    });
    return { ok: true, data: post };
  } catch (e) {
    return { ok: false, error: aiError(e) };
  }
}
