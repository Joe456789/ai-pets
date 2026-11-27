"use server";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { KEEPSAKE_MAX } from "@/lib/constants";
import { z } from "zod";
import { AiUnavailableError } from "@/lib/ai/gemini";
import { checkShapePhoto, extractRecord, writeAssessReport, writeChangeNote, writeTribute } from "@/lib/ai/tasks";
import { currentUid, DemoReadOnly, endSession, NotSignedIn, requireWriter } from "@/lib/auth";
import { lifetimeCost, type LifetimeCost } from "@/lib/lifetimeCost";
import { deleteFileByUrl, readFileByUrl, savePhoto } from "@/lib/media";
import { addMonths, CARE_KINDS } from "@/lib/care";
import { lessonById, quizOf } from "@/lib/lessons";
import { CHANGE_KINDS, changeReminder, DETAILS, HELPERS, planChange, WHEN, WORRIES } from "@/lib/lifeChange";
import { cleanTraits } from "@/lib/personality";
import { assessReadiness, costProfileOf } from "@/lib/readiness";
import { cleanDraft } from "@/lib/records";
import * as repo from "@/lib/repo";
import { nowIso, taipeiDate } from "@/lib/time";
import type { AssessAnswers, AssessReport, CareKind, ChangeKind, ChangePlan, PetDoc, ReadinessResult, RecordDraft } from "@/lib/types";

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

function fail(e: unknown): { ok: false; error: string } {
  if (e instanceof NotSignedIn || e instanceof DemoReadOnly || e instanceof AiUnavailableError) return { ok: false, error: e.message };
  console.error("動作失敗", (e as Error).message);
  return { ok: false, error: (e as Error).message || "系統暫時出了點問題，請再試一次。" };
}

/* 飼養前評估 */
const answersSchema = z.object({
  kind: z.enum(["狗", "貓", "還沒決定"]),
  alone: z.enum(["4 小時以內", "4～8 小時", "8～10 小時", "10 小時以上"]),
  activity: z.enum(["30 分鐘以內", "30 分鐘～1 小時", "1 小時以上"]),
  travel: z.enum(["很少", "每月 1～2 次", "經常"]),
  budget: z.enum(["2,000 元以內", "2,000～4,000 元", "4,000～6,000 元", "6,000 元以上"]),
  fund: z.enum(["沒有", "1 萬元以內", "1～3 萬元", "3 萬元以上"]),
  housing: z.enum(["自有住宅", "租屋，房東同意", "租屋，還沒問房東", "租屋，房東不同意", "住家裡，家人同意", "住家裡，家人還沒同意"]),
  space: z.enum(["套房", "公寓或大樓", "有院子"]),
  family: z.array(z.enum(["6 歲以下小孩", "長輩", "懷孕或備孕", "有人過敏"])).max(4),
  otherPets: z.enum(["沒有", "有狗", "有貓", "有鳥、兔子或鼠類"]),
  changes: z.array(z.enum(["可能搬家", "出國讀書或工作", "換工作或輪班", "結婚或同居"])).max(4),
  experience: z.enum(["第一次養", "養過貓或狗", "現在就有"]),
  backup: z.enum(["家人或室友", "朋友", "寵物保姆或住宿", "還沒想過"]),
  ownerHealth: z.enum(["應該可以", "不確定", "可能會有困難"]),
  reason: z.enum(["想有個陪伴", "家裡小孩想要", "想送給別人", "看到覺得很可愛", "想了很久"]),
  why: z.string().max(300).optional(),
}) satisfies z.ZodType<AssessAnswers>;

export type AssessResponse = { result: ReadinessResult; cost: LifetimeCost; report: AssessReport | null; aiError: string; savedId: string | null };

export async function assessAction(input: AssessAnswers): Promise<Result<AssessResponse>> {
  const parsed = answersSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "請回答完所有問題" };
  const answers = parsed.data;
  const result = assessReadiness(answers);
  const cost = lifetimeCost(costProfileOf(result.fit));
  const uid = await currentUid();
  // 分數和風險一定有；AI 報告失敗時照樣顯示規則結果。
  let report: AssessReport | null = null;
  let aiError = "";
  try {
    report = await writeAssessReport(uid && !repo.isDemo(uid) ? uid : "public", { answers, result, cost });
  } catch (e) {
    aiError = e instanceof AiUnavailableError ? e.message : "AI 報告暫時無法產生，下面是規則算出的結果。";
  }
  let savedId: string | null = null;
  if (uid && !repo.isDemo(uid)) savedId = (await repo.saveAssessment(uid, { answers, result, report })).id;
  return { ok: true, data: { result, cost, report, aiError, savedId } };
}

