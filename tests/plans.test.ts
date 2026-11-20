import { beforeEach, describe, expect, it, vi } from "vitest";

const ai = vi.hoisted(() => ({ generateContent: vi.fn() }));
vi.mock("@google/genai", () => ({ GoogleGenAI: class { models = { generateContent: ai.generateContent }; } }));

import { z } from "zod";
import { AiUnavailableError, generateJson } from "@/lib/ai/gemini";
import { getDb } from "@/lib/db";
import { resetFileDb } from "@/lib/db/file";
import { aiCapOf, managerQuota, planExpired, staffQuota, trialDue, trialExpired } from "@/lib/plans";
import { monthKey } from "@/lib/time";
import type { ShelterDoc } from "@/lib/types";

const shelter = (over: Partial<ShelterDoc>) => ({ id: "s", name: "協會", plan: "基本", due: "2099/12/31", status: "使用中", ...over }) as ShelterDoc;
const call = () => generateJson({ scope: "s", system: "", parts: [{ text: "x" }], schema: z.object({ ok: z.boolean() }) });

beforeEach(() => {
  resetFileDb();
  process.env.GEMINI_API_KEY = "test";
  ai.generateContent.mockReset();
  ai.generateContent.mockResolvedValue({ text: '{"ok":true}', usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 2 } });
});

describe("方案限制", () => {
  it("AI 上限依方案，平台另外設定時以設定為準", () => {
    expect(aiCapOf(shelter({ plan: "試用" }))).toBe(300);
    expect(aiCapOf(shelter({ plan: "基本" }))).toBe(1000);
    expect(aiCapOf(shelter({ plan: "進階" }))).toBe(3000);
    expect(aiCapOf(shelter({ plan: "基本", aiCap: 50 }))).toBe(50);
    expect(aiCapOf(shelter({ plan: "基本", aiCap: null }))).toBe(1000);
  });

  it("用完方案的 AI 次數就停止呼叫", async () => {
    await getDb().set("shelters/s", shelter({ plan: "試用" }));
    await getDb().set(`usage/s__${monthKey()}`, { calls: 300 });
    await expect(call()).rejects.toBeInstanceOf(AiUnavailableError);
    expect(ai.generateContent).not.toHaveBeenCalled();
  });

  it("試用到期後 AI 暫停，付費方案到期仍可使用", async () => {
    await getDb().set("shelters/s", shelter({ plan: "試用", due: "2020/01/01" }));
    await expect(call()).rejects.toThrow("試用期已結束");
    await getDb().set("shelters/s", shelter({ plan: "基本", due: "2020/01/01" }));
    await expect(call()).resolves.toEqual({ ok: true });
    expect(planExpired(shelter({ due: "2020/01/01" }))).toBe(true);
    expect(trialExpired(shelter({ plan: "基本", due: "2020/01/01" }))).toBe(false);
  });

  it("試用到期日預設是 30 天後", () => {
    const due = trialDue(new Date("2026-11-06T04:00:00Z"));
    expect(due).toBe("2026/12/06");
  });

  it("工作號上限只算使用中的，停用的不佔名額；進階不限", async () => {
    const db = getDb();
    for (let i = 0; i < 5; i++) await db.set(`shelters/s/staff/A0000000${i}`, { code: `A0000000${i}`, disabled: i === 4 });
    expect(await staffQuota(shelter({ plan: "試用" }))).toEqual({ used: 4, limit: 5, full: false });
    await db.set("shelters/s/staff/A00000009", { code: "A00000009", disabled: false });
    expect((await staffQuota(shelter({ plan: "試用" }))).full).toBe(true);
    expect((await staffQuota(shelter({ plan: "進階" }))).full).toBe(false);
  });

  it("管理者帳號：基本 1 位、進階 3 位", async () => {
    await getDb().set("managers/a@x.org", { email: "a@x.org", sid: "s" });
    await getDb().set("managers/b@x.org", { email: "b@x.org", sid: "other" });
    expect((await managerQuota(shelter({ plan: "基本" }))).full).toBe(true);
    expect(await managerQuota(shelter({ plan: "進階" }))).toEqual({ used: 1, limit: 3, full: false });
  });
});
