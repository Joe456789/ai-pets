import { randomBytes } from "node:crypto";
import { AiUnavailableError, type AiPart } from "@/lib/ai/gemini";
import { findBannedClaim } from "@/lib/ai/guard";
import { answerAdopter, extractIntake, parseCare } from "@/lib/ai/tasks";
import { HEALTH_NOTICE } from "@/lib/constants";
import { lineClient, type LineClient, type LineMessage } from "@/lib/line/client";
import * as msg from "@/lib/line/messages";
import { readPhotoByUrl, savePhoto } from "@/lib/media";
import { logAi, logError } from "@/lib/platform";
import * as repo from "@/lib/repo";
import { fmtDate, nowIso } from "@/lib/time";
import type { LineCreds, LineUserDoc, LineUserState, ShelterDoc, StaffDoc } from "@/lib/types";

export type LineEvent = {
  type: string;
  webhookEventId?: string;
  replyToken?: string;
  source?: { type: string; userId?: string };
  message?: { type: string; id: string; text?: string };
  postback?: { data: string };
};

type Ctx = {
  sid: string;
  shelter: ShelterDoc;
  creds: LineCreds;
  line: LineClient;
  userId: string;
  user: LineUserDoc;
  replyToken: string;
  reply: (...messages: LineMessage[]) => Promise<void>;
  setState: (state: LineUserState) => Promise<void>;
};

const MAX_BIND_FAILS = 5;
const BIND_BLOCK_MS = 60 * 60 * 1000;
const MAX_PHOTOS = 4;
const newToken = () => randomBytes(4).toString("hex");

// 這些關鍵字一定轉人工，不等 AI 判斷。寧可多轉，不要漏接。
const HEALTH_RE = /吐|嘔|拉肚子|腹瀉|(?<!混)血|抽搐|癲癇|昏|呼吸|喘|不吃|沒吃|沒精神|發燒|受傷|骨折|腫|中毒|誤食|生病|看醫生|獸醫|餵藥|用藥|吃藥/;
const URGENT_RE = /抽搐|癲癇|昏倒|昏迷|呼吸困難|大量出血|中毒|車禍|快死|沒呼吸/;
const REHOME_RE = /退養|棄養|養不下去|不想養|不能養|沒辦法.{0,4}養|無法.{0,4}養|送走|送人|還給你們|丟掉/;

// 同一位使用者的訊息要依序處理。照片和語音常常連續傳來，同時處理會互相蓋掉對話狀態。
const queues = new Map<string, Promise<unknown>>();
function enqueue(key: string, job: () => Promise<void>) {
  const next = (queues.get(key) ?? Promise.resolve()).then(job, job);
  queues.set(key, next);
  void next.finally(() => { if (queues.get(key) === next) queues.delete(key); });
  return next;
}

export async function handleLineEvents(sid: string, events: LineEvent[]) {
  const [shelter, creds] = await Promise.all([repo.getShelter(sid), repo.getLineCreds(sid)]);
  if (!shelter || !creds) throw new Error(`協會 ${sid} 尚未設定 LINE`);
  // 停用中的協會不處理訊息，也不消耗 AI 額度。
  if (shelter.status === "已停用") return;
  const line = lineClient(creds);

  await Promise.all(events.map((event) => {
    const userId = event.source?.userId;
    if (!userId || event.source?.type !== "user") return undefined;
    return enqueue(`${sid}:${userId}`, () => processEvent(sid, shelter, creds, line, userId, event));
  }));
}

