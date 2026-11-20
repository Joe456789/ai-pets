import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }) }));

import { readSession, signSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { resetFileDb } from "@/lib/db/file";
import { shelterReport, shelterSuggestions } from "@/lib/insights";
import { verifyPassword } from "@/lib/password";
import * as platform from "@/lib/platform";
import * as repo from "@/lib/repo";
import type { AnimalDoc } from "@/lib/types";

const base = (over: Partial<AnimalDoc>): AnimalDoc => ({
  id: "a", code: "X-1", name: "測試", kind: "狗", sex: "公", age: "", ageGroup: "成年", size: "中型", coat: "", foundAt: "", area: "A 區", neutered: "是",
  status: "開放領養", intakeAt: new Date(Date.now() - 100 * 864e5).toISOString(), vaccineDue: "", traits: [], story: "", needs: [], goodFor: [], photos: [],
  tags: { energy: "中", beginnerOk: "是", kidOk: "是", apartmentOk: "是" }, published: true, ...over,
});

beforeEach(() => resetFileDb());

describe("登入狀態", () => {
  it("角色會被簽進 session，竄改後失效", () => {
    const token = signSession({ email: "a@b.c", sid: "s", role: "manager", exp: Date.now() / 1000 + 60 });
    expect(readSession(token)?.role).toBe("manager");
    const [body, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ email: "a@b.c", sid: "s", role: "admin", exp: Date.now() / 1000 + 60 })).toString("base64url");
    expect(readSession(`${forged}.${sig}`)).toBeNull();
    expect(readSession(`${body}.${sig}`)).not.toBeNull();
  });

  it("沒有角色的舊 session 不算登入", () => {
    const old = signSession({ email: "a@b.c", sid: "s", exp: Date.now() / 1000 + 60 } as never);
    expect(readSession(old)).toBeNull();
  });
});

describe("開通協會", () => {
  const input = { id: "test-shelter", name: "測試協會", area: "台北市", codePrefix: "ts", plan: "試用" as const, due: "2027/01/31", managerEmail: "Boss@Example.org", managerName: "王小明" };

  it("建立協會和管理者，臨時密碼可以登入，資料庫只存雜湊", async () => {
    const { shelter, password } = await platform.createShelterWithManager(input);
    expect(shelter.status).toBe("試用中");
    expect(shelter.codePrefix).toBe("TS");
    const manager = await repo.getManager("boss@example.org");
    expect(manager?.sid).toBe("test-shelter");
    expect(manager?.passwordHash).not.toContain(password);
    expect(verifyPassword(password, manager!.passwordHash)).toBe(true);
  });

  it("代號或電子郵件重複時拒絕", async () => {
    await platform.createShelterWithManager(input);
    await expect(platform.createShelterWithManager({ ...input, managerEmail: "other@example.org" })).rejects.toThrow("代號");
    await expect(platform.createShelterWithManager({ ...input, id: "another" })).rejects.toThrow("電子郵件");
  });

  it("重設密碼後舊密碼失效", async () => {
    const { password } = await platform.createShelterWithManager(input);
    const next = await platform.resetManagerPassword("boss@example.org");
    const m = await repo.getManager("boss@example.org");
    expect(verifyPassword(password, m!.passwordHash)).toBe(false);
    expect(verifyPassword(next, m!.passwordHash)).toBe(true);
  });
});

describe("停用與公開頁", () => {
  it("停用的協會不出現在公開頁", async () => {
    const db = getDb();
    await db.set("shelters/on", { id: "on", status: "使用中" });
    await db.set("shelters/off", { id: "off", status: "已停用" });
    await db.set("publicAnimals/on__a", { id: "on__a", sid: "on" });
    await db.set("publicAnimals/off__b", { id: "off__b", sid: "off" });
    expect((await repo.listPublicAnimals()).map((a) => a.id)).toEqual(["on__a"]);
  });

  it("標記已領養會記下日期並從公開頁移除", async () => {
    const db = getDb();
    await db.set("shelters/s", { id: "s", name: "協會", area: "", status: "使用中" });
    await db.set("shelters/s/animals/a", base({}));
    await repo.publishAnimal("s", "a");
    await repo.unpublishAnimal("s", "a", "已領養");
    const a = await repo.getAnimal("s", "a");
    expect(a?.adoptedAt).toBeTruthy();
    expect(await repo.getPublicAnimal("s__a")).toBeNull();
  });
});

describe("紀錄", () => {
  it("最近紀錄由新到舊，AI 紀錄只留前 200 字", async () => {
    await platform.logAi("s", "AI 問答", "很長".repeat(200), "回答", "正常");
    await new Promise((r) => setTimeout(r, 5));
    await platform.logAi("s", "AI 問答", "第二筆", "回答", "已攔截");
    const logs = await platform.listAiLogs();
    expect(logs[0].input).toBe("第二筆");
    expect(logs[1].input.length).toBeLessThanOrEqual(201);
  });
});

describe("AI 建議與報表", () => {
  it("找出久未被申請、需要留意和資料不完整的動物", async () => {
    const db = getDb();
    await db.set("shelters/s/animals/old", base({ id: "old", name: "老大", photos: [] }));
    await db.set("shelters/s/animals/sick", base({ id: "sick", name: "小病", flaggedUntil: new Date(Date.now() + 864e5).toISOString(), flagNote: "沒吃", photos: ["/x"] }));
    const kinds = (await shelterSuggestions("s")).map((x) => `${x.kind}:${x.title}`);
    expect(kinds).toContain("送養:優先曝光：老大");
    expect(kinds).toContain("照護:留意：小病");
    expect(kinds.some((k) => k.startsWith("資料:"))).toBe(true);
  });

  it("報表依領養日期分月，並算出領養前平均收容天數", async () => {
    const db = getDb();
    const adoptedAt = new Date().toISOString();
    await db.set("shelters/s/animals/x", base({ id: "x", status: "已領養", adoptedAt, intakeAt: new Date(Date.now() - 30 * 864e5).toISOString() }));
    const r = await shelterReport("s");
    const thisMonth = r.perMonth.at(-1)!;
    expect(thisMonth.adopted).toBe(1);
    expect(thisMonth.avgDays).toBe(30);
  });
});
