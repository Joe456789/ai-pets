// 生活變動檢查：已經在養的人遇到搬家、懷孕、出國這類變動時，用固定規則算出棄養風險的程度，
// 並給一份分「現在／變動前／變動後」的準備清單。清單是一般性的做法，不是醫療建議；AI 只負責寫一段給本人的話。
import type { ChangeAnswers, ChangeKind, ChangePhase, ChangePlan, PetKind } from "@/lib/types";

type Detail = { q: string; options: string[]; /** 每個選項加幾分風險，順序和 options 一樣。 */ risk: number[] };

/** 每種變動多問的一題。 */
export const DETAILS: Record<ChangeKind, Detail> = {
  搬家: { q: "新住處可以養嗎？", options: ["已經確認可以", "還不確定", "不能養"], risk: [0, 2, 4] },
  懷孕或家裡有新生兒: { q: "寶寶出生後，誰來照顧毛孩？", options: ["自己可以", "家人會幫忙", "還沒想好"], risk: [0, 0, 2] },
  出國或長時間不在家: { q: "要離開多久？", options: ["一個月內", "一到六個月", "半年以上"], risk: [0, 1, 3] },
  工作變忙或輪班: { q: "之後一天家裡沒人的時間大概多久？", options: ["8 小時以內", "8～10 小時", "10 小時以上"], risk: [0, 1, 2] },
  經濟變緊: { q: "最吃緊的是哪一塊？", options: ["日常的飼料和用品", "醫療費", "兩個都是"], risk: [1, 1, 2] },
  結婚或同居: { q: "對方願意一起照顧牠嗎？", options: ["願意", "還沒談過", "不太願意"], risk: [0, 1, 3] },
  家人過敏或生病: { q: "有請醫師評估過了嗎？", options: ["看過醫師了", "還沒"], risk: [1, 2] },
  自己生病或體力變差: { q: "日常照顧哪裡最吃力？", options: ["遛狗或帶出門", "清理和打掃", "帶去看醫生", "都還好"], risk: [1, 1, 1, 0] },
};

export const CHANGE_KINDS = Object.keys(DETAILS) as ChangeKind[];
export const WHEN = ["已經發生", "一個月內", "一到三個月", "三個月以後"] as const;
export const HELPERS = ["家人或室友", "朋友", "寵物保姆或住宿", "沒有人"] as const;
export const WORRIES = ["不擔心", "有點擔心", "很擔心"] as const;

type Step = { phase: ChangePhase; text: string };
const now = (text: string): Step => ({ phase: "現在", text });
const before = (text: string): Step => ({ phase: "變動前", text });
const after = (text: string): Step => ({ phase: "變動後", text });

