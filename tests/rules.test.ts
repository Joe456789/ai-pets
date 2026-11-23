import { describe, expect, it } from "vitest";
import { findBannedClaim } from "@/lib/ai/guard";
import { addMonths, careSuggestions, dueLabel, nextDueOf, stageOf } from "@/lib/care";
import { LESSONS, lessonsFor, nextLesson, quizOf } from "@/lib/lessons";
import { verifySignature } from "@/lib/line/client";
import { ASSESS_BASIS, CHANGE_BASIS, SOURCES } from "@/lib/evidence";
import { CHANGE_KINDS, changeReminder, DETAILS, planChange } from "@/lib/lifeChange";
import { lifetimeCost } from "@/lib/lifetimeCost";
import { inLine, liffTarget } from "@/lib/liffState";
import { parseFileUrl, scopeOf, signedUrl, verifyFileSig } from "@/lib/media";
import { assessReadiness, costProfileOf } from "@/lib/readiness";
import { cleanDraft, monthlyReserve, normalizeDate, spendByYear } from "@/lib/records";
import type { AssessAnswers, ChangeAnswers, RecordDoc } from "@/lib/types";
import { createHmac } from "node:crypto";

const ideal: AssessAnswers = {
  kind: "狗", alone: "4 小時以內", activity: "1 小時以上", travel: "很少", budget: "6,000 元以上", fund: "3 萬元以上", housing: "自有住宅",
  space: "有院子", family: [], otherPets: "沒有", changes: [], experience: "養過貓或狗", backup: "家人或室友",
  ownerHealth: "應該可以", reason: "想了很久",
};

describe("飼養準備度", () => {
  it("條件都好的人是「準備好了」，沒有風險", () => {
    const r = assessReadiness(ideal);
    expect(r.verdict).toBe("準備好了");
    expect(r.total).toBeGreaterThanOrEqual(90);
    expect(r.risks).toEqual([]);
  });

  it("房東不同意一定是「先等等」，不管其他分數多高", () => {
    const r = assessReadiness({ ...ideal, housing: "租屋，房東不同意" });
    expect(r.verdict).toBe("先等等");
    expect(r.risks[0]).toMatchObject({ level: "高" });
  });

  it("有高風險時最多只到「再準備一下」", () => {
    const r = assessReadiness({ ...ideal, family: ["有人過敏"] });
    expect(r.verdict).toBe("再準備一下");
    expect(r.risks.some((x) => x.text.includes("過敏"))).toBe(true);
  });

  it("每天獨處很久又還沒決定時，建議養貓、成年", () => {
    const r = assessReadiness({ ...ideal, kind: "還沒決定", alone: "10 小時以上", space: "公寓或大樓" });
    expect(r.fit.kind).toBe("貓");
    expect(r.fit.age).toContain("成年");
    expect(costProfileOf(r.fit)).toBe("貓");
  });

  it("預算不夠會標出風險，並把高風險排在前面", () => {
    const r = assessReadiness({ ...ideal, budget: "2,000 元以內", fund: "沒有", backup: "還沒想過", changes: ["出國讀書或工作"] });
    expect(r.risks.some((x) => x.text.includes("預算"))).toBe(true);
    const levels = r.risks.map((x) => x.level);
    expect(levels.indexOf("中")).toBeGreaterThan(levels.lastIndexOf("高"));
  });

  it("套房養狗建議小型犬", () => {
    const r = assessReadiness({ ...ideal, space: "套房" });
    expect(r.fit.size).toBe("小型");
    expect(costProfileOf(r.fit)).toBe("小型犬");
  });

  it("想送給別人：提醒先確認對方自己想養（研究沒有支持列為高風險）", () => {
    const r = assessReadiness({ ...ideal, reason: "想送給別人" });
    expect(r.risks).toHaveLength(1);
    expect(r.risks[0]).toMatchObject({ level: "中" });
    expect(r.risks[0].text).toContain("對方自己一直想養");
  });

  it("每天陪玩不到 30 分鐘：狗會扣分並提醒，還沒決定時建議養貓、活動量低", () => {
    const dog = assessReadiness({ ...ideal, activity: "30 分鐘以內" });
    expect(dog.dims.find((d) => d.key === "time")!.score).toBe(75);
    expect(dog.risks.some((x) => x.text.includes("散步"))).toBe(true);
    const undecided = assessReadiness({ ...ideal, kind: "還沒決定", activity: "30 分鐘以內" });
    expect(undecided.fit).toMatchObject({ kind: "貓", energy: "低" });
  });

  it("家裡有小動物、十幾年後可能照顧不了，會標出來並建議成年或老年的毛孩", () => {
    const r = assessReadiness({ ...ideal, otherPets: "有鳥、兔子或鼠類", ownerHealth: "可能會有困難", backup: "還沒想過" });
    expect(r.risks.some((x) => x.text.includes("獵物"))).toBe(true);
    expect(r.risks.find((x) => x.text.includes("接手"))?.level).toBe("高");
    expect(r.fit.age).toContain("老年");
  });
});

