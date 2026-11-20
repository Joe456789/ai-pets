import type { PublicAnimal } from "@/lib/types";

// AR 試放用的規則：體型換算、點一下的反應、AI 失敗時的自我介紹。都是固定規則，不需要訓練模型。

/** 依種類和體型估計站立（貓是坐姿）時的總高度，單位公分。只是約略值。 */
export function estimateHeightCm(a: Pick<PublicAnimal, "kind" | "size">) {
  if (a.kind === "貓") return a.size === "大型" ? 35 : 30;
  return { 小型: 40, 中型: 60, 大型: 80, 未知: 55 }[a.size] ?? 55;
}

export type ReactionKey = "approach" | "hop" | "shy" | "nod" | "tilt";

// 順序就是優先順序：慢熟的動物即使也很愛玩，第一次點牠還是先躲一下。
const RULES: [ReactionKey, RegExp][] = [
  ["shy", /慢熟|怕生|害羞|膽小|謹慎|獨立|敏感/],
  ["approach", /親人|黏人|撒嬌|愛摸|溫柔|友善|熱情|呼嚕|踩踏/],
  ["hop", /活潑|好動|愛玩|好奇|調皮|精力|愛跑|球/],
  ["nod", /安靜|穩定|溫和|乖巧|沉穩|愛乾淨|曬太陽/],
];

export const REACTION_TEXT: Record<ReactionKey, string> = {
  approach: "（慢慢靠過來，想讓你摸摸）",
  hop: "（開心地跳了一下）",
  shy: "（先退一步，偷偷看著你）",
  nod: "（安靜地看著你，慢慢眨眼）",
  tilt: "（歪著頭看你）",
};

/** 相機 3D 模式的小遊戲：每個互動優先播哪一段反應影片、顯示什麼文字。 */
export const EVENT_REACTIONS: Record<"ball" | "treat" | "come", ReactionKey[]> = {
  ball: ["hop", "approach", "tilt"],
  treat: ["approach", "nod", "tilt"],
  come: ["approach", "tilt", "nod"],
};
export const EVENT_TEXT: Record<"ball" | "treat" | "come", string> = {
  ball: "（把球帶回來給你，還想再玩一次）",
  treat: "（吃掉零食，抬頭看著你）",
  come: "（走到你面前，聞聞你的手）",
};

/** 依協會寫的個性決定點擊反應，每次點擊輪流使用，最後都會加上歪頭。 */
export function reactionsFor(traits: string[]): ReactionKey[] {
  const keys = RULES.filter(([, re]) => traits.some((t) => re.test(t))).map(([k]) => k);
  return [...new Set<ReactionKey>([...keys, "tilt"])];
}

export const PERSONA_QUESTIONS = ["你平常喜歡做什麼？", "你適合什麼樣的家？", "第一次見面要注意什麼？"] as const;

export type Persona = { intro: string; qa: { q: string; a: string }[]; ai: boolean };

const firstSentence = (s: string) => (s.match(/^[^。！？!?]+[。！？!?]?/)?.[0] ?? "").trim();

/** AI 無法使用時的自我介紹，只用協會填的資料組成。 */
export function fallbackPersona(a: Pick<PublicAnimal, "name" | "age" | "traits" | "story" | "needs" | "goodFor">): Persona {
  const traits = a.traits.slice(0, 3);
  const intro = [`我是${a.name}${a.age ? `，${a.age}` : ""}。`, traits.length ? `協會的人說我${traits.join("、")}。` : "", firstSentence(a.story)].join("");
  return {
    intro,
    qa: [
      { q: PERSONA_QUESTIONS[0], a: firstSentence(a.story) || "我還在慢慢展現自己，來現場跟我玩玩就知道了！" },
      { q: PERSONA_QUESTIONS[1], a: a.goodFor.length ? `協會覺得我可能適合：${a.goodFor.join("、")}。` : "協會的人可以告訴你更多我適合的生活。" },
      { q: PERSONA_QUESTIONS[2], a: a.needs[0] ? `${a.needs[0]}，謝謝你願意了解我。` : "請先讓我聞聞你的手，給我一點時間認識你。" },
    ],
    ai: false,
  };
}