/* 生活變動檢查：沒登入也能做；登入（非示範）會存起來，有填日期就在前幾天用 LINE 提醒。 */
const changeSchema = z.object({
  petId: z.string().max(64).optional(),
  petKind: z.enum(["狗", "貓"]),
  change: z.enum(CHANGE_KINDS as [ChangeKind, ...ChangeKind[]]),
  when: z.enum(WHEN),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  detail: z.string().max(40),
  helper: z.enum(HELPERS),
  worry: z.enum(WORRIES),
  note: z.string().max(300).optional(),
});

export type ChangeResponse = { plan: ChangePlan; aiNote: string | null; aiError: string; savedId: string | null; remindOn: string | null; petName: string };

export async function changeAction(input: z.input<typeof changeSchema>): Promise<Result<ChangeResponse>> {
  const parsed = changeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "請回答完所有問題" };
  const { petId, ...answers } = parsed.data;
  if (!DETAILS[answers.change].options.includes(answers.detail)) return { ok: false, error: "請回答完所有問題" };
  const today = taipeiDate();
  if (answers.when === "已經發生") delete answers.date;
  if (answers.date && (answers.date < today || answers.date > addMonths(today, 24))) return { ok: false, error: "日期請填今天到兩年內" };
  if (!answers.note?.trim()) delete answers.note;

  const uid = await currentUid();
  const writer = uid && !repo.isDemo(uid) ? uid : null;
  // 示範帳號也能做（看得到麻糬的名字），只是不存檔、不排提醒。
  const pet = uid && petId ? await repo.getPet(uid, petId) : null;
  if (petId && uid && (!pet || pet.status !== "在世")) return { ok: false, error: "找不到這隻毛孩" };
  if (pet) answers.petKind = pet.kind;
  const petName = pet?.name ?? "你的毛孩";

  const plan = planChange(answers);
  let aiNote: string | null = null;
  let aiError = "";
  try {
    aiNote = await writeChangeNote(writer ?? "public", { petName, answers, plan });
  } catch (e) {
    aiError = e instanceof AiUnavailableError ? e.message : "AI 說明暫時無法產生，下面是規則整理的準備清單。";
  }
  if (!writer) return { ok: true, data: { plan, aiNote, aiError, savedId: null, remindOn: null, petName } };

  const remind = pet ? changeReminder(answers, pet.name, today) : null;
  const doc = await repo.saveChange(writer, { petId: pet?.id ?? "", petName, answers, plan, aiNote, ...(remind ? { remindOn: remind.on } : {}) });
  if (remind && pet) {
    await repo.addReminder({ id: `chg-${doc.id}`, uid: writer, petId: pet.id, petName: pet.name, date: remind.date, text: remind.text, sent: false, kind: "生活變動", path: `/change/${doc.id}` });
  }
  revalidatePath("/me");
  return { ok: true, data: { plan, aiNote, aiError, savedId: doc.id, remindOn: remind?.on ?? null, petName } };
}

/* 毛孩 */
const MAX_PHOTO = 12 * 1024 * 1024;

async function photoFrom(uid: string, f: FormDataEntryValue | null) {
  if (!(f instanceof File) || f.size === 0) return null;
  if (f.size > MAX_PHOTO || !f.type.startsWith("image/")) throw new Error("照片太大或格式不支援");
  return savePhoto(uid, Buffer.from(await f.arrayBuffer()));
}