async function processEvent(sid: string, shelter: ShelterDoc, creds: LineCreds, line: LineClient, userId: string, event: LineEvent) {
  // 重送的事件 ID 相同，只處理一次。
  if (event.webhookEventId && !(await repo.markEventOnce(sid, event.webhookEventId))) return;

  const replyToken = event.replyToken ?? "";
  const user = await repo.getLineUser(sid, userId);
  const ctx: Ctx = {
    sid, shelter, creds, line, userId, user, replyToken,
    reply: (...messages) => (replyToken ? line.reply(replyToken, userId, messages) : line.push(userId, messages)),
    setState: async (state) => { user.state = state; await repo.saveLineUser(sid, user); },
  };

  try {
    await handleEvent(ctx, event);
  } catch (e) {
    console.error("LINE 事件處理失敗", { sid, type: event.type, error: (e as Error).message });
    await logError(sid, `LINE ${event.type}`, (e as Error).message).catch(() => undefined);
    const friendly = e instanceof AiUnavailableError ? "AI 目前無法使用，請稍後再試，或直接聯絡協會人員。" : "系統暫時出了點問題，請再傳一次。";
    await ctx.reply(msg.text(friendly)).catch(() => undefined);
  }
}

async function handleEvent(ctx: Ctx, event: LineEvent) {
  const staff = await currentStaff(ctx);

  if (event.type === "follow") {
    if (!staff) await ctx.reply(msg.text(`你好，這裡是${ctx.shelter.name}。可以從下方選單看領養動物或詢問問題，直接傳訊息給我們也可以！\n\n協會人員請傳送你的工作號完成綁定。`));
    return;
  }

  if (event.type === "postback") {
    const params = new URLSearchParams(event.postback?.data ?? "");
    const action = params.get("a") ?? "";
    if (action === "cancel") { await ctx.setState({ mode: "none" }); await ctx.reply(msg.text("已取消。")); return; }
    if (staff) await staffPostback(ctx, staff, action, params.get("t"));
    else await adopterPostback(ctx, action);
    return;
  }

  if (event.type !== "message" || !event.message) return;
  const m = event.message;

  if (m.type === "text") {
    const t = (m.text ?? "").trim();
    if (t === "取消") { await ctx.setState({ mode: "none" }); await ctx.reply(msg.text("已取消。")); return; }
    if (repo.STAFF_CODE_RE.test(t.toUpperCase())) { await bindStaff(ctx, t.toUpperCase(), staff); return; }
  }

  if (staff) await staffMessage(ctx, staff, m);
  else await adopterMessage(ctx, m);
}

/** 只有綁定中且未停用的工作號才算人員；被停用的人員會立刻變回一般選單。 */
async function currentStaff(ctx: Ctx): Promise<StaffDoc | null> {
  const code = ctx.user.staffCode;
  if (!code) return null;
  const staff = await repo.getStaff(ctx.sid, code);
  if (staff && !staff.disabled && staff.lineUserId === ctx.userId) return staff;
  ctx.user.staffCode = undefined;
  ctx.user.state = { mode: "none" };
  await repo.saveLineUser(ctx.sid, ctx.user);
  await ctx.line.unlinkRichMenu(ctx.userId).catch(() => undefined);
  return null;
}

async function bindStaff(ctx: Ctx, code: string, current: StaffDoc | null) {
  if (current) { await ctx.reply(msg.text(current.code === code ? "你已經綁定這組工作號了。" : "這個 LINE 帳號已綁定其他工作號，請先請管理者解除。")); return; }
  const u = ctx.user;
  if (u.blockedUntil && u.blockedUntil > nowIso()) { await ctx.reply(msg.text("嘗試次數太多，請一小時後再試，或聯絡管理者。")); return; }

  const staff = await repo.getStaff(ctx.sid, code);
  // 工作號錯誤、已停用、已被綁定都回同一句話，避免有人藉此猜出哪些工作號存在。
  const expired = staff && !staff.lineUserId && staff.createdAt && Date.now() - new Date(staff.createdAt).getTime() > repo.STAFF_CODE_TTL_MS;
  if (!staff || staff.disabled || expired || (staff.lineUserId && staff.lineUserId !== ctx.userId)) {
    u.failedBinds = (u.failedBinds ?? 0) + 1;
    if (u.failedBinds >= MAX_BIND_FAILS) { u.blockedUntil = new Date(Date.now() + BIND_BLOCK_MS).toISOString(); u.failedBinds = 0; }
    await repo.saveLineUser(ctx.sid, u);
    await ctx.reply(msg.text("無法使用這組工作號，請確認有沒有打錯，或聯絡協會管理者。"));
    return;
  }

  await repo.updateStaff(ctx.sid, code, { lineUserId: ctx.userId, boundAt: nowIso() });
  u.staffCode = code;
  u.failedBinds = 0;
  u.blockedUntil = undefined;
  u.state = { mode: "none" };
  await repo.saveLineUser(ctx.sid, u);
  if (ctx.creds.staffMenuId) await ctx.line.linkRichMenu(ctx.userId, ctx.creds.staffMenuId);
  await ctx.reply(msg.bindOkCard(staff, ctx.shelter));
}

