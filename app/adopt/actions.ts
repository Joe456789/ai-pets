"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { describeOpenAnimal, explainMatches } from "@/lib/ai/tasks";
import { getDb } from "@/lib/db";
import { getOpenAnimal } from "@/lib/opendata";
import { needsHousingCheck, rankAnimals, scoreAnimal, type MatchAnswers } from "@/lib/match";
import type { Persona } from "@/lib/ar";
import { getPersona } from "@/lib/persona";
import * as repo from "@/lib/repo";
import { createPledge, getSupply } from "@/lib/supplies";

// 公開表單沒有登入，用簡單的流量限制避免被灌資料或消耗 AI 額度。
const hits = new Map<string, number[]>();
async function allowed(bucket: string, limit: number) {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 3600_000);
  if (recent.length >= limit) return false;
  hits.set(key, [...recent, now]);
  return true;
}

const answersSchema = z.object({
  housing: z.enum(["公寓或大樓", "透天，有院子", "租屋，房東可養", "租屋，還不確定能不能養"]),
  time: z.enum(["1 小時以內", "1～3 小時", "3 小時以上"]),
  experience: z.enum(["第一次養", "養過貓或狗", "目前家裡就有"]),
  family: z.enum(["沒有", "有小孩", "有長輩", "都有"]),
  budget: z.enum(["2,000 元以內", "2,000～5,000 元", "5,000 元以上"]),
  preference: z.enum(["狗", "貓", "都可以"]),
});

export type MatchCard = {
  id: string; name: string; kind: string; photos: string[]; color?: string; bg?: string;
  score: number; why: string; check: string; shelterName: string;
  /** 有照片或去背圖才能「看牠在你家」，條件和介紹頁一樣。 */
  ar: boolean;
};
export type MatchResponse = { ok: true; cards: MatchCard[]; housingWarning: boolean; aiExplained: boolean } | { ok: false; error: string };

export async function matchAction(input: MatchAnswers): Promise<MatchResponse> {
  const parsed = answersSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "請回答完所有問題" };
  const x = parsed.data;
  const ranked = rankAnimals(await repo.listPublicAnimals(), x);

  // 先用規則組出說明，AI 無法使用時網站照常運作。
  const cards: MatchCard[] = ranked.map((r) => ({
    id: r.animal.id, name: r.animal.name, kind: r.animal.kind, photos: r.animal.photos, color: r.animal.color, bg: r.animal.bg,
    score: r.score, shelterName: r.animal.shelterName, ar: r.animal.photos.length > 0 || Boolean(r.animal.cutout),
    why: r.factors.slice(0, 2).join("，") || `${r.animal.name}的條件和你目前的生活相符`,
    check: r.animal.needs[0] ?? "記得和協會確認日常照顧的細節",
  }));

  let aiExplained = false;
  if (ranked.length && (await allowed("match-ai", 15))) {
    try {
      const items = await explainMatches("platform", x, ranked.map((r) => ({ id: r.animal.id, name: r.animal.name, traits: r.animal.traits, needs: r.animal.needs, score: r.score, factors: r.factors })));
      for (const item of items) {
        const card = cards.find((c) => c.id === item.id);
        if (card && item.why) { card.why = item.why; card.check = item.check || card.check; aiExplained = true; }
      }
    } catch (e) {
      console.warn("媒合說明改用規則文字：", (e as Error).message);
    }
  }
  return { ok: true, cards, housingWarning: needsHousingCheck(x), aiExplained };
}

const applySchema = answersSchema.omit({ preference: true }).extend({
  animalPublicId: z.string().min(1),
  who: z.string().trim().min(1, "請填寫怎麼稱呼你").max(30),
  phone: z.string().trim().regex(/^[0-9+\-() ]{8,20}$/, "請填寫正確的聯絡電話"),
  plan: z.string().trim().min(5, "請簡單說明遇到變化時的打算").max(500),
  message: z.string().trim().max(500),
  consent: z.literal("on", { error: "請先同意資料使用說明" }),
  website: z.string().max(0).optional(), // 給機器人填的隱藏欄位
});

export type ApplyResponse = { ok: true; code: string; shelterName: string; lineAddUrl?: string } | { ok: false; error: string };

