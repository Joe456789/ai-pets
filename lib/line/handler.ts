import { randomBytes } from "node:crypto";
import { AiUnavailableError } from "@/lib/ai/gemini";
import { extractRecord } from "@/lib/ai/tasks";
import { HEALTH_NOTICE } from "@/lib/constants";
import { daysBetween } from "@/lib/care";
import { lessonById, nextLesson, quizOf, timelyLesson } from "@/lib/lessons";
import { lineClient, type LineClient, type LineMessage } from "@/lib/line/client";
import * as msg from "@/lib/line/messages";
import { deleteFileByUrl, readFileByUrl, savePhoto } from "@/lib/media";
import { cleanDraft } from "@/lib/records";
import * as repo from "@/lib/repo";
import { monthKey, taipeiDate } from "@/lib/time";
import type { LineCreds, OwnerDoc, OwnerState } from "@/lib/types";

export type LineEvent = {
  type: string;
  webhookEventId?: string;
  replyToken?: string;
  source?: { type: string; userId?: string };
  message?: { type: string; id: string; text?: string };
  postback?: { data: string };
};

type Ctx = {
  line: LineClient;
  uid: string;
  owner: OwnerDoc;
  reply: (...messages: LineMessage[]) => Promise<void>;
  setState: (state: OwnerState) => Promise<void>;
};

const newToken = () => randomBytes(4).toString("hex");

// 健康狀況一律請對方找獸醫，不交給 AI 回答。寧可多提醒，不要漏接。
const HEALTH_RE = /吐|嘔|拉肚子|腹瀉|(?<!混)血|抽搐|癲癇|昏|呼吸|喘|不吃|沒吃|沒精神|發燒|受傷|骨折|腫|中毒|誤食|生病|餵藥|用藥|吃藥/;
const URGENT_RE = /抽搐|癲癇|昏倒|昏迷|呼吸困難|大量出血|中毒|車禍|快死|沒呼吸/;
// 聽到想放棄時，先接住，給具體的下一步，不責備。
const GIVE_UP_RE = /棄養|養不下去|不想養|不能養|沒辦法.{0,4}養|無法.{0,4}養|送走|送人|丟掉|退養/;
// 健康字眼（HEALTH_RE）優先處理，所以這裡的「生病」「住院」只會在沒有其他症狀描述時接到。
const CHANGE_RE = /搬家|懷孕|生小孩|生寶寶|新生兒|出國|留學|外派|換工作|輪班|加班|結婚|同居|過敏|住院|失業|沒錢|經濟|生活變動/;

// 同一位使用者的訊息要依序處理，連續傳照片時才不會互相蓋掉對話狀態。
const queues = new Map<string, Promise<unknown>>();
function enqueue(key: string, job: () => Promise<void>) {
  const next = (queues.get(key) ?? Promise.resolve()).then(job, job);
  queues.set(key, next);
  void next.finally(() => { if (queues.get(key) === next) queues.delete(key); });
  return next;
}

export async function handleLineEvents(events: LineEvent[]) {
  const creds = await repo.getLineCreds();
  if (!creds) throw new Error("尚未設定 LINE 官方帳號");
  const line = lineClient(creds);
  await Promise.all(events.map((event) => {
    const uid = event.source?.userId;
    if (!uid || event.source?.type !== "user") return undefined;
    return enqueue(uid, () => processEvent(creds, line, uid, event));
  }));
}

async function processEvent(_creds: LineCreds, line: LineClient, uid: string, event: LineEvent) {
  if (event.webhookEventId && !(await repo.markEventOnce(event.webhookEventId))) return;
  const replyToken = event.replyToken ?? "";
  const owner = (await repo.getOwner(uid)) ?? (await repo.ensureOwner(uid, (await line.getDisplayName(uid)) ?? ""));
  const ctx: Ctx = {
    line, uid, owner,
    reply: (...messages) => (replyToken ? line.reply(replyToken, uid, messages) : line.push(uid, messages)),
    setState: async (state) => { owner.state = state; await repo.setOwnerState(uid, state); },
  };
  try {
    await handleEvent(ctx, event);
  } catch (e) {
    console.error("LINE 事件處理失敗", { type: event.type, error: (e as Error).message });
    const friendly = e instanceof AiUnavailableError ? `AI 目前無法使用：${(e as Error).message}` : "系統暫時出了點問題，請再傳一次。";
    await ctx.reply(msg.text(friendly)).catch(() => undefined);
  }
}