describe("評估的依據", () => {
  it("每一題、每一種變動都有依據，引用的出處都存在，每個出處都有被用到", () => {
    const keys = Object.keys(ideal).sort();
    expect(ASSESS_BASIS.map((b) => b.asks).sort()).toEqual(keys);
    expect(CHANGE_BASIS.map((b) => b.asks).sort()).toEqual([...CHANGE_KINDS].sort());
    const ids = new Set(SOURCES.map((s) => s.id));
    const used = new Set([...ASSESS_BASIS, ...CHANGE_BASIS].flatMap((b) => b.sources).concat("twLaw"));
    for (const id of used) expect(ids.has(id), id).toBe(true);
    for (const id of ids) expect(used.has(id), id).toBe(true);
    for (const s of SOURCES) expect(s.url).toMatch(/^https:\/\//);
  });
});

describe("生活變動檢查", () => {
  const base: ChangeAnswers = { petKind: "貓", change: "搬家", when: "三個月以後", detail: "已經確認可以", helper: "家人或室友", worry: "不擔心" };

  it("條件都好是「低」；新家不能養又沒人幫、很擔心是「高」，並提醒不要放養", () => {
    expect(planChange(base).level).toBe("低");
    const bad = planChange({ ...base, detail: "不能養", helper: "沒有人", worry: "很擔心", when: "一個月內" });
    expect(bad.level).toBe("高");
    expect(bad.why).toContain("你很擔心之後沒辦法繼續養");
    expect(bad.steps[0]).toMatchObject({ phase: "現在" });
    expect(bad.steps.map((s) => s.text).join("")).toContain("不要放養");
    expect(planChange({ ...base, detail: "還不確定" }).level).toBe("中");
  });

  it("清單依階段排好，貓狗給不同的建議", () => {
    const order = ["現在", "變動前", "變動後"];
    const cat = planChange(base).steps;
    expect(cat.map((s) => order.indexOf(s.phase))).toEqual([...cat.map((s) => order.indexOf(s.phase))].sort());
    expect(cat.some((s) => s.text.includes("紗窗"))).toBe(true);
    expect(planChange({ ...base, petKind: "狗" }).steps.some((s) => s.text.includes("牽繩"))).toBe(true);
  });

  it("每一種變動、每一個答案的清單都沒有診斷或用藥字眼", () => {
    for (const change of CHANGE_KINDS) for (const detail of DETAILS[change].options) for (const petKind of ["貓", "狗"] as const) {
      const p = planChange({ ...base, change, detail, petKind, helper: "沒有人", worry: "很擔心" });
      expect(p.steps.length).toBeGreaterThanOrEqual(3);
      for (const t of [...p.steps.map((s) => s.text), ...p.help, p.headline]) expect(findBannedClaim(t), t).toBeNull();
    }
  });

  it("有填日期就在一週前提醒，來不及就前一天，已經發生或太近就不提醒", () => {
    const today = "2026-11-20";
    expect(changeReminder({ ...base, date: "2026-12-20" }, "麻糬", today)).toMatchObject({ date: "2026-12-14", on: "2026-12-13" });
    expect(changeReminder({ ...base, date: "2026-11-24" }, "麻糬", today)).toMatchObject({ date: "2026-11-24", on: "2026-11-23" });
    expect(changeReminder({ ...base, date: "2026-11-21" }, "麻糬", today)).toBeNull();
    expect(changeReminder({ ...base, when: "已經發生", date: "2026-12-20" }, "麻糬", today)).toBeNull();
    expect(changeReminder(base, "麻糬", today)).toBeNull();
  });
});

describe("一輩子花費", () => {
  it("每一項加起來等於總數（四捨五入到千元）", () => {
    const c = lifetimeCost("中型犬");
    const sum = c.lines.reduce((s, l) => s + l.amount, 0);
    expect(Math.abs(c.total - sum)).toBeLessThan(500);
    expect(c.years).toBe(13);
    expect(lifetimeCost("大型犬").total).toBeGreaterThan(lifetimeCost("小型犬").total);
  });
});

describe("醫療單據整理", () => {
  it("日期支援西元、民國和中文寫法", () => {
    expect(normalizeDate("2026/3/5")).toBe("2026-03-05");
    expect(normalizeDate("115.03.05")).toBe("2026-03-05");
    expect(normalizeDate("2026年3月5日")).toBe("2026-03-05");
    expect(normalizeDate("看不清楚")).toBe("");
    expect(normalizeDate("2026/13/40")).toBe("");
  });

  it("名詞解釋有診斷或用藥字眼就拿掉，不合理的金額變成 null", () => {
    const d = cleanDraft({
      isMedicalDoc: true, visitDate: "2026/3/5", clinic: " 示範醫院 ", followUp: "", total: -5,
      items: [{ name: "耳道檢查", note: "" }, { name: " ", note: "" }], meds: [],
      terms: [{ term: "外耳炎", plain: "外耳道發炎的統稱" }, { term: "X", plain: "牠確診為外耳炎" }],
    });
    expect(d.terms.map((t) => t.term)).toEqual(["外耳炎"]);
    expect(d.items).toHaveLength(1);
    expect(d.total).toBeNull();
    expect(d.clinic).toBe("示範醫院");
  });

  const rec = (date: string, total: number): RecordDoc => ({
    id: date, petId: "p", photo: "", createdAt: `${date}T00:00:00Z`, isMedicalDoc: true, visitDate: date, clinic: "", items: [], meds: [], followUp: "", total, terms: [],
  });

  it("每年花費和每月醫療預備金", () => {
    const now = new Date("2026-11-20T00:00:00Z");
    const records = [rec("2025-03-01", 2000), rec("2026-05-01", 6000), rec("2026-10-01", 2000)];
    expect(spendByYear(records)).toEqual([{ year: "2025", amount: 2000 }, { year: "2026", amount: 8000 }]);
    const young = monthlyReserve({ kind: "貓", birth: "2020-01" }, records, now);
    expect(young.lastYear).toBe(8000);
    expect(young.amount).toBe(1000); // 8000 × 1.5 ÷ 12
    expect(young.senior).toBe(false);
    const old = monthlyReserve({ kind: "狗", birth: "2014-01" }, records, now);
    expect(old.senior).toBe(true);
    expect(old.amount).toBe(1300);
    expect(monthlyReserve({ kind: "貓" }, [], now).amount).toBe(500);
  });
});

describe("照顧日曆", () => {
  it("加幾個月，月底不夠天數就停在該月最後一天", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-11-20", 1)).toBe("2026-12-20");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
    expect(addMonths("2028-02-29", 12)).toBe("2029-02-28");
  });
  it("不記得上次是什麼時候，就是今天該做；到期標示", () => {
    expect(nextDueOf("", 1, "2026-11-20")).toBe("2026-11-20");
    expect(nextDueOf("2026-10-20", 1, "2026-11-20")).toBe("2026-11-20");
    expect(dueLabel("2026-11-15", "2026-11-20")).toEqual({ text: "超過 5 天", tone: "late" });
    expect(dueLabel("2026-11-21", "2026-11-20").text).toBe("明天");
    expect(dueLabel("2027-01-05", "2026-11-20").tone).toBe("later");
  });
  it("老年的健康檢查改成半年一次", () => {
    const now = new Date("2026-11-20T00:00:00Z");
    expect(careSuggestions({ kind: "狗", birth: "2016-01" }, now).find((s) => s.kind === "健康檢查")?.everyMonths).toBe(6);
    expect(careSuggestions({ kind: "貓", birth: "2018-01" }, now).find((s) => s.kind === "健康檢查")?.everyMonths).toBe(12);
  });
});

