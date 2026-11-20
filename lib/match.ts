import type { PublicAnimal } from "@/lib/types";

export type MatchAnswers = {
  housing: "公寓或大樓" | "透天，有院子" | "租屋，房東可養" | "租屋，還不確定能不能養";
  time: "1 小時以內" | "1～3 小時" | "3 小時以上";
  experience: "第一次養" | "養過貓或狗" | "目前家裡就有";
  family: "沒有" | "有小孩" | "有長輩" | "都有";
  budget: "2,000 元以內" | "2,000～5,000 元" | "5,000 元以上";
  preference: "狗" | "貓" | "都可以";
};

export type MatchResult = { animal: PublicAnimal; score: number; factors: string[] };

// 契合度完全由這裡的規則計算，不交給 AI，協會和評審都能查得到每一分怎麼來。
// 配分：居住 25、陪伴時間 25、飼養經驗 20、家庭成員 15、照顧預算 15。資料未知時給一半。
export function scoreAnimal(a: PublicAnimal, x: MatchAnswers): MatchResult {
  const factors: string[] = [];
  let score = 0;

  const apartment = x.housing !== "透天，有院子";
  if (!apartment) { score += 25; factors.push("有院子，活動空間足夠"); }
  else if (a.tags.apartmentOk === "是") { score += 25; factors.push("適合公寓生活"); }
  else if (a.tags.apartmentOk === "否") { factors.push("牠需要較大的活動空間"); }
  else if (a.size === "大型") { score += 8; factors.push("體型較大，要確認空間夠不夠"); }
  else { score += 13; }

  const hours = x.time === "1 小時以內" ? 0 : x.time === "1～3 小時" ? 1 : 2;
  const need = a.tags.energy === "高" ? 2 : a.tags.energy === "中" ? 1 : a.tags.energy === "低" ? 0 : -1;
  if (need === -1) score += 13;
  else if (hours >= need) { score += 25; factors.push("你能陪伴的時間符合牠的活動量"); }
  else if (hours === need - 1) { score += 10; factors.push("牠的活動量偏高，陪伴時間可能要再增加"); }
  else { factors.push("牠需要的陪伴時間比你目前能給的多"); }

  const first = x.experience === "第一次養";
  if (!first) { score += 20; factors.push("你有飼養經驗"); }
  else if (a.tags.beginnerOk === "是") { score += 20; factors.push("適合第一次養的人"); }
  else if (a.tags.beginnerOk === "否") { score += 4; factors.push("牠比較適合有經驗的飼主"); }
  else { score += 10; }

  const kids = x.family === "有小孩" || x.family === "都有";
  if (!kids) score += 15;
  else if (a.tags.kidOk === "是") { score += 15; factors.push("可以和小孩相處"); }
  else if (a.tags.kidOk === "否") { factors.push("和小孩相處要特別注意"); }
  else { score += 7; }

  const lowBudget = x.budget === "2,000 元以內";
  const older = a.ageGroup === "老年";
  if (lowBudget && older) { score += 5; factors.push("年長動物的照顧費用通常較高，預算要多想想"); }
  else if (lowBudget && a.size === "大型") { score += 8; factors.push("大型犬的日常開銷較高"); }
  else score += 15;

  return { animal: a, score, factors };
}

export function rankAnimals(animals: PublicAnimal[], x: MatchAnswers, limit = 3) {
  return animals
    .filter((a) => x.preference === "都可以" || a.kind === x.preference)
    .map((a) => scoreAnimal(a, x))
    .sort((p, q) => q.score - p.score || p.animal.name.localeCompare(q.animal.name))
    .slice(0, limit);
}

export const needsHousingCheck = (x: MatchAnswers) => x.housing === "租屋，還不確定能不能養";