async function handleEvent(ctx: Ctx, event: LineEvent) {
  if (event.type === "follow") {
    await ctx.setState({ mode: "none" });
    await ctx.reply(msg.text(msg.WELCOME));
    return;
  }
  if (event.type === "postback") {
    const p = new URLSearchParams(event.postback?.data ?? "");
    await postback(ctx, p.get("a") ?? "", p);
    return;
  }
  if (event.type !== "message" || !event.message) return;
  const m = event.message;
  if (m.type === "image") { await onImage(ctx, m.id); return; }
  if (m.type === "text") { await onText(ctx, (m.text ?? "").trim()); return; }
  await ctx.reply(msg.text("目前可以傳文字或照片給我。"));
}

async function postback(ctx: Ctx, action: string, p: URLSearchParams) {
  const state = ctx.owner.state ?? { mode: "none" };
  switch (action) {
    case "cancel":
      await ctx.setState({ mode: "none" });
      await ctx.reply(msg.text("已取消。"));
      return;
    case "help":
      await ctx.reply(msg.text(msg.HELP));
      return;
    case "record":
    case "records": {
      const pets = (await repo.listPets(ctx.uid)).filter((x) => x.status === "在世" || action === "records");
      if (!pets.length) { await ctx.reply(msg.linkCard("先新增你的毛孩", "新增毛孩之後，就可以把看診單據存在牠的紀錄裡。", "新增毛孩", "/pets/new")); return; }
      if (action === "records") {
        if (pets.length === 1) { await ctx.reply(msg.linkCard(`${pets[0].name}的醫療紀錄`, "每次看診、用藥和每年花費都在這裡。", "打開紀錄", `/pets/${pets[0].id}/records`)); return; }
        await ctx.reply(msg.pickPet(pets, "records_pet", "要看哪一隻的紀錄？"));
        return;
      }
      if (pets.length === 1) { await askPhoto(ctx, pets[0].id, pets[0].name); return; }
      await ctx.reply(msg.pickPet(pets, "record_pet", "這張單據是哪一隻的？"));
      return;
    }
    case "records_pet": {
      const pet = await repo.getPet(ctx.uid, p.get("p") ?? "");
      if (!pet) { await ctx.reply(msg.text("找不到這隻毛孩。")); return; }
      await ctx.reply(msg.linkCard(`${pet.name}的醫療紀錄`, "每次看診、用藥和每年花費都在這裡。", "打開紀錄", `/pets/${pet.id}/records`));
      return;
    }
    case "record_pet": {
      const pet = await repo.getPet(ctx.uid, p.get("p") ?? "");
      if (!pet) { await ctx.reply(msg.text("找不到這隻毛孩。")); return; }
      await askPhoto(ctx, pet.id, pet.name);
      return;
    }
    case "record_ok":
    case "record_retry": {
      if (state.mode !== "record_review" || state.token !== p.get("t")) { await ctx.reply(msg.text("這張卡片已經處理過或過期了。")); return; }
      const pet = await repo.getPet(ctx.uid, state.petId);
      if (action === "record_retry" || !pet) {
        await deleteFileByUrl(state.photo).catch(() => undefined);
        if (!pet) { await ctx.setState({ mode: "none" }); await ctx.reply(msg.text("找不到這隻毛孩。")); return; }
        await askPhoto(ctx, pet.id, pet.name, "好，請再拍一次，盡量拍正、拍清楚整張單據。");
        return;
      }
      await repo.saveRecord(ctx.uid, pet.name, { ...state.draft, petId: pet.id, photo: state.photo });
      await ctx.setState({ mode: "none" });
      await ctx.reply(msg.savedRecordCard(pet.name, pet.id, state.draft.followUp));
      return;
    }
    case "care_done": {
      const c = await repo.getCare(p.get("c") ?? "");
      if (!c || c.uid !== ctx.uid) { await ctx.reply(msg.text("找不到這個照顧項目，可能已經刪掉了。")); return; }
      // 同一張提醒卡按第二次，不要再往後推一次。
      if (c.lastDone === taipeiDate()) { await ctx.reply(msg.careDoneText(c)); return; }
      const next = await repo.completeCare(c.id);
      await ctx.reply(msg.careDoneText(next ?? c));
      return;
    }
    case "lesson":
      await sendNextLesson(ctx);
      return;
    case "quiz": {
      const lesson = lessonById(p.get("l") ?? "");
      if (!lesson) { await ctx.reply(msg.text("找不到這一課。")); return; }
      const quiz = quizOf(lesson);
      const correct = Number(p.get("c")) === quiz.answer;
      await repo.saveProgress(ctx.uid, { id: lesson.id, correct, at: new Date().toISOString() });
      await ctx.reply(msg.text(
        `${correct ? "答對了！" : `差一點，答案是「${quiz.options[quiz.answer]}」。`}\n${quiz.why}`,
        [{ label: "再來一課", data: "a=lesson" }],
      ));
      return;
    }
    default:
      await ctx.reply(msg.text("這個功能目前無法使用。"));
  }
}

