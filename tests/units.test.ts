import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { findBannedClaim } from "@/lib/ai/guard";
import { verifySignature } from "@/lib/line/client";
import { rankAnimals, scoreAnimal, type MatchAnswers } from "@/lib/match";
import { readPhoto } from "@/lib/media";
import { hashPassword, verifyPassword } from "@/lib/password";
import { hasConsecutiveConcern } from "@/lib/repo";
import type { CareDoc, PublicAnimal } from "@/lib/types";

const pet = (over: Partial<PublicAnimal>): PublicAnimal => ({
  id: "x", sid: "s", animalId: "x", shelterName: "協會", shelterArea: "新北市", publishedAt: "", name: "測試", kind: "狗", sex: "公", age: "", ageGroup: "成年", size: "中型",
  coat: "", neutered: "是", traits: [], story: "", needs: [], goodFor: [], photos: [], tags: { energy: "未知", beginnerOk: "未知", kidOk: "未知", apartmentOk: "未知" }, ...over,
});
const person: MatchAnswers = { housing: "公寓或大樓", time: "1～3 小時", experience: "第一次養", family: "沒有", budget: "2,000～5,000 元", preference: "都可以" };

describe("媒合計分", () => {
  it("條件都符合時是滿分", () => {
    const a = pet({ tags: { energy: "中", beginnerOk: "是", kidOk: "是", apartmentOk: "是" } });
    expect(scoreAnimal(a, person).score).toBe(100);
  });

  it("高活動量的動物配上陪伴時間少的人，分數明顯較低", () => {
    const active = pet({ tags: { energy: "高", beginnerOk: "是", kidOk: "是", apartmentOk: "是" } });
    const calm = pet({ tags: { energy: "低", beginnerOk: "是", kidOk: "是", apartmentOk: "是" } });
    const busy: MatchAnswers = { ...person, time: "1 小時以內" };
    expect(scoreAnimal(calm, busy).score - scoreAnimal(active, busy).score).toBe(25);
  });

  it("資料未知時給中間分數，不算滿分也不算零分", () => {
    const { score } = scoreAnimal(pet({}), person);
    expect(score).toBeGreaterThan(30);
    expect(score).toBeLessThan(80);
  });

  it("只推薦想要的種類，最多 3 隻，高分排前面", () => {
    const list = [
      pet({ id: "cat", name: "貓", kind: "貓" }),
      pet({ id: "d1", name: "甲", tags: { energy: "高", beginnerOk: "否", kidOk: "否", apartmentOk: "否" } }),
      pet({ id: "d2", name: "乙", tags: { energy: "中", beginnerOk: "是", kidOk: "是", apartmentOk: "是" } }),
    ];
    const ranked = rankAnimals(list, { ...person, preference: "狗" });
    expect(ranked.map((r) => r.animal.id)).toEqual(["d2", "d1"]);
  });
});

describe("健康宣稱檢查", () => {
  it.each(["保證健康又活潑", "可能是腸胃炎", "獸醫診斷為皮膚病", "可以治癒", "先餵牠吃止痛藥", "不用看獸醫", "一定會好"])("攔下：%s", (t) => {
    expect(findBannedClaim(t)).not.toBeNull();
  });
  it.each(["牠很親人，喜歡散步", "建議諮詢獸醫", "每天需要陪玩", "個性溫和，適合第一次養狗的人"])("放行：%s", (t) => {
    expect(findBannedClaim(t)).toBeNull();
  });
});

describe("LINE 簽章", () => {
  const body = JSON.stringify({ events: [] });
  const sign = (secret: string) => createHmac("sha256", secret).update(body).digest("base64");
  it("正確簽章通過", () => expect(verifySignature("secret", body, sign("secret"))).toBe(true));
  it("錯誤密鑰失敗", () => expect(verifySignature("secret", body, sign("other"))).toBe(false));
  it("沒有簽章失敗", () => expect(verifySignature("secret", body, null)).toBe(false));
  it("內容被改過失敗", () => expect(verifySignature("secret", `${body} `, sign("secret"))).toBe(false));
});

describe("照片路徑", () => {
  it.each([["nuanwo", "../../db.json"], ["../x", "a.jpg"], ["nuanwo", "not-a-uuid.jpg"], ["NU AN", "00000000-0000-0000-0000-000000000000.jpg"]])("拒絕 %s / %s", async (sid, file) => {
    expect(await readPhoto(sid, file)).toBeNull();
  });
});

describe("密碼", () => {
  it("正確密碼通過、錯誤密碼失敗", () => {
    const h = hashPassword("correct horse");
    expect(verifyPassword("correct horse", h)).toBe(true);
    expect(verifyPassword("wrong", h)).toBe(false);
  });
});

describe("連續留意判斷", () => {
  const log = (daysAgo: number, category: CareDoc["category"] = "食慾", concerning = true): CareDoc => ({ id: String(daysAgo), animalId: "a", at: new Date(Date.now() - daysAgo * 864e5).toISOString(), who: "", text: "", category, concerning });
  it("今天和昨天都有才成立", () => expect(hasConsecutiveConcern([log(0), log(1)], "食慾")).toBe(true));
  it("只有今天不成立", () => expect(hasConsecutiveConcern([log(0)], "食慾")).toBe(false));
  it("不同類別不算連續", () => expect(hasConsecutiveConcern([log(0), log(1, "排便")], "食慾")).toBe(false));
  it("昨天的例行紀錄不算", () => expect(hasConsecutiveConcern([log(0), log(1, "食慾", false)], "食慾")).toBe(false));
});
