import { budgetCeil, COST_TABLE, type CostProfile } from "@/lib/lifetimeCost";
import type { AssessAnswers, Dimension, ReadinessResult, Risk } from "@/lib/types";

// 飼養準備度完全由這裡的規則計算，不交給 AI：每一分怎麼來都看得到，AI 只負責把結果寫成白話。
// 權重：時間 20、經濟 20、居住 20、家庭 15、未來變動 15、支援 10。
const WEIGHTS: Record<Dimension["key"], number> = { time: 20, money: 20, home: 20, family: 15, future: 15, support: 10 };
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** 每月大約要花多少（日常用品＋預防保健攤到每月）。還沒決定時用貓和中型犬的平均。 */
export function monthlyNeed(kind: AssessAnswers["kind"]) {
  const per = (p: CostProfile) => COST_TABLE[p].monthly + COST_TABLE[p].routineYear / 12;
  if (kind === "貓") return Math.round(per("貓"));
  if (kind === "狗") return Math.round(per("中型犬"));
  return Math.round((per("貓") + per("中型犬")) / 2);
}

export function assessReadiness(x: AssessAnswers): ReadinessResult {
  const risks: Risk[] = [];
  const dog = x.kind === "狗";
  const longAlone = x.alone === "8～10 小時" || x.alone === "10 小時以上";

  // 時間
  let time = { "4 小時以內": 100, "4～8 小時": 80, "8～10 小時": 50, "10 小時以上": 25 }[x.alone];
  time -= { 很少: 0, "每月 1～2 次": 10, 經常: 25 }[x.travel];
  if (dog && longAlone) time -= 10;
  time -= { "30 分鐘以內": dog ? 25 : 10, "30 分鐘～1 小時": dog ? 5 : 0, "1 小時以上": 0 }[x.activity];
  if (dog && x.activity === "30 分鐘以內") risks.push({ level: "中", text: "狗狗每天需要散步和陪玩，30 分鐘以內通常不夠；活動量不夠，容易亂叫或破壞東西。" });
  if (x.alone === "10 小時以上") risks.push({ level: dog ? "高" : "中", text: "每天獨處超過 10 小時，貓狗容易無聊、焦慮，狗狗特別明顯。" });
  else if (x.alone === "8～10 小時" && dog) risks.push({ level: "中", text: "狗狗每天要獨處 8～10 小時，需要安排中午有人遛或陪。" });
  if (x.travel === "經常") risks.push({ level: "中", text: "經常出差或旅行，每次都要先安排照顧的人或住宿。" });

  // 經濟
  const need = monthlyNeed(x.kind);
  const ceil = budgetCeil[x.budget];
  let money = ceil >= need * 1.3 ? 100 : ceil >= need ? 80 : ceil >= need * 0.7 ? 55 : 30;
  money -= { 沒有: 25, "1 萬元以內": 10, "1～3 萬元": 0, "3 萬元以上": 0 }[x.fund];
  if (ceil < need) risks.push({ level: ceil < need * 0.7 ? "高" : "中", text: `每月預算可能不夠：平均每月約 ${need.toLocaleString()} 元，還不含生病的花費。` });
  if (x.fund === "沒有") risks.push({ level: "中", text: "還沒有緊急預備金：一次急診或手術常常就要 1～3 萬元。" });

  // 居住
  let home = { 自有住宅: 100, "租屋，房東同意": 85, "租屋，還沒問房東": 40, "租屋，房東不同意": 0, "住家裡，家人同意": 90, "住家裡，家人還沒同意": 35 }[x.housing];
  const blocked = x.housing === "租屋，房東不同意" || x.housing === "住家裡，家人還沒同意";
  if (x.housing === "租屋，房東不同意") risks.push({ level: "高", text: "房東不同意養：住處不能養，是最常見的棄養原因之一。" });
  if (x.housing === "租屋，還沒問房東") risks.push({ level: "高", text: "還沒確認房東：先拿到書面同意，再開始找毛孩。" });
  if (x.housing === "住家裡，家人還沒同意") risks.push({ level: "高", text: "家人還沒同意：一起住的人都要願意，毛孩才不會被迫離開。" });
  if (x.space === "套房" && dog) { home -= 15; risks.push({ level: "中", text: "套房空間小，狗狗比較適合小型、活動量低的。" }); }

  // 家庭
  let family = 100;
  if (x.family.includes("6 歲以下小孩")) { family -= 15; risks.push({ level: "中", text: "家裡有 6 歲以下小孩：要教小孩怎麼相處，也要選個性溫和的。" }); }
  if (x.family.includes("長輩")) family -= 5;
  if (x.family.includes("懷孕或備孕")) { family -= 15; risks.push({ level: "中", text: "懷孕或新生兒是常見的棄養時機，先想好寶寶出生後誰照顧毛孩。" }); }
  if (x.family.includes("有人過敏")) { family -= 35; risks.push({ level: "高", text: "家裡有人過敏：先讓過敏的人實際和貓狗相處一段時間，再決定。" }); }
  if (x.otherPets === "有狗" || x.otherPets === "有貓") { family -= 10; risks.push({ level: "中", text: `家裡已經${x.otherPets}：新成員要先分開空間、慢慢介紹，也要確認原本的毛孩能接受。` }); }
  if (x.otherPets === "有鳥、兔子或鼠類") { family -= 15; risks.push({ level: "中", text: "家裡有鳥、兔子或鼠類：貓狗可能把牠們當成獵物，要能完全分開空間。" }); }

  // 未來變動與動機：養了就是十幾年，為什麼想養也決定了能不能撐過辛苦的時候。
  let future = 100;
  if (x.reason === "想送給別人") { future -= 40; risks.push({ level: "高", text: "寵物不適合當成禮物：要照顧十幾年的是收到的人，請讓對方自己決定、自己準備。" }); }
  if (x.reason === "家裡小孩想要") { future -= 10; risks.push({ level: "中", text: "小孩想養時，每天照顧的通常是大人；先確認大人願意負責，小孩長大離家後也一樣。" }); }
  if (x.reason === "看到覺得很可愛") { future -= 15; risks.push({ level: "中", text: "因為可愛而想養很正常，但牠會長大、變老、生病；建議先等兩週，或去收容所當志工後再決定。" }); }
  if (x.changes.includes("可能搬家")) { future -= 15; risks.push({ level: "中", text: "近幾年可能搬家：找房子時要把「可以養寵物」列為必要條件。" }); }
  if (x.changes.includes("出國讀書或工作")) { future -= 40; risks.push({ level: "高", text: "可能出國：貓狗會活 10 到 15 年，出國期間誰照顧要先說好。" }); }
  if (x.changes.includes("換工作或輪班")) future -= 15;
  if (x.changes.includes("結婚或同居")) { future -= 10; risks.push({ level: "中", text: "可能結婚或同居：先確認另一半也願意一起照顧。" }); }

  // 支援
  let support = { 家人或室友: 100, 朋友: 75, 寵物保姆或住宿: 70, 還沒想過: 30 }[x.backup];
  if (x.backup === "還沒想過") risks.push({ level: "中", text: "還沒有備援的人：生病、住院或出差時，誰能幫你照顧？" });
  support -= { 應該可以: 0, 不確定: 15, 可能會有困難: 30 }[x.ownerHealth];
  if (x.ownerHealth !== "應該可以") {
    risks.push({
      level: x.ownerHealth === "可能會有困難" && x.backup === "還沒想過" ? "高" : "中",
      text: "先想好如果之後自己照顧不了，誰能接手；也可以考慮領養成年或老年的毛孩，陪伴的年數比較符合你的規劃。",
    });
  }

  const dims: Dimension[] = [
    { key: "time", label: "時間", score: clamp(time), note: `每天獨處 ${x.alone}，能陪玩散步 ${x.activity}，出差旅行${x.travel}` },
    { key: "money", label: "經濟", score: clamp(money), note: `每月預算 ${x.budget}，預備金${x.fund}` },
    { key: "home", label: "居住", score: clamp(home), note: `${x.housing}，${x.space}` },
    { key: "family", label: "家庭", score: clamp(family), note: [x.family.length ? x.family.join("、") : "沒有特別需要注意的成員", x.otherPets === "沒有" ? "" : `其他寵物：${x.otherPets}`].filter(Boolean).join("；") },
    { key: "future", label: "未來與動機", score: clamp(future), note: `${x.changes.length ? x.changes.join("、") : "近幾年沒有大變動"}；想養的原因：${x.reason}` },
    { key: "support", label: "支援", score: clamp(support), note: `不在家時：${x.backup}；十幾年後自己照顧：${x.ownerHealth}` },
  ];
  const total = Math.round(dims.reduce((s, d) => s + d.score * WEIGHTS[d.key], 0) / 100);
  const high = risks.some((r) => r.level === "高");
  const verdict = blocked || total < 55 ? "先等等" : total < 75 || high ? "再準備一下" : "準備好了";
  risks.sort((a, b) => (a.level === b.level ? 0 : a.level === "高" ? -1 : 1));
  return { total, verdict, dims, risks, fit: suggestFit(x) };
}