async function sendNextLesson(ctx: Ctx) {
  const next = nextLesson(await repo.listPets(ctx.uid), await repo.listProgress(ctx.uid));
  if (!next) { await ctx.reply(msg.linkCard("現在適合你的課都上完了", "很棒！毛孩長大、換季時會有新的課，到時候會通知你。也可以回去複習。", "打開小學堂", "/learn")); return; }
  await ctx.reply(msg.lessonCard(next.lesson, next.why));
}

async function askPhoto(ctx: Ctx, petId: string, petName: string, lead?: string) {
  await ctx.setState({ mode: "record_photo", petId });
  await ctx.reply(msg.text(`${lead ?? `請傳${petName}的看診單據照片。`}\n診斷證明、收據、明細或藥袋都可以，一次一張。`, [{ label: "取消", data: "a=cancel" }]));
}

async function onImage(ctx: Ctx, messageId: string) {
  const state = ctx.owner.state ?? { mode: "none" };
  if (state.mode !== "record_photo") {
    await ctx.reply(msg.text("收到照片了。如果是看診單據，請先從選單按「拍醫療單據」選毛孩，再傳一次。", [{ label: "拍醫療單據", data: "a=record" }]));
    return;
  }
  const pet = await repo.getPet(ctx.uid, state.petId);
  if (!pet) { await ctx.setState({ mode: "none" }); await ctx.reply(msg.text("找不到這隻毛孩。")); return; }
  await ctx.line.showLoading(ctx.uid);
  const { buffer } = await ctx.line.getContent(messageId);
  const photo = await savePhoto(ctx.uid, buffer);
  const data = await readFileByUrl(photo);
  const raw = await extractRecord(ctx.uid, { inlineData: { mimeType: "image/jpeg", data: (data ?? buffer).toString("base64") } });
  if (!raw.isMedicalDoc) {
    await deleteFileByUrl(photo).catch(() => undefined);
    await ctx.reply(msg.text("這張看起來不是動物醫院的單據。請再拍一次診斷證明、收據或藥袋。", [{ label: "取消", data: "a=cancel" }]));
    return;
  }
  const draft = cleanDraft(raw);
  const token = newToken();
  await ctx.setState({ mode: "record_review", petId: pet.id, token, photo, draft });
  await ctx.reply(msg.recordDraftCard(draft, pet.name, token));
}

async function onText(ctx: Ctx, t: string) {
  if (t === "取消") { await ctx.setState({ mode: "none" }); await ctx.reply(msg.text("已取消。")); return; }
  if (/^(使用)?說明$|^help$/i.test(t)) { await ctx.reply(msg.text(msg.HELP)); return; }
  if (/小學堂|上課|來一課/.test(t)) { await sendNextLesson(ctx); return; }
  if (URGENT_RE.test(t)) {
    await ctx.reply(msg.text(`聽起來情況比較緊急，請立刻聯絡或前往最近的動物醫院（夜間可以找 24 小時急診）。\n\n${HEALTH_NOTICE}`));
    return;
  }
  if (GIVE_UP_RE.test(t)) {
    await ctx.reply(
      msg.text("謝謝你願意說出來，會走到這一步，通常是遇到了很實際的困難。\n\n可以先想想是哪一種：\n・住處不能養：先和房東談，或找可養寵物的租屋\n・時間或身體負擔：請家人朋友分擔，或找寵物保姆\n・費用：把醫療單據存進紀錄，算算每月需要多少，再找低價診所或分期\n・行為問題：找合格的訓練師或行為獸醫\n\n真的沒辦法繼續養時，請替牠找一個能照顧一輩子的新家，親自交接，千萬不要放養或丟棄。"),
      msg.changeCard(),
    );
    return;
  }
  if (HEALTH_RE.test(t)) {
    await ctx.reply(msg.text(`健康狀況我沒辦法判斷，也不建議自行用藥。如果情況持續或變嚴重，請盡快帶牠看獸醫。\n\n看完診可以按「拍醫療單據」，把單據存起來，下次回診就有完整紀錄。\n\n${HEALTH_NOTICE}`));
    return;
  }
  if (CHANGE_RE.test(t)) { await ctx.reply(msg.changeCard()); return; }
  await ctx.reply(msg.text("可以從下方選單開始：飼養前評估、我的毛孩、拍醫療單據、照顧日曆、飼主小學堂、紀念與告別。", [{ label: "使用說明", data: "a=help" }, { label: "來一課", data: "a=lesson" }]));
}