describe("飼主小學堂", () => {
  const now = new Date("2026-11-20T00:00:00Z");
  it("課程內容完整：ID 不重複、題目選項和答案都對得上", () => {
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
    for (const l of LESSONS) {
      expect(l.points.length).toBeGreaterThanOrEqual(3);
      expect(l.quiz.options.length).toBeGreaterThanOrEqual(2);
      expect(l.quiz.options.length).toBeLessThanOrEqual(3); // LINE 卡片最多 3 個選項加「看完整內容」
      const q = quizOf(l);
      expect(q.options[q.answer]).toBe(l.quiz.options[l.quiz.answer]);
      for (const t of [...l.points, l.quiz.why]) expect(findBannedClaim(t)).toBeNull();
    }
    // 正確答案不會永遠在同一個位置
    expect(new Set(LESSONS.map((l) => quizOf(l).answer)).size).toBeGreaterThan(1);
  });
  it("依毛孩的階段挑課，答過的跳過；沒有毛孩從養之前開始", () => {
    expect(stageOf({ kind: "貓", birth: "2026-06" }, now)).toBe("幼年");
    expect(stageOf({ kind: "貓", birth: "2019-04" }, now)).toBe("成年");
    expect(stageOf({ kind: "狗", birth: "2016-01" }, now)).toBe("老年");
    expect(nextLesson([], [], now)?.lesson.stages).toContain("養之前");
    const cat = [{ name: "麻糬", kind: "貓" as const, birth: "2026-06", status: "在世" as const }];
    const first = nextLesson(cat, [], now)!;
    expect(first.why).toBe("麻糬 5 個月大了，正是時候");
    expect(first.lesson.kind).not.toBe("狗");
    const second = nextLesson(cat, [{ id: first.lesson.id, correct: true, at: "" }], now)!;
    expect(second.lesson.id).not.toBe(first.lesson.id);
    // 已離開的毛孩不算
    expect(lessonsFor([{ ...cat[0], status: "已離開" }], now).lessons.every((l) => l.stages.includes("養之前"))).toBe(true);
  });

  const pet = (birth: string, kind: "貓" | "狗" = "貓", more = {}) => [{ name: "小白", kind, birth, status: "在世" as const, ...more }];
  it("依月齡排：2 個月大先上疫苗，還沒到結紮的月齡就不推", () => {
    const two = nextLesson(pet("2026-09"), [], now)!;
    expect(two.lesson.id).toBe("young-vaccine");
    expect(two.why).toContain("2 個月大");
    const one = lessonsFor(pet("2026-10"), now);
    expect(one.timing.get("young-neuter")).toEqual({ tier: 3, why: "等小白 5 個月大再上" });
    const ids: string[] = [];
    for (let i = 0; i < 20; i++) {
      const n = nextLesson(pet("2026-10"), ids.map((id) => ({ id, correct: true, at: "" })), now);
      if (!n) break;
      ids.push(n.lesson.id);
    }
    expect(ids).not.toContain("young-neuter");
    expect(ids).toContain("young-vaccine");
  });
  it("已結紮、已登記的就跳過那兩課", () => {
    const ids = lessonsFor(pet("2026-06", "貓", { neutered: true, chipped: true }), now).lessons.map((l) => l.id);
    expect(ids).not.toContain("young-neuter");
    expect(ids).not.toContain("young-register");
  });
  it("狗滿 8 歲、貓滿 10 歲的那段時間，老年健檢排第一", () => {
    expect(nextLesson(pet("2018-11", "狗"), [], now)).toMatchObject({ lesson: { id: "senior-check" }, why: "小白 8 歲了，正是時候" });
    expect(nextLesson(pet("2016-11", "貓"), [], now)?.lesson.id).toBe("senior-check");
    // 老年剛開始不推告別那課
    expect(lessonsFor(pet("2018-11", "狗"), now).timing.get("senior-goodbye")?.tier).toBe(3);
  });
  it("季節課只在當季出現、排在前面；去年上過的今年會再出現", () => {
    const dec = new Date("2026-12-15T04:00:00Z");
    const adult = pet("2019-04");
    expect(lessonsFor(adult, now).lessons.some((l) => l.season)).toBe(false);
    expect(nextLesson(adult, [], dec)).toMatchObject({ lesson: { id: "season-fireworks" }, why: "鞭炮煙火多的季節" });
    const lastYear = [{ id: "season-fireworks", correct: true, at: "2025-12-20T00:00:00Z" }];
    expect(nextLesson(adult, lastYear, dec)?.lesson.id).toBe("season-fireworks");
    const thisYear = [{ id: "season-fireworks", correct: true, at: "2026-12-01T00:00:00Z" }];
    expect(nextLesson(adult, thisYear, dec)?.lesson.id).toBe("season-cold");
    // 還沒有毛孩的人不會收到季節課
    expect(lessonsFor([], dec).lessons.some((l) => l.season)).toBe(false);
  });
});