/** 每種變動的清單。d 是多問那一題的答案，k 是貓或狗。 */
function stepsFor(c: ChangeKind, d: string, k: PetKind): Step[] {
  const cat = k === "貓";
  switch (c) {
    case "搬家":
      return [
        d === "不能養" ? now("先不要急著放棄牠：繼續找可以養的房子，或請家人朋友暫時照顧，替自己爭取找房子的時間。")
          : d === "還不確定" ? now("先跟新房東確認可以養，最好寫進租約，拿到同意再簽約。")
          : now("把房東同意養寵物的內容寫進租約，之後比較不會有爭議。"),
        before("找好新家附近的動物醫院和 24 小時急診，存進手機。"),
        before("更新晶片登記的地址和電話。"),
        before("搬家當天先把牠關在安靜的房間或寄放寵物住宿，避免門開開關關時跑出去。"),
        after(`前幾天先讓牠待在一個房間熟悉，用原本的睡窩、碗和${cat ? "貓砂盆" : "尿墊"}，再慢慢開放其他空間。`),
        after(cat ? "窗戶和紗窗先確認關好，搬家後是貓走失的常見時機。" : "先用牽繩在新家附近散步，讓牠熟悉回家的路。"),
      ];
    case "懷孕或家裡有新生兒":
      return [
        now("不需要因為懷孕或寶寶要出生，就把毛孩送走。"),
        ...(d === "還沒想好" ? [now("先和家人說好寶寶出生後，誰負責餵食、清理和散步，寫下來分工。")] : []),
        cat ? now("貓砂請家人清，或戴手套清完再洗手。") : now("先複習「坐下」「等一下」這些口令，之後抱著寶寶時比較安全。"),
        before("寶寶出生前就慢慢調整牠的作息和能去的地方，不要等寶寶回家才一次改變。"),
        before("先讓牠熟悉嬰兒用品的氣味，也可以播寶寶哭聲的錄音讓牠習慣。"),
        after("寶寶和毛孩在一起時一定有大人在旁邊，不讓他們單獨相處。"),
        after("每天留一點只屬於牠的時間，牠才不會覺得被冷落。"),
      ];
    case "出國或長時間不在家":
      return [
        now("先找好照顧的人：家人朋友，或評價好的寵物住宿、到府保姆。可以先試住一兩天。"),
        ...(d === "半年以上" ? [now("時間超過半年，要和照顧的人說清楚期間和費用。如果想帶牠一起出國，檢疫和文件要提早好幾個月準備，請先問獸醫和動植物防疫檢疫署。")] : []),
        before("把飲食習慣、平常的藥品、獸醫聯絡方式和照顧日曆，寫成一張交接表給照顧的人。"),
        before("留一筆醫療預備金給照顧的人，並寫好授權，緊急時他可以帶牠看醫生。"),
        after("回來後給牠幾天重新適應，作息慢慢恢復。"),
      ];
    case "工作變忙或輪班":
      return [
        now("把每天陪牠的時間排進行程，就算很短也要固定。"),
        ...(d === "8 小時以內" ? [] : [now(cat ? "準備益智玩具和貓跳台，讓牠白天有事做。" : "中午請家人、朋友或遛狗服務幫忙遛一次。")]),
        before("把驅蟲、疫苗、健康檢查加進照顧日曆，忙的時候 LINE 會提醒你。"),
        after("留意牠有沒有變得一直叫、破壞東西或亂尿，那可能是太無聊或不安；持續的話請問獸醫或行為獸醫。"),
      ];
    case "經濟變緊":
      return [
        now("先把每月固定的花費列出來：飼料、貓砂或尿墊、預防保健，看哪些可以換成大包裝或比較省的選擇。換飼料記得花 7 到 10 天慢慢混著換。"),
        ...(d === "日常的飼料和用品" ? [] : [now("把醫療單據存進紀錄，算算每月該存多少醫療預備金。費用比較高的治療，可以問醫院有沒有分期或其他選項。")]),
        now("各縣市的動物保護處有結紮等補助，可以先查查。"),
        after("驅蟲、疫苗照時程做，通常比生病後再處理省錢；照顧日曆會提醒你。"),
      ];
    case "結婚或同居":
      return [
        now("先和對方聊清楚：誰負責餵食、清理、散步，費用怎麼分。"),
        ...(d === "還沒談過" ? [now("安排對方和牠見面相處幾次，確認處得來、也沒有過敏。")] : []),
        ...(d === "不太願意" ? [now("先問清楚對方擔心的是什麼（過敏、清潔、怕動物），一項一項想辦法。牠也是你的家人，不要急著做決定。")] : []),
        before("如果對方也有寵物，先分開空間，再慢慢介紹。"),
        after("新的家要有牠自己的角落，作息盡量照舊。"),
      ];
    case "家人過敏或生病":
      return [
        ...(d === "還沒" ? [now("先請醫師評估，確認和貓狗有沒有關係、要注意到什麼程度。")] : []),
        now("把空間分開：過敏或生病的家人的房間，不讓毛孩進去。"),
        now("常吸地、換洗床單和牠的睡窩；梳毛請不過敏的人來做。"),
        after("如果評估後真的不能住在一起，先請家人朋友暫時照顧，再慢慢替牠找新家，親自交接。"),
      ];
    case "自己生病或體力變差":
      return [
        now("先找能幫忙的人：家人、朋友、鄰居，或付費的遛狗、到府照顧服務。"),
        ...(d === "遛狗或帶出門" ? [now(cat ? "需要出門時，換一個比較輕、好提的外出籠。" : "散步改成短而多次，或請人代遛。")] : []),
        ...(d === "清理和打掃" ? [now("換成比較好清理的貓砂盆或尿墊，把用品放在不用彎腰的高度。")] : []),
        ...(d === "帶去看醫生" ? [now("先存好寵物計程車或能幫忙接送的人的電話；也可以問附近的動物醫院有沒有到府看診。")] : []),
        before("寫一份「如果我住院」的交接表：誰來照顧、鑰匙在哪、飼料和醫院資訊。"),
        after("先想好如果真的照顧不了，誰能接手。這不是放棄，是替牠做好安排。"),
      ];
  }
}