/* 現場人員 */

async function staffPostback(ctx: Ctx, staff: StaffDoc, action: string, token: string | null) {
  const state = ctx.user.state;
  switch (action) {
    case "intake":
      await ctx.setState({ mode: "intake", photos: [] });
      await ctx.reply(msg.text("請傳動物的照片（最多 4 張），再講一段話或打字說明。\n例如：今天新進一隻棕色公狗，中型，大概兩歲，在大河路撿到，還沒絕育，很親人。", [{ label: "取消", data: "a=cancel" }]));
      return;
    case "care":
      await ctx.setState({ mode: "care" });
      await ctx.reply(msg.text("請講或打字回報，只講有狀況的就好。\n例如：A 區都正常，小黑今天沒吃，阿福拉肚子。", [{ label: "取消", data: "a=cancel" }]));
      return;
    case "lookup":
      await ctx.setState({ mode: "lookup" });
      await ctx.reply(msg.text("請輸入動物的名字或編號。", [{ label: "取消", data: "a=cancel" }]));
      return;
    case "digest": {
      const d = await repo.dailyDigest(ctx.sid);
      await ctx.reply(msg.digestCard(d, fmtDate(nowIso())));
      return;
    }
    case "me":
      await ctx.reply(msg.staffInfoCard(staff, ctx.shelter));
      return;
    case "help":
      await ctx.reply(msg.text(msg.STAFF_HELP));
      return;
    case "intake_ok": {
      if (state.mode !== "intake_review" || state.token !== token) { await ctx.reply(msg.text("這張卡片已經處理過或過期了。")); return; }
      const area = staff.area.split("、")[0] || "未指定";
      const animal = await repo.createAnimalFromDraft(ctx.sid, state.draft, state.photos, area);
      await ctx.setState({ mode: "none" });
      await ctx.reply(msg.text(`已建檔：${animal.name}（${animal.code}），區域 ${animal.area}。\n管理者可以在後台補資料、確認送養介紹後再公開。`));
      return;
    }
    case "intake_edit": {
      if (state.mode !== "intake_review" || state.token !== token) { await ctx.reply(msg.text("這張卡片已經處理過或過期了。")); return; }
      await ctx.setState({ mode: "intake_edit", token: state.token, photos: state.photos, draft: state.draft });
      await ctx.reply(msg.text("要改什麼？直接講或打字就好，例如「是母的，名字叫豆豆」。", [{ label: "取消", data: "a=cancel" }]));
      return;
    }
    case "care_ok": {
      if (state.mode !== "care_review" || state.token !== token) { await ctx.reply(msg.text("這張卡片已經處理過或過期了。")); return; }
      const alerts = await repo.saveCareDraft(ctx.sid, state.draft, staff.name, staff.code);
      await ctx.setState({ mode: "none" });
      const saved = state.draft.entries.filter((e) => e.animalId).length + state.draft.areas.length;
      await ctx.reply(msg.text(`已存 ${saved} 筆，謝謝回報。`), ...alerts.slice(0, 4).map((a) => msg.careAlertCard(a.animal.name, a.category)));
      return;
    }
    default:
      await ctx.reply(msg.text("這個功能目前無法使用。"));
  }
}