describe("LINE 打開網頁的轉址", () => {
  it("轉到 liff.state 指定的頁面，保留其他參數", () => {
    expect(liffTarget({ "liff.state": "/assess" })).toBe("/assess");
    expect(liffTarget({ "liff.state": "/pets/abc/records?x=1", code: "c1" })).toBe("/pets/abc/records?x=1&code=c1");
  });
  it("不接受外部網址", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)"]) expect(liffTarget({ "liff.state": bad })).toBeNull();
    expect(liffTarget({})).toBeNull();
  });
  it("認得 LINE 內建瀏覽器", () => {
    expect(inLine("Mozilla/5.0 (iPhone) AppleWebKit/605 Line/14.19.0 LIFF")).toBe(true);
    expect(inLine("Mozilla/5.0 (Windows NT 10.0) Chrome/130")).toBe(false);
  });
});

describe("安全檢查", () => {
  it("健康宣稱檢查", () => {
    expect(findBannedClaim("保證健康")).not.toBeNull();
    expect(findBannedClaim("建議請獸醫檢查")).toBeNull();
  });

  it("LINE 簽章", () => {
    const body = '{"events":[]}';
    const sig = createHmac("sha256", "secret").update(body).digest("base64");
    expect(verifySignature("secret", body, sig)).toBe(true);
    expect(verifySignature("secret", body, "bad")).toBe(false);
  });

  it("私人檔案：範圍不洩漏使用者 ID，簽章只對同一個檔案有效", () => {
    const scope = scopeOf("U0123456789abcdef0123456789abcdef");
    expect(scope).toMatch(/^o-[0-9a-f]{16}$/);
    const url = `/files/${scope}/00000000-0000-0000-0000-000000000000.jpg`;
    expect(parseFileUrl(url)).toMatchObject({ scope });
    const s = new URL(`http://x${signedUrl(url)}`).searchParams.get("s");
    expect(verifyFileSig(url, s)).toBe(true);
    expect(verifyFileSig(url.replace(".jpg", ".glb"), s)).toBe(false);
    expect(parseFileUrl("/files/../etc/passwd")).toBeNull();
  });
});
