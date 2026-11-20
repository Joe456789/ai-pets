"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { generateJson } from "@/lib/ai/gemini";
import { requireAdmin } from "@/lib/auth";
import { connectLine } from "@/lib/line/setup";
import * as platform from "@/lib/platform";
import { trialDue } from "@/lib/plans";
import { getShelter, updateShelter } from "@/lib/repo";
import type { ShelterDoc } from "@/lib/types";

export type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const fail = (e: unknown): Result<never> => ({ ok: false, error: (e as Error).message });

const newShelter = z.object({
  id: z.string().trim().regex(platform.SHELTER_ID_RE, "協會代號只能用 3 到 30 個小寫英文、數字或減號"),
  name: z.string().trim().min(2, "請填協會名稱").max(40),
  area: z.string().trim().max(20),
  codePrefix: z.string().trim().regex(/^[A-Za-z]{1,4}$/, "動物編號開頭請用 1 到 4 個英文字母"),
  plan: z.enum(["試用", "基本", "進階"]),
  due: z.string().regex(/^\d{4}\/\d{2}\/\d{2}$/, "請填到期日（試用方案可以不填，會自動設為 30 天後）"),
  managerEmail: z.email("請填正確的電子郵件"),
  managerName: z.string().trim().min(1, "請填管理者姓名").max(30),
});

/** 開通新協會，回傳管理者的臨時密碼（只顯示這一次）。 */
export async function createShelterAction(input: z.infer<typeof newShelter>): Promise<Result<{ id: string; password: string }>> {
  const admin = await requireAdmin();
  const due = input.due ? input.due.replaceAll("-", "/") : input.plan === "試用" ? trialDue() : "";
  const parsed = newShelter.safeParse({ ...input, due });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "資料有誤" };
  try {
    const { shelter, password } = await platform.createShelterWithManager(parsed.data);
    await platform.audit(`平台 ${admin.name}`, shelter.id, `開通協會「${shelter.name}」`);
    revalidatePath("/admin", "layout");
    return { ok: true, data: { id: shelter.id, password } };
  } catch (e) {
    return fail(e);
  }
}

export async function updateShelterAction(sid: string, form: FormData) {
  const admin = await requireAdmin();
  const s = await getShelter(sid);
  if (!s) return;
  const plan = String(form.get("plan")) as ShelterDoc["plan"];
  const status = String(form.get("status")) as ShelterDoc["status"];
  const due = String(form.get("due") ?? "").replaceAll("-", "/");
  const capRaw = String(form.get("aiCap") ?? "").trim();
  const cap = Number(capRaw);
  await updateShelter(sid, {
    plan: ["試用", "基本", "進階"].includes(plan) ? plan : s.plan,
    status: ["使用中", "試用中", "已停用"].includes(status) ? status : s.status,
    due: /^\d{4}\/\d{2}\/\d{2}$/.test(due) ? due : s.due,
    // 留空代表用方案預設值
    aiCap: capRaw && Number.isFinite(cap) && cap > 0 ? Math.round(cap) : null,
  });
  await platform.audit(`平台 ${admin.name}`, sid, `更新方案：${plan}、${status}、到期 ${due}`);
  revalidatePath("/admin", "layout");
}

export async function resetManagerPasswordAction(email: string): Promise<Result<string>> {
  const admin = await requireAdmin();
  try {
    const password = await platform.resetManagerPassword(email);
    await platform.audit(`平台 ${admin.name}`, "", `重設 ${email} 的密碼`);
    return { ok: true, data: password };
  } catch (e) {
    return fail(e);
  }
}

/** 在總後台貼上協會的 LINE 憑證，自動上傳選單並設定 webhook。 */
export async function connectLineAction(sid: string, channelSecret: string, channelAccessToken: string): Promise<Result<string>> {
  const admin = await requireAdmin();
  const appUrl = process.env.APP_URL;
  if (!appUrl) return { ok: false, error: "伺服器沒有設定 APP_URL" };
  if (!/^[0-9a-f]{32}$/i.test(channelSecret.trim())) return { ok: false, error: "Channel secret 應該是 32 個英數字" };
  if (channelAccessToken.trim().length < 100) return { ok: false, error: "Channel access token 看起來不完整" };
  try {
    const r = await connectLine(sid, { channelSecret: channelSecret.trim(), channelAccessToken: channelAccessToken.trim() }, appUrl);
    await platform.audit(`平台 ${admin.name}`, sid, `串接 LINE 官方帳號「${r.botName}」`);
    revalidatePath("/admin", "layout");
    return { ok: true, data: r.webhookOk ? `已串接「${r.botName}」，Webhook 測試成功。` : `已串接「${r.botName}」，但 Webhook 測試失敗（${r.reason}），請確認 LINE Developers 已開啟 Use webhook。` };
  } catch (e) {
    return fail(e);
  }
}

export async function createInvoiceAction(input: { sid: string; period: string; amount: number }): Promise<Result> {
  const admin = await requireAdmin();
  const s = await getShelter(input.sid);
  if (!s) return { ok: false, error: "找不到協會" };
  if (!Number.isFinite(input.amount) || input.amount < 0) return { ok: false, error: "金額有誤" };
  await platform.createInvoice({ sid: s.id, shelterName: s.name, period: input.period.trim().slice(0, 20), plan: s.plan, amount: Math.round(input.amount), state: "待收款" });
  await platform.audit(`平台 ${admin.name}`, s.id, `新增收費紀錄 ${input.period} NT$${input.amount}`);
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function markInvoicePaidAction(id: string): Promise<Result> {
  const admin = await requireAdmin();
  await platform.markInvoicePaid(id);
  await platform.audit(`平台 ${admin.name}`, "", "標記一筆收費為已收款");
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function markAiLogReviewedAction(id: string): Promise<Result> {
  await requireAdmin();
  await platform.markAiLogReviewed(id);
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function createAnnouncementAction(text: string): Promise<Result> {
  const admin = await requireAdmin();
  if (!text.trim()) return { ok: false, error: "請輸入公告內容" };
  await platform.createAnnouncement(text);
  await platform.audit(`平台 ${admin.name}`, "", "發布全平台公告");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteAnnouncementAction(id: string): Promise<Result> {
  await requireAdmin();
  await platform.deleteAnnouncement(id);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function testGeminiAction(): Promise<Result<string>> {
  await requireAdmin();
  const t = Date.now();
  try {
    const r = await generateJson({ scope: "platform", system: "只回傳 JSON。", parts: [{ text: "回傳 ok 為 true" }], schema: z.object({ ok: z.boolean() }) });
    return { ok: true, data: `Gemini 正常（${((Date.now() - t) / 1000).toFixed(1)} 秒，回傳 ${JSON.stringify(r)}）` };
  } catch (e) {
    return fail(e);
  }
}

/** 示範資料的日期會隨時間變舊，比賽評審前按一次就會更新到今天。 */
export async function refreshDemoAction(): Promise<Result<string>> {
  const admin = await requireAdmin();
  const { refreshDemoDates } = await import("@/demo/seed");
  const n = await refreshDemoDates();
  await platform.audit(`平台 ${admin.name}`, "nuanwo", "更新示範資料日期");
  revalidatePath("/", "layout");
  return { ok: true, data: `已更新 ${n} 隻示範動物和相關紀錄` };
}