async function loadInput(ctx: Ctx, m: NonNullable<LineEvent["message"]>): Promise<{ media: AiPart[]; text?: string }> {
  if (m.type === "text") return { media: [], text: m.text };
  const { buffer } = await ctx.line.getContent(m.id);
  // LINE 的語音是 m4a，也就是 MP4 容器內的 AAC。
  return { media: [{ inlineData: { mimeType: "audio/mp4", data: buffer.toString("base64") } }] };
}

async function staffMessage(ctx: Ctx, staff: StaffDoc, m: NonNullable<LineEvent["message"]>) {
  const state = ctx.user.state;

  if (state.mode === "intake" && m.type === "image") {
    if (state.photos.length >= MAX_PHOTOS) { await ctx.reply(msg.text("照片最多 4 張，請接著講一段話或打字說明。")); return; }
    const { buffer } = await ctx.line.getContent(m.id);
    const url = await savePhoto(ctx.sid, buffer);
    await ctx.setState({ ...state, photos: [...state.photos, url] });
    await ctx.reply(msg.text(`收到第 ${state.photos.length + 1} 張照片。接著請講一段話或打字說明。`));
    return;
  }

  const isSpeech = m.type === "audio" || m.type === "text";

  if ((state.mode === "intake" || state.mode === "intake_edit") && isSpeech) {
    await ctx.line.showLoading(ctx.userId);
    const input = await loadInput(ctx, m);
    const photoParts: AiPart[] = [];
    for (const url of state.photos) {
      const data = await readPhotoByUrl(url);
      if (data) photoParts.push({ inlineData: { mimeType: "image/jpeg", data: data.toString("base64") } });
    }
    const previous = state.mode === "intake_edit" ? state.draft : undefined;
    const draft = await extractIntake(ctx.sid, { media: [...photoParts, ...input.media], text: input.text, previous });
    const token = newToken();
    await ctx.setState({ mode: "intake_review", token, photos: state.photos, draft });
    await ctx.reply(msg.intakeDraftCard(draft, token, state.photos.length));
    return;
  }

  if (state.mode === "care" && isSpeech) {
    await ctx.line.showLoading(ctx.userId);
    const input = await loadInput(ctx, m);
    const animals = (await repo.listAnimals(ctx.sid)).filter((a) => a.status !== "已領養");
    const draft = await parseCare(ctx.sid, { ...input, animals: animals.map((a) => ({ id: a.id, name: a.name, code: a.code, area: a.area })), areas: ctx.shelter.areas });
    if (!draft.areas.length && !draft.entries.length) { await ctx.reply(msg.text("我沒有聽出要記錄什麼，可以再講一次嗎？", [{ label: "取消", data: "a=cancel" }])); return; }
    const token = newToken();
    await ctx.setState({ mode: "care_review", token, draft });
    await ctx.reply(msg.careDraftCard(draft, new Map(animals.map((a) => [a.id, a.name])), token));
    return;
  }

  if (m.type === "text") {
    const found = await repo.findAnimals(ctx.sid, m.text ?? "");
    if (found.length === 1) {
      await ctx.setState({ mode: "none" });
      await ctx.reply(msg.animalCard(found[0], await repo.listCareOf(ctx.sid, found[0].id)));
      return;
    }
    if (found.length > 1) {
      await ctx.reply(msg.text(`找到 ${found.length} 隻，請選一隻：`, found.slice(0, 10).map((a) => ({ label: `${a.name} ${a.code}`, text: a.code }))));
      return;
    }
    if (state.mode === "lookup") { await ctx.reply(msg.text("找不到這隻動物，請確認名字或編號。")); return; }
  }

  await ctx.reply(msg.text("請先從下方的工作選單選擇要做的事。"));
}

/* 領養人 */

