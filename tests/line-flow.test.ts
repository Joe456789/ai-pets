import { rmSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

const lineCalls = vi.hoisted(() => ({ replies: [] as { messages: Record<string, unknown>[] }[], pushes: [] as { to: string; messages: unknown[] }[] }));
const ai = vi.hoisted(() => ({ generateJson: vi.fn() }));

vi.mock("@/lib/line/client", async (orig) => {
  const actual = await orig<typeof import("@/lib/line/client")>();
  return {
    ...actual,
    lineClient: () => ({
      reply: async (_t: string, _u: string, messages: Record<string, unknown>[]) => { lineCalls.replies.push({ messages }); },
      push: async (to: string, messages: unknown[]) => { lineCalls.pushes.push({ to, messages }); },
      getContent: async () => ({ buffer: await sharp({ create: { width: 40, height: 60, channels: 3, background: "#fafafa" } }).jpeg().toBuffer(), contentType: "image/jpeg" }),
      showLoading: async () => undefined,
      getDisplayName: async () => "測試飼主",
    }),
  };
});
vi.mock("@/lib/ai/gemini", async (orig) => {
  const actual = await orig<typeof import("@/lib/ai/gemini")>();
  return { ...actual, generateJson: ai.generateJson };
});

import { getDb } from "@/lib/db";
import { resetFileDb } from "@/lib/db/file";
import { addMonths } from "@/lib/care";
import { lessonById, quizOf } from "@/lib/lessons";
import { handleLineEvents, sendLessons, sendReminders, type LineEvent } from "@/lib/line/handler";
import { scopeOf } from "@/lib/media";
import * as repo from "@/lib/repo";
import { taipeiDate } from "@/lib/time";
import { workerAuthorized } from "@/lib/worker";

const U = "U0123456789abcdef0123456789abcdef";
let seq = 0;
const ev = (e: Partial<LineEvent>) => handleLineEvents([{ type: "message", webhookEventId: `e${seq++}`, replyToken: `r${seq}`, source: { type: "user", userId: U }, ...e } as LineEvent]);
const say = (text: string) => ev({ message: { type: "text", id: "m", text } });
const photo = () => ev({ message: { type: "image", id: "img" } });
const press = (data: string) => ev({ type: "postback", postback: { data } });
const lastText = () => JSON.stringify(lineCalls.replies.at(-1)!.messages);
const tokenFrom = (s: string) => /t=([0-9a-f]{8})/.exec(s)?.[1] ?? "";

const future = taipeiDate(new Date(Date.now() + 10 * 864e5));
const draft = {
  isMedicalDoc: true, visitDate: "2026/11/10", clinic: "示範動物醫院", items: [{ name: "耳道檢查", note: "" }],
  meds: [{ name: "耳滴劑", usage: "一天兩次" }], followUp: future.replaceAll("-", "/"), total: 1200,
  terms: [{ term: "外耳炎", plain: "外耳道發炎的統稱" }],
};

beforeEach(async () => {
  resetFileDb();
  lineCalls.replies.length = 0;
  lineCalls.pushes.length = 0;
  ai.generateJson.mockReset();
  await repo.setLineCreds({ channelSecret: "s", channelAccessToken: "t" });
});
afterAll(() => rmSync(join(process.cwd(), ".data", "files", scopeOf(U)), { recursive: true, force: true }));

describe("LINE 飼主流程", () => {
  it("加好友會建立飼主並打招呼", async () => {
    await ev({ type: "follow" });
    expect(lastText()).toContain("從此有你");
    expect((await repo.getOwner(U))?.displayName).toBe("測試飼主");
  });

  it("還沒有毛孩時，拍醫療單據會請他先新增", async () => {
    await press("a=record");
    expect(lastText()).toContain("先新增你的毛孩");
  });

  it("拍單據 → AI 整理 → 確認存檔，有回診日就排提醒", async () => {
    const pet = await repo.savePet(U, { name: "麻糬", kind: "貓" });
    await press("a=record");
    expect(lastText()).toContain("麻糬的看診單據");
    ai.generateJson.mockResolvedValueOnce(draft);
    await photo();
    const card = lastText();
    expect(card).toContain("請確認");
    expect(card).toContain("外耳炎");
    expect(card).toContain("不是診斷");
    await press(`a=record_ok&t=${tokenFrom(card)}`);
    expect(lastText()).toContain("已存到麻糬的醫療紀錄");
    const recs = await repo.listRecords(U, pet.id);
    expect(recs).toHaveLength(1);
    expect(recs[0]).toMatchObject({ visitDate: "2026-11-10", followUp: future, total: 1200 });
    expect(recs[0].photo).toMatch(/^\/files\/o-/);
    // 同一張卡片按第二次不會重複存
    await press(`a=record_ok&t=${tokenFrom(card)}`);
    expect(lastText()).toContain("處理過");
    expect(await repo.listRecords(U, pet.id)).toHaveLength(1);
  });

  it("不是單據的照片不會存，也不會留下照片", async () => {
    await repo.savePet(U, { name: "麻糬", kind: "貓" });
    await press("a=record");
    ai.generateJson.mockResolvedValueOnce({ ...draft, isMedicalDoc: false });
    await photo();
    expect(lastText()).toContain("不是動物醫院的單據");
  });

  it("沒選毛孩直接傳照片，會提示先按拍醫療單據", async () => {
    await photo();
    expect(lastText()).toContain("拍醫療單據");
    expect(ai.generateJson).not.toHaveBeenCalled();
  });

  it("講到健康狀況請他找獸醫，不交給 AI", async () => {
    await say("牠今天一直吐");
    expect(lastText()).toContain("獸醫");
    expect(ai.generateJson).not.toHaveBeenCalled();
    await say("牠抽搐了怎麼辦");
    expect(lastText()).toContain("立刻");
  });

  it("說出想放棄時先接住，給具體的下一步，也帶到生活變動檢查", async () => {
    await say("我真的養不下去了");
    expect(lastText()).toContain("新家");
    expect(lastText()).toContain("不要放養");
    expect(lastText()).toContain("生活變動檢查");
  });

  it("提到搬家、懷孕這類變動，請他做生活變動檢查；講到症狀還是先請他找獸醫", async () => {
    await say("下個月要搬家了");
    expect(lastText()).toContain("生活變動檢查");
    expect(lastText()).toContain("/change");
    await say("懷孕了牠一直吐");
    expect(lastText()).toContain("獸醫");
    expect(lastText()).not.toContain("生活變動檢查");
  });
});

describe("回診提醒", () => {
  it("明天要回診的推播一次，之後不重複", async () => {
    const tomorrow = taipeiDate(new Date(Date.now() + 864e5));
    await getDb().set("reminders/r1", { id: "r1", uid: U, petId: "p", petName: "麻糬", date: tomorrow, text: "麻糬明天要回診。", sent: false });
    await getDb().set("reminders/r2", { id: "r2", uid: repo.DEMO_UID, petId: "p", petName: "示範", date: tomorrow, text: "x", sent: false });
    expect(await sendReminders()).toBe(1);
    expect(lineCalls.pushes[0].to).toBe(U);
    expect(await sendReminders()).toBe(0);
  });

  it("生活變動的提醒帶到準備清單", async () => {
    const tomorrow = taipeiDate(new Date(Date.now() + 864e5));
    await repo.addReminder({ id: "chg-1", uid: U, petId: "p", petName: "麻糬", date: tomorrow, text: "再過一週就是麻糬的「搬家」了。", sent: false, kind: "生活變動", path: "/change/c1" });
    expect(await sendReminders()).toBe(1);
    const card = JSON.stringify(lineCalls.pushes[0].messages);
    expect(card).toContain("生活變動提醒");
    expect(card).toContain("/change/c1");
  });
});

describe("照顧日曆", () => {
  it("今天或明天到期的推播一次；按「完成了」算出下一次，重複按不會再往後推", async () => {
    const today = taipeiDate();
    const tomorrow = taipeiDate(new Date(Date.now() + 864e5));
    const lastMonth = addMonths(tomorrow, -1);
    const pet = await repo.savePet(U, { name: "麻糬", kind: "貓" });
    const c = await repo.addCare({ uid: U, petId: pet.id, petName: "麻糬", kind: "驅蟲", label: "體內外寄生蟲預防", everyMonths: 1, lastDone: lastMonth });
    expect(c.nextDue).toBe(tomorrow);
    // 不記得上次的，一加進來就到期，但不另外推播
    await repo.addCare({ uid: U, petId: pet.id, petName: "麻糬", kind: "疫苗", label: "疫苗補強", everyMonths: 12, lastDone: "" });
    await repo.addCare({ uid: repo.DEMO_UID, petId: "p", petName: "示範", kind: "驅蟲", label: "x", everyMonths: 1, lastDone: lastMonth });
    expect(await sendReminders(today)).toBe(1);
    expect(JSON.stringify(lineCalls.pushes[0].messages)).toContain(`a=care_done&c=${c.id}`);
    expect(await sendReminders(today)).toBe(0);

    await press(`a=care_done&c=${c.id}`);
    expect(lastText()).toContain("記下來了");
    const after = await repo.getCare(c.id);
    expect(after).toMatchObject({ lastDone: today, nextDue: addMonths(today, 1) });
    await press(`a=care_done&c=${c.id}`);
    expect((await repo.getCare(c.id))?.nextDue).toBe(addMonths(today, 1));
  });

  it("別人的照顧項目按不了", async () => {
    const c = await repo.addCare({ uid: "Uother", petId: "p", petName: "別人", kind: "驅蟲", label: "x", everyMonths: 1, lastDone: "" });
    await press(`a=care_done&c=${c.id}`);
    expect(lastText()).toContain("找不到");
    expect((await repo.getCare(c.id))?.lastDone).toBe("");
  });
});

describe("飼主小學堂", () => {
  it("在聊天室上課和答題，答過的會記下來，下一課換別的", async () => {
    await say("小學堂");
    const card = lastText();
    const id = /a=quiz&l=([a-z-]+)&c=0/.exec(card)?.[1] ?? "";
    expect(id).not.toBe("");
    const quiz = quizOf(lessonById(id)!);
    await press(`a=quiz&l=${id}&c=${quiz.answer}`);
    expect(lastText()).toContain("答對了");
    expect((await repo.listProgress(U))[0]).toMatchObject({ id, correct: true });
    await press("a=lesson");
    expect(lastText()).not.toContain(`l=${id}&`);
  });

  it("每月只推一次，示範和測試帳號不推", async () => {
    await repo.ensureOwner(U, "測試飼主");
    await repo.ensureOwner(repo.DEMO_UID, "示範");
    const now = new Date("2026-11-20T04:00:00Z");
    expect(await sendLessons(now)).toBe(1);
    expect(JSON.stringify(lineCalls.pushes[0].messages)).toContain("本月小學堂");
    expect(await sendLessons(now)).toBe(0);
    expect(await sendLessons(new Date("2026-12-01T04:00:00Z"))).toBe(1);
  });

  it("到了時機的課主動推，同一課不重推，兩次之間隔 7 天", async () => {
    await repo.ensureOwner(U, "測試飼主");
    await repo.savePet(U, { name: "小白", kind: "貓", birth: "2026-09" });
    const day = (d: number) => new Date(Date.UTC(2026, 10, d, 4));
    expect(await sendLessons(day(20))).toBe(1);
    const first = JSON.stringify(lineCalls.pushes[0].messages);
    expect(first).toContain("小學堂：疫苗和驅蟲");
    expect(first).toContain("2 個月大了，正是時候");
    expect(first).not.toContain("本月小學堂");
    // 隔天不推（主動推的也算本月一課，而且還沒滿 7 天）
    expect(await sendLessons(day(21))).toBe(0);
    // 7 天後推下一個時機剛好的課，不會再推疫苗
    expect(await sendLessons(day(27))).toBe(1);
    const second = JSON.stringify(lineCalls.pushes[1].messages);
    expect(second).not.toContain("小學堂：疫苗和驅蟲");
    expect(second).toContain("正是時候");
  });
});

describe("3D 工作站", () => {
  it("沒設定或錯誤的 token 都拒絕", () => {
    const req = (auth: string) => new Request("http://x/api/worker/next", { headers: { authorization: auth } });
    delete process.env.WORKER_TOKEN;
    expect(workerAuthorized(req("Bearer anything"))).toBe(false);
    process.env.WORKER_TOKEN = "a".repeat(32);
    expect(workerAuthorized(req("Bearer wrong"))).toBe(false);
    expect(workerAuthorized(req(`Bearer ${"a".repeat(32)}`))).toBe(true);
  });

  it("領任務照建立順序，太久沒回報的會重新排隊", async () => {
    const base = { uid: U, petId: "p", kind: "狗" as const, heightCm: 50, photos: ["/files/x/y.jpg"], memories: "" };
    const a = await repo.createMemorial({ ...base, petName: "先" });
    const b = await repo.createMemorial({ ...base, petName: "後" });
    expect((await repo.claimNextMemorial())?.id).toBe(a.id);
    expect((await repo.getMemorial(a.id))?.status).toBe("製作中");
    expect((await repo.claimNextMemorial())?.id).toBe(b.id);
    expect(await repo.claimNextMemorial()).toBeNull();
    // 0 毫秒就算太久：a 會重新被領走
    expect((await repo.claimNextMemorial(0))?.id).toBe(a.id);
  });
});