// 只推給真的 LINE 使用者（ID 是 U 開頭），示範和本機測試帳號不推。
const pushable = (uid: string) => /^U[0-9a-f]{32}$/.test(uid);

/** 每天由排程呼叫：明天要回診的、今天或明天到期的照顧項目，推播提醒。回傳送出的數量。 */
export async function sendReminders(today = taipeiDate()) {
  const creds = await repo.getLineCreds();
  if (!creds) return 0;
  const line = lineClient(creds);
  let n = 0;
  for (const r of await repo.dueReminders(today)) {
    if (!pushable(r.uid)) continue;
    try {
      await line.push(r.uid, [msg.reminderCard(r)]);
      await repo.markReminderSent(r.id);
      n++;
    } catch (e) {
      console.error("提醒推播失敗", (e as Error).message);
    }
  }
  for (const c of await repo.dueCare(today)) {
    if (!pushable(c.uid)) continue;
    try {
      await line.push(c.uid, [msg.careReminderCard(c, today)]);
      await repo.markCareReminded(c.id, c.nextDue);
      n++;
    } catch (e) {
      console.error("照顧提醒推播失敗", (e as Error).message);
    }
  }
  return n;
}

/**
 * 每天由排程呼叫，每人最多推一課：
 * 1. 毛孩剛好到了某課的最佳月齡（例如幼貓的疫苗、5 個月大的結紮、剛進入老年的健檢），就推那一課，同一課只推一次。
 * 2. 否則，這個月還沒收到小學堂的，推下一課（每月一次；當季的課會排在前面）。
 */
export async function sendLessons(now = new Date()) {
  const creds = await repo.getLineCreds();
  if (!creds) return 0;
  const line = lineClient(creds);
  const month = monthKey(now);
  const today = taipeiDate(now);
  let n = 0;
  for (const o of await repo.listOwners()) {
    if (!pushable(o.uid)) continue;
    try {
      const [pets, progress] = await Promise.all([repo.listPets(o.uid), repo.listProgress(o.uid)]);
      // 主動推的課之間至少隔 7 天，剛接回家的幼貓幼犬才不會連續幾天都收到。
      const rested = !o.lessonPushedAt || daysBetween(o.lessonPushedAt, today) >= 7;
      const timely = rested ? timelyLesson(pets, progress, o.lessonPushed ?? [], now) : null;
      const pick = timely ?? (o.lessonMonth === month ? null : nextLesson(pets, progress, now));
      // 先記下來再推：推播失敗（例如對方封鎖）也不會每天重試。主動推的那課也算這個月的一課。
      if (timely) await repo.setLessonPushed(o.uid, [...(o.lessonPushed ?? []), timely.lesson.id], today);
      if (timely || o.lessonMonth !== month) await repo.setLessonMonth(o.uid, month);
      if (!pick) continue;
      await line.push(o.uid, [msg.lessonCard(pick.lesson, pick.why, !timely)]);
      n++;
    } catch (e) {
      console.error("小學堂推播失敗", (e as Error).message);
    }
  }
  return n;
}

/** 3D 紀念做好時通知本人。 */
export async function notifyMemorialReady(uid: string, petName: string, memorialId: string) {
  const creds = await repo.getLineCreds();
  if (!creds || repo.isDemo(uid)) return;
  await lineClient(creds).push(uid, [msg.memorialReadyCard(petName, memorialId)]).catch((e) => console.error("紀念完成推播失敗", (e as Error).message));
}