const HELP_ALWAYS = ["你的獸醫：照顧上的問題都可以先問", "各縣市動物保護處：結紮補助、送養協助等資訊"];

/** 依答案算出風險程度和準備清單。完全是規則，不交給 AI。 */
export function planChange(a: ChangeAnswers): ChangePlan {
  const detail = DETAILS[a.change];
  const idx = Math.max(0, detail.options.indexOf(a.detail));
  const why: string[] = [];
  let score = detail.risk[idx] ?? 0;
  if (score >= 2) why.push(`${detail.q.replace(/？$/, "")}：${a.detail}`);
  if (a.change === "工作變忙或輪班" && a.petKind === "狗" && a.detail === "10 小時以上") score += 1;
  if (a.helper === "沒有人") { score += 2; why.push("目前沒有人能幫忙"); }
  if (a.worry === "很擔心") { score += 3; why.push("你很擔心之後沒辦法繼續養"); }
  if (a.worry === "有點擔心") score += 1;
  if ((a.when === "已經發生" || a.when === "一個月內") && score > 0) { score += 1; why.push(a.when === "已經發生" ? "變動已經發生了" : "一個月內就要發生"); }
  const level = score >= 5 ? "高" : score >= 2 ? "中" : "低";

  const steps = stepsFor(a.change, a.detail, a.petKind);
  if (a.helper === "沒有人") steps.unshift(now("先找一位能臨時照顧牠的人（家人、朋友或寵物保姆），把聯絡方式記下來。"));
  if (a.worry === "很擔心") steps.push(now("很擔心的時候，不要一個人扛：先和家人、你的獸醫或動物保護處聊聊。萬一真的沒辦法繼續養，請替牠找一個能照顧一輩子的新家，親自交接，千萬不要放養或丟棄。"));
  const order: ChangePhase[] = ["現在", "變動前", "變動後"];
  steps.sort((x, y) => order.indexOf(x.phase) - order.indexOf(y.phase));

  const help = [...HELP_ALWAYS];
  if (a.change === "工作變忙或輪班" || a.change === "結婚或同居") help.push("合格的訓練師或行為獸醫：出現行為問題時");
  if (a.helper !== "沒有人") help.unshift(`${a.helper}：你已經有可以幫忙的人`);

  const headline = {
    低: "大部分都準備好了，照著清單一步步做就好。",
    中: "有幾件事要提早準備，現在開始還來得及。",
    高: "這次的變動不小，先從最重要的一件做起，也別一個人扛。",
  }[level];
  return { level, headline, why, steps, help };
}

const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T12:00:00+08:00`) + n * 864e5).toISOString().slice(0, 10);

/**
 * 有填日期時，什麼時候提醒：盡量在 7 天前，來不及就前一天。回傳提醒資料的 date
 * （排程會在 date 的前一天推播）、實際推播那天 on，以及要推的文字；已經來不及就回 null。
 */
export function changeReminder(a: ChangeAnswers, petName: string, today: string) {
  if (!a.date || a.when === "已經發生") return null;
  const day = a.date.slice(5).replace("-", "/");
  const weekBefore = addDays(a.date, -7);
  if (weekBefore > today) return { date: addDays(a.date, -6), on: weekBefore, text: `再過一週（${day}）就是${petName}的「${a.change}」了。打開準備清單，看看還有哪些還沒做。` };
  if (addDays(a.date, -1) > today) return { date: a.date, on: addDays(a.date, -1), text: `明天（${day}）就是${petName}的「${a.change}」了。打開準備清單，再確認一次。` };
  return null;
}