async function adopterPostback(ctx: Ctx, action: string) {
  switch (action) {
    case "faq":
      await ctx.setState({ mode: "none" });
      await ctx.reply(msg.text("想知道什麼呢？也可以直接打字問我。", ctx.shelter.faq.map((f) => ({ label: f.q, text: f.q }))));
      return;
    case "progress":
      await ctx.setState({ mode: "progress" });
      await ctx.reply(msg.text("請輸入申請編號（送出申請時畫面上的 LL- 開頭編號）。", [{ label: "取消", data: "a=cancel" }]));
      return;
    case "askcare":
      await ctx.setState({ mode: "askcare" });
      await ctx.reply(msg.text("請告訴我想問的照顧問題。如果動物有不舒服的狀況，請優先諮詢獸醫。", [{ label: "取消", data: "a=cancel" }]));
      return;
    case "contact":
      await ctx.setState({ mode: "contact" });
      await ctx.reply(msg.text("請留下想對協會說的話，人員看到後會回覆你。", [{ label: "取消", data: "a=cancel" }]));
      return;
    case "share":
      await ctx.setState({ mode: "share" });
      await ctx.reply(msg.text("歡迎傳牠的近況照片或文字給協會！", [{ label: "取消", data: "a=cancel" }]));
      return;
    default:
      await ctx.reply(msg.text("這個功能目前無法使用。"));
  }
}

// 同一則訊息裡只查一次名字，減少對 LINE 和資料庫的往返。
const names = new WeakMap<Ctx, Promise<string>>();
function displayName(ctx: Ctx) {
  let p = names.get(ctx);
  if (!p) {
    p = (async () => (await repo.getConversation(ctx.sid, ctx.userId))?.displayName ?? (await ctx.line.getDisplayName(ctx.userId)) ?? "領養人")();
    names.set(ctx, p);
  }
  return p;
}

async function handOff(ctx: Ctx, question: string, tag: "想退養" | "健康疑慮" | "緊急" | "其他", replyText: string, cards: LineMessage[]) {
  await repo.appendMessages(ctx.sid, ctx.userId, [{ from: "user", text: question }, { from: "ai", text: replyText }], { status: "待處理", tag, displayName: await displayName(ctx), lastAckAt: nowIso() });
  await ctx.setState({ mode: "none" });
  await ctx.reply(...cards);
  await logAi(ctx.sid, `轉人工：${tag}`, question, replyText, "已轉人工").catch(() => undefined);
}

