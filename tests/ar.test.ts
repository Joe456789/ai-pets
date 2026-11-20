import { beforeEach, describe, expect, it, vi } from "vitest";

const ai = vi.hoisted(() => ({ generateJson: vi.fn() }));
vi.mock("@/lib/ai/gemini", async (orig) => ({ ...(await orig<typeof import("@/lib/ai/gemini")>()), generateJson: ai.generateJson }));

import { estimateHeightCm, fallbackPersona, reactionsFor } from "@/lib/ar";
import { getDb } from "@/lib/db";
import { resetFileDb } from "@/lib/db/file";
import { getPersona } from "@/lib/persona";
import type { PublicAnimal } from "@/lib/types";

const animal: PublicAnimal = {
  id: "s__a", sid: "s", animalId: "a", shelterName: "協會", shelterArea: "新北市", publishedAt: "2026-11-01T00:00:00.000Z",
  name: "阿福", kind: "狗", sex: "公", age: "約 6 歲", ageGroup: "成年", size: "大型", coat: "黃色", neutered: "是",
  traits: ["親人", "穩定"], story: "阿福是園區裡的大哥。不太愛吵鬧。", needs: ["需要足夠活動空間"], goodFor: ["有院子"], photos: [],
  tags: { energy: "中", beginnerOk: "是", kidOk: "未知", apartmentOk: "否" },
};
const good = { intro: "我是阿福，大家說我很親人。", likes: "我喜歡找有太陽的地方趴著。", home: "有院子的家可能很適合我。", firstMeet: "先讓我聞聞你的手。" };

beforeEach(async () => {
  resetFileDb();
  ai.generateJson.mockReset();
  await getDb().set("publicAnimals/s__a", animal);
});

describe("體型與反應", () => {
  it("依種類和體型估計高度", () => {
    expect(estimateHeightCm({ kind: "狗", size: "大型" })).toBe(80);
    expect(estimateHeightCm({ kind: "狗", size: "小型" })).toBe(40);
    expect(estimateHeightCm({ kind: "貓", size: "中型" })).toBe(30);
  });

  it("慢熟的動物第一次點會先躲，最後都有歪頭", () => {
    expect(reactionsFor(["慢熟", "愛散步"])).toEqual(["shy", "tilt"]);
    expect(reactionsFor(["親人", "活潑"])).toEqual(["approach", "hop", "tilt"]);
    expect(reactionsFor([])).toEqual(["tilt"]);
  });

  it("沒有 AI 時的自我介紹只用協會資料", () => {
    const p = fallbackPersona(animal);
    expect(p.ai).toBe(false);
    expect(p.intro).toContain("阿福");
    expect(p.intro).toContain("親人");
    expect(p.qa[2].a).toContain("需要足夠活動空間");
  });
});

describe("AI 自我介紹", () => {
  it("同一次發布只呼叫一次 AI，之後用存下的結果", async () => {
    ai.generateJson.mockResolvedValue(good);
    const a = await getPersona("s__a");
    const b = await getPersona("s__a");
    expect(a?.ai).toBe(true);
    expect(b?.intro).toBe(good.intro);
    expect(ai.generateJson).toHaveBeenCalledTimes(1);
  });

  it("重新發布後會重新產生", async () => {
    ai.generateJson.mockResolvedValue(good);
    await getPersona("s__a");
    await getDb().set("publicAnimals/s__a", { ...animal, publishedAt: "2026-11-08T00:00:00.000Z" });
    await getPersona("s__a");
    expect(ai.generateJson).toHaveBeenCalledTimes(2);
  });

  it("出現健康宣稱就不用 AI 的內容，也不存起來", async () => {
    ai.generateJson.mockResolvedValueOnce({ ...good, home: "我保證健康，一定沒問題" });
    const p = await getPersona("s__a");
    expect(p?.ai).toBe(false);
    expect(JSON.stringify(p)).not.toContain("保證");
    expect(await getDb().get("personas/s__a")).toBeNull();
  });

  it("AI 失敗時改用固定文字，未發布的動物沒有自我介紹", async () => {
    ai.generateJson.mockRejectedValueOnce(new Error("逾時"));
    expect((await getPersona("s__a"))?.ai).toBe(false);
    expect(await getPersona("s__nope")).toBeNull();
  });
});