export async function savePetAction(form: FormData): Promise<Result<string>> {
  try {
    const uid = await requireWriter();
    const name = String(form.get("name") ?? "").trim().slice(0, 20);
    if (!name) return { ok: false, error: "請填名字" };
    const kind = form.get("kind") === "貓" ? "貓" : "狗";
    const size = (["小型", "中型", "大型"] as const).find((s) => s === form.get("size"));
    const sex = (["公", "母"] as const).find((s) => s === form.get("sex")) ?? "";
    const birth = /^\d{4}-\d{2}$/.test(String(form.get("birth") ?? "")) ? String(form.get("birth")) : "";
    const passed = form.get("status") === "已離開";
    const id = String(form.get("id") ?? "") || undefined;
    const cur = id ? await repo.getPet(uid, id) : null;
    if (id && !cur) return { ok: false, error: "找不到這隻毛孩" };
    const photo = (await photoFrom(uid, form.get("photo"))) ?? cur?.photo;
    const traits = cleanTraits(form.getAll("traits"));
    const likes = String(form.get("likes") ?? "").trim().slice(0, 60);
    const habits = String(form.get("habits") ?? "").trim().slice(0, 80);
    const pet = await repo.savePet(uid, {
      id, name, kind, size: kind === "狗" ? size : undefined, sex, birth, photo, traits, likes, habits,
      // 已離開時表單不顯示這兩格，沿用原本的值
      neutered: passed ? cur?.neutered : form.get("neutered") === "on",
      chipped: passed ? cur?.chipped : form.get("chipped") === "on",
      status: passed ? "已離開" : "在世",
      passedAt: passed ? (cur?.passedAt ?? nowIso()) : undefined,
    } as Omit<PetDoc, "id" | "createdAt">);
    if (passed) await repo.deleteCareForPet(uid, pet.id);
    else if (cur && cur.name !== name) for (const c of await repo.listCare(uid)) if (c.petId === pet.id) await repo.saveCareName(c.id, name);
    revalidatePath("/me");
    return { ok: true, data: pet.id };
  } catch (e) {
    return fail(e);
  }
}

