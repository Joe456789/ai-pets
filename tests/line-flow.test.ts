import { rmSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import sharp from "sharp";

const lineCalls = vi.hoisted(() => ({
  replies: [] as { messages: Record<string, unknown>[] }[],
  pushes: [] as unknown[],
  linked: [] as string[],
  unlinked: [] as string[],
}));
const ai = vi.hoisted(() => ({ generateJson: vi.fn() }));

vi.mock("@/lib/line/client", async (orig) => {
  const actual = await orig<typeof import("@/lib/line/client")>();
  return {
    ...actual,
    lineClient: () => ({
      reply: async (_t: string, _u: string, messages: Record<string, unknown>[]) => { lineCalls.replies.push({ messages }); },
      push: async (_u: string, m: unknown) => { lineCalls.pushes.push(m); },
      getContent: async (id: string) => id.startsWith("img")
        ? { buffer: await sharp({ create: { width: 20, height: 20, channels: 3, background: "#c98f45" } }).png().toBuffer(), contentType: "image/png" }
        : { buffer: Buffer.from("fake-audio"), contentType: "audio/x-m4a" },
      showLoading: async () => undefined,
      getDisplayName: async () => "測試領養人",
      linkRichMenu: async (_u: string, id: string) => { lineCalls.linked.push(id); },
      unlinkRichMenu: async (u: string) => { lineCalls.unlinked.push(u); },
    }),
  };
});
vi.mock("@/lib/ai/gemini", async (orig) => {
  const actual = await orig<typeof import("@/lib/ai/gemini")>();
  return { ...actual, generateJson: ai.generateJson };
});

import { resetFileDb } from "@/lib/db/file";
import { handleLineEvents, type LineEvent } from "@/lib/line/handler";
import * as repo from "@/lib/repo";
import { getDb } from "@/lib/db";

const SID = "nuanwo";
const STAFF = "U-staff";
const ADOPTER = "U-adopter";
let seq = 0;

const send = (userId: string, message: LineEvent["message"]) =>
  handleLineEvents(SID, [{ type: "message", webhookEventId: `e${seq++}`, replyToken: `r${seq}`, source: { type: "user", userId }, message }]);
const say = (userId: string, text: string) => send(userId, { type: "text", id: "m", text });
const press = (userId: string, data: string) =>
  handleLineEvents(SID, [{ type: "postback", webhookEventId: `e${seq++}`, replyToken: `r${seq}`, source: { type: "user", userId }, postback: { data } }]);

const lastReply = () => lineCalls.replies.at(-1)!.messages;
const lastText = () => JSON.stringify(lastReply());
const tokenFrom = (reply: string) => /t=([0-9a-f]{8})/.exec(reply)?.[1] ?? "";

const animal = (id: string, name: string, code: string) => ({
  id, name, code, kind: "狗", sex: "公", age: "3 歲", ageGroup: "成年", size: "中型", coat: "黑", foundAt: "", area: "A 區", neutered: "是", status: "在所照護",
  intakeAt: new Date(Date.now() - 864e5 * 10).toISOString(), vaccineDue: "", traits: [], story: "", needs: [], goodFor: [], photos: [],
  tags: { energy: "未知", beginnerOk: "未知", kidOk: "未知", apartmentOk: "未知" }, published: false,
});

beforeEach(async () => {
  resetFileDb();
  lineCalls.replies.length = 0;
  lineCalls.pushes.length = 0;
  lineCalls.linked.length = 0;
  lineCalls.unlinked.length = 0;
  ai.generateJson.mockReset();
  const db = getDb();
  await db.set(`shelters/${SID}`, { id: SID, name: "暖窩動物協會", area: "新北市", intro: "", hours: "週三至週日", phone: "", codePrefix: "NW", areas: ["A 區", "B 區"], faq: [{ q: "領養要多少錢？", a: "領養不收費。" }], plan: "基本", due: "", status: "使用中" });
  await repo.setLineCreds(SID, { channelSecret: "s", channelAccessToken: "t", staffMenuId: "menu-staff", adopterMenuId: "menu-adopter" });
  await db.set(`shelters/${SID}/staff/A27391568`, { code: "A27391568", name: "林小芸", role: "現場人員", area: "A 區、B 區", disabled: false });
  await db.set(`shelters/${SID}/animals/a1`, animal("a1", "小黑", "NW-0001"));
  await db.set(`shelters/${SID}/animals/a2`, animal("a2", "阿福", "NW-0002"));
});

describe("工作號綁定", () => {
  it("正確的工作號會綁定並切換成工作選單", async () => {
    await say(STAFF, "A27391568");
    expect(lineCalls.linked).toEqual(["menu-staff"]);
    expect(lastText()).toContain("綁定成功");
    expect((await repo.getStaff(SID, "A27391568"))?.lineUserId).toBe(STAFF);
  });

  it("已被別人綁定的工作號不能再用，訊息和打錯時相同", async () => {
    await say(STAFF, "A27391568");
    await say("U-other", "A27391568");
    const taken = lastText();
    await say("U-other", "Z00000000");
    expect(lastText()).toBe(taken);
    expect(lineCalls.linked).toHaveLength(1);
  });

  it("連續猜錯 5 次會被暫停，猜對也不會成功", async () => {
    for (let i = 0; i < 5; i++) await say("U-guess", "Z00000000");
    await say("U-guess", "A27391568");
    expect(lastText()).toContain("嘗試次數太多");
    expect((await repo.getStaff(SID, "A27391568"))?.lineUserId).toBeUndefined();
  });

  it("建立超過 7 天還沒綁定的工作號會失效", async () => {
    const s = await repo.createStaff(SID, { name: "新人", role: "志工", area: "A 區" });
    expect(s.code).toMatch(/^[A-HJ-NP-Z]\d{8}$/);
    await repo.updateStaff(SID, s.code, { createdAt: new Date(Date.now() - 8 * 864e5).toISOString() });
    await say("U-new", s.code);
    expect(lastText()).toContain("無法使用");
  });

  it("工作號停用後，下一則訊息就失去人員權限", async () => {
    await say(STAFF, "A27391568");
    await repo.updateStaff(SID, "A27391568", { disabled: true });
    await press(STAFF, "a=digest");
    expect(lineCalls.unlinked).toEqual([STAFF]);
    expect(lastText()).not.toContain("今日摘要");
  });
});

describe("新增動物", () => {
  const draft = { kind: "狗", sex: "公", name: "", age: "約 2 歲", ageGroup: "成年", size: "中型", coat: "棕色", foundAt: "大河路", neutered: "否", traits: ["親人"], notes: "" };

  it("AI 整理後要人員確認才會存檔", async () => {
    await say(STAFF, "A27391568");
    await press(STAFF, "a=intake");
    ai.generateJson.mockResolvedValueOnce(draft);
    await send(STAFF, { type: "audio", id: "voice1" });
    expect(lastText()).toContain("請確認");
    expect((await repo.listAnimals(SID)).length).toBe(2);

    await press(STAFF, `a=intake_ok&t=${tokenFrom(lastText())}`);
    const animals = await repo.listAnimals(SID);
    expect(animals.length).toBe(3);
    const created = animals.find((a) => a.foundAt === "大河路")!;
    expect(created.published).toBe(false);
    expect(created.status).toBe("在所照護");
    expect(created.name).toBe("待取名");
    expect(lastText()).toContain("已建檔");
  });

  it("照片和語音都會送給 AI，照片會存到動物檔案", async () => {
    await say(STAFF, "A27391568");
    await press(STAFF, "a=intake");
    await send(STAFF, { type: "image", id: "img1" });
    expect(lastText()).toContain("第 1 張");
    ai.generateJson.mockResolvedValueOnce(draft);
    await send(STAFF, { type: "audio", id: "voice1" });

    const parts = ai.generateJson.mock.calls[0][0].parts as { inlineData?: { mimeType: string } }[];
    expect(parts.map((p) => p.inlineData?.mimeType).filter(Boolean)).toEqual(["image/jpeg", "audio/mp4"]);

    await press(STAFF, `a=intake_ok&t=${tokenFrom(lastText())}`);
    const created = (await repo.listAnimals(SID)).find((a) => a.foundAt === "大河路")!;
    expect(created.photos).toHaveLength(1);
    const [, , , sid, file] = created.photos[0].split("/").length === 4 ? ["", "", "", created.photos[0].split("/")[2], created.photos[0].split("/")[3]] : [];
    const { readPhoto } = await import("@/lib/media");
    const saved = (await readPhoto(sid as string, file as string))!;
    expect((await sharp(saved).metadata()).format).toBe("jpeg");
    rmSync(join(process.cwd(), ".data", "media", sid as string, file as string));
  });

  it("舊卡片的確認按鈕不會重複存檔", async () => {
    await say(STAFF, "A27391568");
    await press(STAFF, "a=intake");
    ai.generateJson.mockResolvedValueOnce(draft);
    await say(STAFF, "新進一隻棕色公狗");
    const token = tokenFrom(lastText());
    await press(STAFF, `a=intake_ok&t=${token}`);
    await press(STAFF, `a=intake_ok&t=${token}`);
    expect((await repo.listAnimals(SID)).length).toBe(3);
    expect(lastText()).toContain("已經處理過");
  });
});

describe("回報照護", () => {
  const parsed = {
    areas: ["A 區"],
    entries: [
      { animalId: "a1", mentionedName: "小黑", text: "今天沒吃", category: "食慾", concerning: true },
      { animalId: "捏造的ID", mentionedName: "阿福", text: "拉肚子", category: "排便", concerning: true },
      { animalId: "捏造的ID", mentionedName: "不存在的狗", text: "精神不好", category: "精神", concerning: true },
    ],
  };

  it("一句話拆成多筆，AI 給的 ID 會再驗證，對不上的不存檔", async () => {
    await say(STAFF, "A27391568");
    await press(STAFF, "a=care");
    ai.generateJson.mockResolvedValueOnce(parsed);
    await say(STAFF, "A 區都正常，小黑今天沒吃，阿福拉肚子");
    expect(lastText()).toContain("找不到");
    await press(STAFF, `a=care_ok&t=${tokenFrom(lastText())}`);

    const care = await repo.listCare(SID);
    expect(care.map((c) => c.animalId).sort()).toEqual(["a1", "a2"]);
    expect((await repo.listAreaReportsToday(SID)).map((r) => r.area)).toEqual(["A 區"]);
    expect(repo.isFlagged((await repo.getAnimal(SID, "a1"))!)).toBe(true);
  });

  it("連續 2 天同類回報才發出留意提醒，且附官方提示文字", async () => {
    await getDb().set(`shelters/${SID}/care/old`, { id: "old", animalId: "a1", at: new Date(Date.now() - 864e5).toISOString(), who: "x", text: "昨天沒吃", category: "食慾", concerning: true });
    await say(STAFF, "A27391568");
    await press(STAFF, "a=care");
    ai.generateJson.mockResolvedValueOnce({ areas: [], entries: [parsed.entries[0]] });
    await say(STAFF, "小黑今天沒吃");
    await press(STAFF, `a=care_ok&t=${tokenFrom(lastText())}`);
    expect(lastText()).toContain("請留意：小黑");
    expect(lastText()).toContain("不能取代獸醫師");
  });

  it("只回報一天不會發提醒", async () => {
    await say(STAFF, "A27391568");
    await press(STAFF, "a=care");
    ai.generateJson.mockResolvedValueOnce({ areas: [], entries: [parsed.entries[1]] });
    await say(STAFF, "阿福拉肚子");
    await press(STAFF, `a=care_ok&t=${tokenFrom(lastText())}`);
    expect(lastText()).not.toContain("請留意");
  });
});

describe("領養人", () => {
  it("健康問題不經過 AI，直接提醒找獸醫並轉人工", async () => {
    await say(ADOPTER, "狗狗一直吐，要先餵藥嗎");
    expect(ai.generateJson).not.toHaveBeenCalled();
    expect(lastText()).toContain("不能取代獸醫師");
    const conv = await repo.getConversation(SID, ADOPTER);
    expect(conv?.status).toBe("待處理");
    expect(conv?.tag).toBe("健康疑慮");
  });

  it("想退養不經過 AI，直接轉人工", async () => {
    await say(ADOPTER, "最近要搬家，可能沒辦法繼續養了");
    expect(ai.generateJson).not.toHaveBeenCalled();
    expect(lastText()).toContain("已轉給協會人員");
    expect((await repo.getConversation(SID, ADOPTER))?.tag).toBe("想退養");
  });

  it("常見問題完全相同時直接回答，不花 AI 額度", async () => {
    await say(ADOPTER, "領養要多少錢？");
    expect(ai.generateJson).not.toHaveBeenCalled();
    expect(lastText()).toContain("領養不收費");
  });

  it("AI 的回答若出現健康宣稱會被攔下，改成建議諮詢獸醫", async () => {
    ai.generateJson.mockResolvedValueOnce({ intent: "care_general", answer: "這款飼料保證健康又有效", needsHuman: false });
    await say(ADOPTER, "新家要怎麼布置比較好");
    expect(lastText()).not.toContain("保證");
    expect(lastText()).toContain("諮詢獸醫");
    expect((await repo.getConversation(SID, ADOPTER))?.status).toBe("待處理");
  });

  it("一般照顧問題由 AI 回答並附官方提示文字", async () => {
    ai.generateJson.mockResolvedValueOnce({ intent: "care_general", answer: "可以先準備安靜的角落和水碗。", needsHuman: false });
    await say(ADOPTER, "新家要怎麼布置比較好");
    expect(lastText()).toContain("安靜的角落");
    expect(lastText()).toContain("不能取代獸醫師");
  });

  it("人員處理中時 AI 不插話，訊息仍會記錄", async () => {
    await say(ADOPTER, "最近要搬家，可能沒辦法繼續養了");
    await say(ADOPTER, "什麼時候會有人回我");
    expect(ai.generateJson).not.toHaveBeenCalled();
    expect((await repo.getConversation(SID, ADOPTER))?.messages.at(-1)?.text).toBe("什麼時候會有人回我");
  });

  it("用申請編號可以查進度，查不到不會洩漏資料", async () => {
    const app = await repo.createApplication(SID, { animalId: "a2", animalName: "阿福", who: "王小姐", phone: "0912345678", housing: "公寓", family: "沒有", plan: "會帶著牠一起搬", message: "", score: 80, reason: "" });
    await say(ADOPTER, app.publicCode.toLowerCase());
    expect(lastText()).toContain("待審核");
    expect(lastText()).not.toContain("0912345678");
    await say(ADOPTER, "LL-ZZZZZZ");
    expect(lastText()).toContain("找不到");
  });
});

describe("平台紀錄", () => {
  it("AI 回答和轉人工都會留下紀錄給平台抽查", async () => {
    const { listAiLogs } = await import("@/lib/platform");
    ai.generateJson.mockResolvedValueOnce({ intent: "care_general", answer: "可以先準備安靜的角落。", needsHuman: false });
    await say(ADOPTER, "新家要怎麼布置比較好");
    await say("U-2", "最近要搬家，可能沒辦法繼續養了");
    const states = (await listAiLogs()).map((l) => l.state).sort();
    expect(states).toEqual(["已轉人工", "正常"]);
  });

  it("停用的協會不回應，也不呼叫 AI", async () => {
    await repo.updateShelter(SID, { status: "已停用" });
    await say(ADOPTER, "新家要怎麼布置比較好");
    expect(lineCalls.replies).toHaveLength(0);
    expect(ai.generateJson).not.toHaveBeenCalled();
  });

  it("處理失敗會記到系統錯誤", async () => {
    const { listErrors } = await import("@/lib/platform");
    ai.generateJson.mockRejectedValueOnce(new Error("模型逾時"));
    await say(ADOPTER, "新家要怎麼布置比較好");
    expect((await listErrors())[0]?.message).toContain("模型逾時");
  });
});

describe("事件處理", () => {
  it("重送的事件只處理一次", async () => {
    const event: LineEvent = { type: "message", webhookEventId: "same", replyToken: "r", source: { type: "user", userId: ADOPTER }, message: { type: "text", id: "m", text: "領養要多少錢？" } };
    await handleLineEvents(SID, [event]);
    await handleLineEvents(SID, [event]);
    expect(lineCalls.replies).toHaveLength(1);
  });

  it("AI 失敗時會回覆使用者，不會無聲無息", async () => {
    ai.generateJson.mockRejectedValueOnce(new Error("boom"));
    await say(ADOPTER, "新家要怎麼布置比較好");
    expect(lastText()).toContain("請再傳一次");
  });
});