export async function applyAction(_prev: ApplyResponse | null, form: FormData): Promise<ApplyResponse> {
  if (!(await allowed("apply", 5))) return { ok: false, error: "送出次數太多，請稍後再試。" };
  const parsed = applySchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "資料有誤" };
  const x = parsed.data;

  const animal = await repo.getPublicAnimal(x.animalPublicId);
  if (!animal) return { ok: false, error: "這隻動物目前無法申請。" };
  const shelter = await repo.getShelter(animal.sid);
  if (!shelter) return { ok: false, error: "這隻動物目前無法申請。" };

  // 只用規則計分，申請人的姓名和電話不會送給 AI。
  const { score, factors } = scoreAnimal(animal, { ...x, preference: "都可以" });
  const doc = await repo.createApplication(animal.sid, {
    animalId: animal.animalId, animalName: animal.name, who: x.who, phone: x.phone, housing: x.housing, family: x.family, plan: x.plan, message: x.message,
    score, reason: factors.join("；") || "沒有特別需要注意的條件。",
    answers: { 陪伴時間: x.time, 飼養經驗: x.experience, 家庭成員: x.family, 照顧預算: x.budget },
  });
  return { ok: true, code: doc.publicCode, shelterName: shelter.name, lineAddUrl: shelter.lineAddUrl };
}

/** AR 試放頁的自我介紹。結果有快取，同一隻動物每次發布只會呼叫一次 AI。 */
export async function personaAction(pid: string): Promise<Persona | null> {
  if (!/^[a-z0-9-]+__[\w-]+$/.test(pid)) return null;
  return getPersona(pid);
}

/* 物資捐贈登記 */
const pledgeSchema = z.object({
  sid: z.string().regex(/^[a-z0-9-]{3,30}$/),
  supplyId: z.string().uuid(),
  qty: z.coerce.number().int().min(1, "數量至少 1").max(999),
  who: z.string().trim().min(1, "請填寫怎麼稱呼你").max(30),
  contact: z.string().trim().min(4, "請留下聯絡方式").max(60),
  note: z.string().trim().max(100),
  consent: z.literal("on", { error: "請先同意資料使用說明" }),
  website: z.string().max(0).optional(),
});

export type PledgeResponse = { ok: true } | { ok: false; error: string };

export async function pledgeAction(_prev: PledgeResponse | null, form: FormData): Promise<PledgeResponse> {
  if (!(await allowed("pledge", 8))) return { ok: false, error: "送出次數太多，請稍後再試。" };
  const parsed = pledgeSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "資料有誤" };
  const x = parsed.data;
  const shelter = await repo.getShelter(x.sid);
  if (!shelter || shelter.status === "已停用") return { ok: false, error: "這個協會目前無法登記捐贈。" };
  const supply = await getSupply(x.sid, x.supplyId);
  if (!supply || supply.status !== "需要") return { ok: false, error: "這項物資目前已經足夠，謝謝你的心意。" };
  await createPledge(x.sid, { supplyId: supply.id, supplyName: supply.name, unit: supply.unit, qty: x.qty, who: x.who, contact: x.contact, note: x.note });
  revalidatePath("/adopt", "layout");
  revalidatePath("/shelter", "layout");
  return { ok: true };
}

/* 公立收容所開放資料 */
export type OpenIntro = { intro: string; think: string; ai: boolean };

/**
 * 公立收容所動物的 AI 介紹。依資料更新日期快取，同一隻動物資料沒變就不會重複呼叫 AI。
 * AI 無法使用時改用欄位組成的固定句子。
 */
export async function openIntroAction(id: string): Promise<OpenIntro | null> {
  const a = await getOpenAnimal(id);
  if (!a) return null;
  const db = getDb();
  const cached = await db.get<OpenIntro & { updated: string }>(`openAnimals/${a.id}`);
  if (cached && cached.updated === a.updated) return { intro: cached.intro, think: cached.think, ai: cached.ai };
  const plain: OpenIntro = {
    intro: `${a.shelter}的${[a.colour, a.size !== "未知" && a.size, a.variety || a.kind].filter(Boolean).join("")}，${[a.sex !== "未知" && a.sex, a.age !== "未知" && a.age, a.sterilized !== "未知" && a.sterilized].filter(Boolean).join("、")}。`,
    think: "個性和適合的生活方式，請到收容所和牠互動，或詢問收容所人員。",
    ai: false,
  };
  if (!(await allowed("open-ai", 40))) return plain;
  try {
    const r = await describeOpenAnimal("platform", { kind: a.kind, variety: a.variety, sex: a.sex, size: a.size, age: a.age, colour: a.colour, sterilized: a.sterilized, shelter: a.shelter });
    const doc = { intro: r.intro, think: r.think, ai: true, updated: a.updated, at: new Date().toISOString() };
    await db.set(`openAnimals/${a.id}`, doc);
    return { intro: doc.intro, think: doc.think, ai: true };
  } catch {
    return plain;
  }
}
