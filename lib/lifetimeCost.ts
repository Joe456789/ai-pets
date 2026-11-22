// 一輩子花費估算：依台灣常見市價粗估，只用來幫忙想清楚，不是報價。
// 每一項都列出來，畫面上會標明「粗估」和計算方式。數字集中在這裡，之後有更可靠的資料只要改這張表。

export type CostProfile = "小型犬" | "中型犬" | "大型犬" | "貓";

type Row = {
  /** 平均壽命（年） */
  years: number;
  /** 飼料、零食、貓砂、尿布墊等日常用品（每月） */
  monthly: number;
  /** 疫苗、驅蟲、年度健康檢查（每年） */
  routineYear: number;
  /** 開始養的一次性花費：絕育、晶片、籠子或睡窩、外出用品 */
  setup: number;
  /** 老年期（最後三分之一）每年多出來的醫療與照顧費 */
  seniorExtraYear: number;
  /** 建議的緊急醫療預備金 */
  emergency: number;
};

export const COST_TABLE: Record<CostProfile, Row> = {
  小型犬: { years: 15, monthly: 1500, routineYear: 6000, setup: 10000, seniorExtraYear: 15000, emergency: 30000 },
  中型犬: { years: 13, monthly: 2500, routineYear: 8000, setup: 12000, seniorExtraYear: 18000, emergency: 40000 },
  大型犬: { years: 11, monthly: 4000, routineYear: 10000, setup: 15000, seniorExtraYear: 22000, emergency: 50000 },
  貓: { years: 15, monthly: 2000, routineYear: 5000, setup: 10000, seniorExtraYear: 15000, emergency: 30000 },
};

export type LifetimeCost = {
  profile: CostProfile;
  years: number;
  total: number;
  perMonth: number;
  lines: { label: string; amount: number; how: string }[];
  emergency: number;
};

const round = (n: number) => Math.round(n / 1000) * 1000;

export function lifetimeCost(profile: CostProfile): LifetimeCost {
  const r = COST_TABLE[profile];
  const seniorYears = Math.round(r.years / 3);
  const lines = [
    { label: "日常用品", amount: r.monthly * 12 * r.years, how: `每月約 ${r.monthly.toLocaleString()} 元 × ${r.years} 年` },
    { label: "預防保健", amount: r.routineYear * r.years, how: `每年約 ${r.routineYear.toLocaleString()} 元（疫苗、驅蟲、健檢）` },
    { label: "開始養的準備", amount: r.setup, how: "絕育、晶片、睡窩和外出用品，一次性" },
    { label: "老年照顧", amount: r.seniorExtraYear * seniorYears, how: `最後約 ${seniorYears} 年，每年多 ${r.seniorExtraYear.toLocaleString()} 元` },
  ];
  const total = round(lines.reduce((s, l) => s + l.amount, 0));
  return { profile, years: r.years, total, perMonth: Math.round(total / (r.years * 12) / 100) * 100, lines, emergency: r.emergency };
}

/** 評估答案的每月預算，取區間下限，用來和估算比較。 */
export const budgetFloor: Record<string, number> = {
  "2,000 元以內": 0, "2,000～4,000 元": 2000, "4,000～6,000 元": 4000, "6,000 元以上": 6000,
};
export const budgetCeil: Record<string, number> = {
  "2,000 元以內": 2000, "2,000～4,000 元": 4000, "4,000～6,000 元": 6000, "6,000 元以上": 9000,
};