/** 刪除毛孩：連同醫療紀錄、照顧提醒、生活變動清單、3D 紀念和所有照片，無法復原。 */
export async function deletePetAction(id: string): Promise<Result> {
  try {
    const uid = await requireWriter();
    if (!(await repo.getPet(uid, id))) return { ok: false, error: "找不到這隻毛孩" };
    const files = await repo.deletePet(uid, id);
    for (const f of files) await deleteFileByUrl(f).catch(() => undefined);
    revalidatePath("/me");
    revalidatePath("/memorial");
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteRecordAction(id: string): Promise<Result> {
  try {
    const uid = await requireWriter();
    const rec = await repo.getRecord(uid, id);
    if (!rec) return { ok: false, error: "找不到這筆紀錄" };
    await repo.deleteRecord(uid, id);
    await deleteFileByUrl(rec.photo).catch(() => undefined);
    revalidatePath(`/pets/${rec.petId}/records`);
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

/* 照顧日曆 */
const careSchema = z.object({
  petId: z.string().min(1).max(64),
  kind: z.enum(CARE_KINDS as [CareKind, ...CareKind[]]),
  label: z.string().trim().min(1).max(20),
  everyMonths: z.number().int().min(1).max(36),
  lastDone: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/),
});

export async function addCareAction(input: z.input<typeof careSchema>): Promise<Result> {
  try {
    const uid = await requireWriter();
    const p = careSchema.safeParse(input);
    if (!p.success) return { ok: false, error: "請填好項目名稱和間隔" };
    const pet = await repo.getPet(uid, p.data.petId);
    if (!pet || pet.status !== "在世") return { ok: false, error: "找不到這隻毛孩" };
    if (p.data.lastDone && p.data.lastDone > taipeiDate()) return { ok: false, error: "上次做的日期不能是未來" };
    await repo.addCare({ ...p.data, uid, petName: pet.name });
    revalidatePath("/care");
    revalidatePath("/me");
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

async function ownCare(id: string) {
  const uid = await requireWriter();
  const c = await repo.getCare(id);
  if (!c || c.uid !== uid) throw new Error("找不到這個項目");
  return c;
}

export async function completeCareAction(id: string): Promise<Result<string>> {
  try {
    await ownCare(id);
    const next = await repo.completeCare(id);
    revalidatePath("/care");
    revalidatePath("/me");
    return { ok: true, data: next?.nextDue ?? "" };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteCareAction(id: string): Promise<Result> {
  try {
    await ownCare(id);
    await repo.deleteCare(id);
    revalidatePath("/care");
    revalidatePath("/me");
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

/* 飼主小學堂：答題。沒登入也能答，登入（非示範）才記錄。答案在伺服器判斷。 */
export async function answerQuizAction(lessonId: string, choice: number): Promise<Result<{ correct: boolean; answer: string; why: string }>> {
  const lesson = lessonById(lessonId);
  if (!lesson) return { ok: false, error: "找不到這一課" };
  const quiz = quizOf(lesson);
  const correct = choice === quiz.answer;
  const uid = await currentUid();
  if (uid && !repo.isDemo(uid)) {
    await repo.saveProgress(uid, { id: lesson.id, correct, at: nowIso() });
    revalidatePath("/learn");
  }
  return { ok: true, data: { correct, answer: quiz.options[quiz.answer], why: quiz.why } };
}

/* 在網頁直接拍醫療單據：和 LINE 一樣，AI 整理後先給你看，確認才存。還沒確認的草稿放在伺服器，不相信瀏覽器傳回來的內容。 */
export type ReceiptPreview = { token: string; photo: string; draft: RecordDraft };

export async function readReceiptAction(form: FormData): Promise<Result<ReceiptPreview>> {
  try {
    const uid = await requireWriter();
    const pet = await repo.getPet(uid, String(form.get("petId") ?? ""));
    if (!pet) return { ok: false, error: "找不到這隻毛孩" };
    const photo = await photoFrom(uid, form.get("photo"));
    if (!photo) return { ok: false, error: "請選一張單據照片" };
    let raw: RecordDraft;
    try {
      const data = await readFileByUrl(photo);
      if (!data) throw new Error("照片存檔失敗，請再試一次。");
      raw = await extractRecord(uid, { inlineData: { mimeType: "image/jpeg", data: data.toString("base64") } });
    } catch (e) {
      await deleteFileByUrl(photo).catch(() => undefined);
      throw e;
    }
    if (!raw.isMedicalDoc) {
      await deleteFileByUrl(photo).catch(() => undefined);
      return { ok: false, error: "這張看起來不是動物醫院的單據。請再拍一次診斷證明、收據或藥袋。" };
    }
    const draft = cleanDraft(raw);
    const token = randomBytes(9).toString("base64url");
    // 一次只留一張待確認的單據；之前沒確認的照片一起刪掉。
    const prev = (await repo.getOwner(uid))?.state;
    if (prev?.mode === "record_review") await deleteFileByUrl(prev.photo).catch(() => undefined);
    await repo.setOwnerState(uid, { mode: "record_review", petId: pet.id, token, photo, draft });
    return { ok: true, data: { token, photo, draft } };
  } catch (e) {
    return fail(e);
  }
}

export async function confirmReceiptAction(token: string, keep: boolean): Promise<Result> {
  try {
    const uid = await requireWriter();
    const st = (await repo.getOwner(uid))?.state;
    if (st?.mode !== "record_review" || st.token !== token) return { ok: false, error: "這張單據已經處理過或過期了，請重新拍一次。" };
    const pet = await repo.getPet(uid, st.petId);
    await repo.setOwnerState(uid, { mode: "none" });
    if (!keep || !pet) {
      await deleteFileByUrl(st.photo).catch(() => undefined);
      return pet ? { ok: true, data: undefined } : { ok: false, error: "找不到這隻毛孩" };
    }
    await repo.saveRecord(uid, pet.name, { ...st.draft, petId: pet.id, photo: st.photo });
    revalidatePath(`/pets/${pet.id}/records`);
    revalidatePath("/me");
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

/* 紀念與告別 */
const HEIGHT: Record<string, number> = { 貓: 25, 小型: 30, 中型: 50, 大型: 65 };

export async function createMemorialAction(form: FormData): Promise<Result<string>> {
  try {
    const uid = await requireWriter();
    const pet = await repo.getPet(uid, String(form.get("petId") ?? ""));
    if (!pet) return { ok: false, error: "請先選擇毛孩" };
    const memories = String(form.get("memories") ?? "").trim().slice(0, 1200);
    const passed = async () => {
      if (pet.status !== "已離開") await repo.savePet(uid, { ...pet, status: "已離開", passedAt: nowIso() });
      await repo.deleteCareForPet(uid, pet.id);
      revalidatePath("/memorial");
    };
    // 牠還在時已經留下 3D：直接轉成紀念，不用重新上傳照片
    if (form.get("fromKeepsake") === "1") {
      const k = await repo.keepsakeToMemorial(uid, pet.id, memories);
      if (!k) return { ok: false, error: "找不到生前留下的 3D，請改成上傳照片" };
      await passed();
      return { ok: true, data: k.id };
    }
    const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 4);
    if (!files.length) return { ok: false, error: "至少要一張照片" };
    const photos: string[] = [];
    for (const f of files) photos.push((await photoFrom(uid, f))!);
    await passed();
    const m = await repo.createMemorial({
      uid, petId: pet.id, petName: pet.name, kind: pet.kind,
      heightCm: HEIGHT[pet.kind === "貓" ? "貓" : pet.size ?? "中型"], photos, memories,
    });
    revalidatePath("/memorial");
    return { ok: true, data: m.id };
  } catch (e) {
    return fail(e);
  }
}

/** 趁牠還在，用多角度照片（或影片裡挑出的畫面）先留下 3D。重拍時取代舊的那一份。 */

export async function createKeepsakeAction(form: FormData): Promise<Result<string>> {
  try {
    const uid = await requireWriter();
    const pet = await repo.getPet(uid, String(form.get("petId") ?? ""));
    if (!pet) return { ok: false, error: "找不到這隻毛孩" };
    if (pet.status !== "在世") return { ok: false, error: "牠已經離開了，請改用「紀念與告別」" };
    const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0).slice(0, KEEPSAKE_MAX);
    if (files.length < 2) return { ok: false, error: "至少要 2 個角度（第一張是側面全身）" };
    const photos: string[] = [];
    for (const f of files) photos.push((await photoFrom(uid, f))!);
    const old = await repo.keepsakeOf(uid, pet.id);
    if (old) {
      for (const f of [...old.photos, ...(old.glb ? [old.glb] : [])]) await deleteFileByUrl(f).catch(() => undefined);
      await repo.deleteMemorial(old.id);
    }
    const m = await repo.createMemorial({
      uid, petId: pet.id, petName: pet.name, kind: pet.kind, keepsake: true,
      heightCm: HEIGHT[pet.kind === "貓" ? "貓" : pet.size ?? "中型"], photos, memories: "",
    });
    revalidatePath("/me");
    return { ok: true, data: m.id };
  } catch (e) {
    return fail(e);
  }
}

async function ownMemorial(id: string) {
  const uid = await requireWriter();
  const m = await repo.getMemorial(id);
  if (!m || m.uid !== uid) throw new Error("找不到這個紀念");
  return m;
}

/**
 * 送出 3D 前先看第一張照片的姿勢。照片不存檔，只送給 AI 看。
 * 檢查本身出錯時不擋人（回傳 ok）。
 */
export async function checkShapePhotoAction(form: FormData): Promise<Result<{ ok: boolean; problem: string }>> {
  try {
    const uid = await requireWriter();
    const f = form.get("photo");
    if (!(f instanceof File) || f.size === 0 || f.size > MAX_PHOTO || !f.type.startsWith("image/")) return { ok: false, error: "照片太大或格式不支援" };
    try {
      const r = await checkShapePhoto(uid, { inlineData: { mimeType: f.type, data: Buffer.from(await f.arrayBuffer()).toString("base64") } });
      return { ok: true, data: { ok: r.ok, problem: r.ok ? "" : r.problem || "這張不太適合，請換一張站著、從側面拍到全身的照片。" } };
    } catch (e) {
      // 檢查失敗（AI 沒設定、額度用完、連線問題）就不擋人
      console.error("3D 照片檢查失敗", (e as Error).message);
      return { ok: true, data: { ok: true, problem: "" } };
    }
  } catch (e) {
    return fail(e);
  }
}

export async function tributeDraftAction(id: string): Promise<Result<string>> {
  try {
    const m = await ownMemorial(id);
    if (!m.memories.trim()) return { ok: false, error: "先寫幾段回憶，AI 才能幫你寫" };
    const pet = await repo.getPet(m.uid, m.petId);
    const years = pet?.birth ? `${pet.birth.slice(0, 4)}～${(pet.passedAt ?? nowIso()).slice(0, 4)}` : "";
    return { ok: true, data: await writeTribute(m.uid, { name: m.petName, kind: m.kind, years, memories: m.memories, traits: pet?.traits ?? [], likes: pet?.likes ?? "", habits: pet?.habits ?? "" }) };
  } catch (e) {
    return fail(e);
  }
}

export async function saveTributeAction(id: string, text: string): Promise<Result> {
  try {
    const m = await ownMemorial(id);
    await repo.updateMemorial(m.id, { tribute: text.trim().slice(0, 800), tributeOk: Boolean(text.trim()) });
    revalidatePath(`/memorial/${m.id}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function shareMemorialAction(id: string, on: boolean): Promise<Result<string>> {
  try {
    const m = await ownMemorial(id);
    const shareToken = on ? (m.shareToken ?? repo.newShareToken()) : "";
    await repo.updateMemorial(m.id, { shareToken });
    revalidatePath(`/memorial/${m.id}`);
    return { ok: true, data: shareToken };
  } catch (e) {
    return fail(e);
  }
}

export async function retryMemorialAction(id: string): Promise<Result> {
  try {
    const m = await ownMemorial(id);
    if (m.status !== "失敗") return { ok: false, error: "只有失敗的可以重新排隊" };
    await repo.updateMemorial(m.id, { status: "排隊中", error: "" });
    revalidatePath(`/memorial/${m.id}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function logoutAction(): Promise<Result> {
  await endSession();
  revalidatePath("/me");
  return { ok: true, data: undefined };
}