async function adopterMessage(ctx: Ctx, m: NonNullable<LineEvent["message"]>) {
  const state = ctx.user.state;

  if (m.type === "image") {
    const { buffer } = await ctx.line.getContent(m.id);
    const photo = await savePhoto(ctx.sid, buffer);
    await repo.appendMessages(ctx.sid, ctx.userId, [{ from: "user", text: "（傳了一張照片）", photo }], { status: "待處理", tag: state.mode === "share" ? "近況" : "其他", displayName: await displayName(ctx) });
    await ctx.reply(msg.text("收到照片了，謝謝你！協會人員會看到。"));
    return;
  }
  if (m.type !== "text") { await ctx.reply(msg.text("目前可以傳文字或照片給我們喔。")); return; }

  const question = (m.text ?? "").trim();
  const code = question.toUpperCase();

  if (repo.APP_CODE_RE.test(code)) {
    const app = await repo.findApplicationByCode(ctx.sid, code);
    await ctx.setState({ mode: "none" });
    if (!app) { await ctx.reply(msg.text("找不到這個申請編號，請確認有沒有打錯。")); return; }
    await repo.linkApplicationLine(ctx.sid, app.id, ctx.userId);
    await ctx.reply(msg.applicationCard(app));
    return;
  }
  if (state.mode === "progress") { await ctx.reply(msg.text("申請編號是 LL- 開頭加上 6 碼，請再輸入一次。", [{ label: "取消", data: "a=cancel" }])); return; }

  // 第一道：關鍵字規則。健康和退養一律交給人，不經過 AI。
  if (REHOME_RE.test(question)) {
    const body = "謝謝你告訴我們。這件事需要協會人員一起討論，我已經請他們盡快聯絡你。";
    await handOff(ctx, question, "想退養", body, [msg.text(body), msg.handoffCard(ctx.shelter.name)]);
    return;
  }
  if (HEALTH_RE.test(question)) {
    const urgent = URGENT_RE.test(question);
    const body = urgent
      ? "聽起來情況比較緊急，請立刻聯絡或前往最近的動物醫院。我也已經通知協會人員。"
      : "我沒辦法判斷原因，也不建議自行用藥。如果情況持續或變嚴重，請盡快諮詢獸醫。我已經通知協會人員，他們會再跟你聯絡。";
    await handOff(ctx, question, urgent ? "緊急" : "健康疑慮", body, [msg.healthNoticeCard(body)]);
    return;
  }

  // 第二道：協會設定的常見問題完全相同時直接回答，不花 AI 額度。
  const faq = ctx.shelter.faq.find((f) => f.q === question);
  if (faq) {
    await repo.appendMessages(ctx.sid, ctx.userId, [{ from: "user", text: question }, { from: "ai", text: faq.a }], { displayName: await displayName(ctx) });
    await ctx.reply(msg.text(faq.a));
    return;
  }

  // 已有人在處理或使用者要找人時，不讓 AI 插話。
  const conv = await repo.getConversation(ctx.sid, ctx.userId);
  if (state.mode === "contact" || conv?.status === "待處理" || conv?.status === "處理中") {
    const lastAck = conv?.lastAckAt ? new Date(conv.lastAckAt).getTime() : 0;
    const shouldAck = state.mode === "contact" || Date.now() - lastAck > 60 * 60 * 1000;
    await repo.appendMessages(ctx.sid, ctx.userId, [{ from: "user", text: question }], {
      status: conv?.status === "處理中" ? "處理中" : "待處理", displayName: await displayName(ctx), ...(shouldAck ? { lastAckAt: nowIso() } : {}),
    });
    await ctx.setState({ mode: "none" });
    if (shouldAck) await ctx.reply(msg.text("收到，協會人員會盡快回覆你。"));
    return;
  }

  // 第三道：AI 回答，輸出仍要通過健康宣稱檢查。
  await ctx.line.showLoading(ctx.userId);
  const history = (conv?.messages ?? []).map((x) => `${x.from === "user" ? "領養人" : "協會"}：${x.text}`);
  const ans = await answerAdopter(ctx.sid, ctx.shelter, question, history);
  await ctx.setState({ mode: "none" });

  const blocked = findBannedClaim(ans.answer);
  if (blocked || ans.needsHuman || ans.intent === "health" || ans.intent === "rehoming") {
    const body = ans.intent === "health" || blocked
      ? "這個問題建議直接諮詢獸醫。我已經通知協會人員，他們會再跟你聯絡。"
      : ans.intent === "rehoming" ? "謝謝你告訴我們。這件事需要協會人員一起討論，我已經請他們盡快聯絡你。"
      : ans.answer || "這個問題我不確定，已經幫你轉給協會人員。";
    const tag = ans.intent === "health" || blocked ? "健康疑慮" : ans.intent === "rehoming" ? "想退養" : "其他";
    if (blocked) await logAi(ctx.sid, "AI 回答被攔下", question, ans.answer, "已攔截").catch(() => undefined);
    await handOff(ctx, question, tag, body, ans.intent === "health" || blocked ? [msg.healthNoticeCard(body)] : [msg.text(body), msg.handoffCard(ctx.shelter.name)]);
    return;
  }

  const withNotice = ans.intent === "care_general" ? `${ans.answer}\n\n${HEALTH_NOTICE}` : ans.answer;
  await repo.appendMessages(ctx.sid, ctx.userId, [{ from: "user", text: question }, { from: "ai", text: ans.answer }], { status: "AI 已回覆", displayName: await displayName(ctx) });
  await ctx.reply(msg.text(withNotice));
  await logAi(ctx.sid, ans.intent === "faq" ? "AI 問答：協會事務" : ans.intent === "care_general" ? "AI 問答：照顧問題" : "AI 問答", question, ans.answer, "正常").catch(() => undefined);
}