/** 依生活條件建議適合的類型，不推薦個別動物。 */
export function suggestFit(x: AssessAnswers): ReadinessResult["fit"] {
  const why: string[] = [];
  const longAlone = x.alone === "8～10 小時" || x.alone === "10 小時以上";
  const tight = budgetCeil[x.budget] <= 2000;

  const lowActivity = x.activity === "30 分鐘以內";
  let kind: string = x.kind;
  if (x.kind === "還沒決定") {
    if (longAlone || x.travel === "經常") { kind = "貓"; why.push("你白天不在家的時間比較長，貓比狗更能適應。"); }
    else if (lowActivity) { kind = "貓"; why.push("每天能陪玩散步的時間不多，貓比狗更適合。"); }
    else if (x.space === "有院子") { kind = "狗"; why.push("有院子、在家時間夠，很適合養狗。"); }
    else { kind = "貓或小型犬"; why.push("公寓生活，貓或小型犬都適合。"); }
  } else if (x.kind === "狗" && longAlone) {
    why.push("你白天不在家的時間比較長，如果還沒決定品種，可以考慮比較能獨處的成犬，或改養貓。");
  }

  const dogPart = kind !== "貓";
  let size = "一般體型";
  if (dogPart) {
    if (x.space === "套房" || tight) { size = "小型"; why.push(x.space === "套房" ? "套房空間適合小型犬。" : "小型犬的日常花費比較低。"); }
    else if (x.space === "公寓或大樓") size = "小型或中型";
    else size = "不限";
  }

  let age = "不限，幼年要多花時間教";
  if (x.ownerHealth !== "應該可以") { age = "成年或老年，陪伴的年數比較符合你的規劃"; why.push("考慮到十幾年後的體力和健康，成年或老年的毛孩是很好的選擇。"); }
  else if (x.experience === "第一次養" || longAlone) { age = "成年（2 歲以上），個性已經穩定"; why.push(x.experience === "第一次養" ? "第一次養，成年的個性穩定，比較好上手。" : "幼年需要很多陪伴，成年的比較能獨處。"); }
  else if (x.family.includes("6 歲以下小孩")) { age = "成年、個性溫和"; why.push("家裡有小小孩，個性溫和的成年毛孩比較合適。"); }

  const energy = lowActivity ? "低" : longAlone || x.alone === "4～8 小時" ? "低到中" : x.activity === "1 小時以上" && x.experience !== "第一次養" ? "不限" : "中";
  if (dogPart && lowActivity && x.kind === "狗") why.push("陪玩散步的時間不多，選活動量低的狗狗，牠和你都會比較輕鬆。");
  return { kind, size, age, energy, why };
}

/** 依建議類型決定要用哪一組花費估算。 */
export function costProfileOf(fit: ReadinessResult["fit"]): CostProfile {
  if (fit.kind === "貓") return "貓";
  if (fit.size === "小型") return "小型犬";
  return "中型犬";
}
