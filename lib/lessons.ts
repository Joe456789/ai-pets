// 飼主小學堂的課程。內容是一般性的飼養知識，不是醫療建議；牽涉健康和用藥的都請飼主問獸醫。
// 每課三到四個重點加一題小測驗，LINE 卡片和網頁共用。
// 推薦順序：正在最佳月齡的課 → 當季的課 → 其他適合的課（同一層照陣列順序）。還沒到月齡的課不推。
import { stageOf } from "@/lib/care";
import { taipeiDate } from "@/lib/time";
import type { LessonProgress, PetDoc, PetKind, Stage } from "@/lib/types";

type Window = [from: number, to: number];

export type Lesson = {
  id: string;
  title: string;
  stages: Stage[];
  kind: PetKind | "都適用";
  points: string[];
  quiz: { q: string; options: string[]; answer: number; why: string };
  /** 最適合上這課的月齡（含起不含迄）。一到起點就主動推播；過了還是能上，只是不再優先。貓狗不同時分開寫。 */
  months?: Window | Record<PetKind, Window>;
  /** 季節課：只在這些月份（台灣時間）出現，每年可以再上一次。 */
  season?: { months: number[]; why: string };
  /** 毛孩已經做過這件事，就不用上這課。 */
  skipIf?: "neutered" | "chipped";
};

export const STAGES: Stage[] = ["養之前", "幼年", "成年", "老年"];

export const LESSONS: Lesson[] = [
  {
    id: "before-promise", title: "養牠是十幾年的承諾", stages: ["養之前"], kind: "都適用",
    points: [
      "貓狗常常活到十幾歲，這段時間你可能會搬家、換工作、結婚或生小孩。",
      "先想好：每一種變動發生時，牠怎麼辦？誰能幫忙？",
      "租屋要先取得房東同意，最好寫進合約；和家人同住要每個人都同意。",
      "做一次「飼養前評估」，看看時間、經濟、住處和家人哪裡還要準備。",
    ],
    quiz: { q: "決定養之前，最該先確認的是哪一個？", options: ["房東和家人是否同意", "哪個品種最流行", "名字取好了沒"], answer: 0, why: "住處和家人不同意，是很常見的放棄理由，而且養之前就能確認。" },
  },
  {
    id: "before-adopt", title: "領養之前可以先做的事", stages: ["養之前"], kind: "都適用",
    points: [
      "各縣市的公立收容所和民間團體都有開放認養，成犬成貓的個性已經穩定，比較好判斷合不合得來。",
      "可以先去當志工、遛狗或照顧貓，實際體驗每天要花多少時間。",
      "見面時多問照顧的人：牠的個性、怕什麼、和其他動物或小孩處得來嗎？",
    ],
    quiz: { q: "想知道自己適不適合養，哪個方法最實際？", options: ["先去收容所當志工", "先買好所有用品", "看網路影片就好"], answer: 0, why: "親自照顧過，最能知道每天要花多少時間和力氣。" },
  },
  {
    id: "young-vaccine", title: "疫苗和驅蟲", stages: ["幼年"], kind: "都適用", months: [0, 4],
    points: [
      "幼年要打一系列的疫苗，之後再定期補強，詳細時程照獸醫的安排。",
      "寄生蟲預防（體內外、心絲蟲）通常要定期做，間隔依產品和獸醫建議。",
      "把日期加進「照顧日曆」，前一天會用 LINE 提醒你。",
    ],
    quiz: { q: "疫苗和驅蟲的時程，應該照什麼安排？", options: ["獸醫的建議", "自己想到再做", "跟朋友家的狗一樣"], answer: 0, why: "時程和地區、生活方式、產品都有關，請照獸醫的安排。" },
  },
  {
    id: "before-first-week", title: "接回家的第一週", stages: ["養之前", "幼年"], kind: "都適用", months: [0, 3],
    points: [
      "先準備一個安靜的角落：睡窩、水、食物，貓要有貓砂盆，狗要有尿墊。",
      "前幾天先讓牠慢慢熟悉環境，不急著洗澡、帶出門或請很多朋友來看。",
      "原本吃什麼先照舊。要換飼料時，大約花 7 到 10 天，每天多混一點新的。",
      "第一週內帶去動物醫院做基本檢查，順便問疫苗和驅蟲的時程。",
    ],
    quiz: { q: "要換飼料，比較好的做法是？", options: ["花 7 到 10 天慢慢混著換", "直接換成新的", "兩種輪流餵"], answer: 0, why: "突然換飼料容易讓腸胃不適應，慢慢混著換比較溫和。" },
  },
  {
    id: "young-register", title: "寵物登記和晶片", stages: ["幼年", "成年"], kind: "都適用", months: [2, 6], skipIf: "chipped",
    points: [
      "在台灣，狗依法要辦寵物登記並植入晶片，可以到有辦理登記的動物醫院辦。貓也很建議登記。",
      "晶片和登記資料要對得上你：搬家或換手機號碼時，記得更新資料。",
      "走失時，收容所和動物醫院都會掃晶片，資料正確才找得回來。",
    ],
    quiz: { q: "植入晶片之後，還要記得做什麼？", options: ["搬家或換電話時更新登記資料", "每年重新植入一次", "什麼都不用做"], answer: 0, why: "晶片只是號碼，聯絡資料過期的話，找到了也聯絡不上你。" },
  },
  {
    id: "young-social", title: "幼犬的社會化", stages: ["幼年"], kind: "狗", months: [0, 4],
    points: [
      "出生後大約三個月內，是狗狗認識世界最快的時候。",
      "讓牠在安全的情況下接觸不同的人、聲音、地面和車輛；疫苗還沒打完時，可以抱著出門看看。",
      "做對了就給零食和稱讚，害怕時不要硬拉，也不要打罵。",
      "社會化做得好，長大比較不容易怕人、亂叫或咬人。",
    ],
    quiz: { q: "幼犬害怕某個聲音時，比較好的做法是？", options: ["拉開距離，慢慢用零食讓牠習慣", "直接抱到聲音旁邊", "罵牠膽小"], answer: 0, why: "在牠覺得安全的距離下慢慢接觸，加上獎勵，比較不會留下害怕的經驗。" },
  },
  {
    id: "young-cat-home", title: "幼貓的遊戲和貓砂盆", stages: ["幼年"], kind: "貓", months: [0, 6],
    points: [
      "用逗貓棒陪牠玩，不要用手腳逗，長大後才不會習慣抓咬人的手。",
      "準備貓抓板，牠就比較不會去抓沙發。",
      "貓砂盆常見的建議是「貓的數量加一個」，放在安靜、好進出的地方，每天清。",
    ],
    quiz: { q: "家裡有兩隻貓，貓砂盆常見的建議是幾個？", options: ["三個", "一個", "兩隻共用一個大的就好"], answer: 0, why: "「貓數加一」能減少搶廁所和亂尿的問題。" },
  },
  {
    id: "young-neuter", title: "結紮", stages: ["幼年", "成年"], kind: "都適用", months: [5, 12], skipIf: "neutered",
    points: [
      "結紮可以避免意外懷孕，減少流浪動物。",
      "結紮對某些疾病和行為也有幫助，什麼時候做比較好，請和你的獸醫討論。",
      "很多縣市有犬貓結紮補助，可以問當地的動物保護處。",
    ],
    quiz: { q: "什麼時候結紮比較好，應該問誰？", options: ["你的獸醫", "寵物店店員", "網路上隨便問"], answer: 0, why: "每隻的年齡、體型和健康不同，要由看過牠的獸醫判斷。" },
  },
  {
    id: "adult-weight", title: "體重管理", stages: ["成年", "老年"], kind: "都適用",
    points: [
      "標準的身材：從上面看得到腰身，摸得到肋骨但看不到。",
      "零食是額外的熱量，常見的建議是不超過每天總熱量的一成。",
      "每個月量一次體重記下來，突然變胖或變瘦都值得問獸醫。",
    ],
    quiz: { q: "零食常見的建議上限大約是每天熱量的多少？", options: ["一成", "一半", "沒有限制"], answer: 0, why: "零食吃太多，正餐的營養就不均衡，也容易變胖。" },
  },
  {
    id: "adult-teeth", title: "刷牙", stages: ["成年", "老年"], kind: "都適用",
    points: [
      "牙結石和牙周病在貓狗身上很常見，刷牙是最直接的預防。",
      "要用寵物專用的牙膏，人用的牙膏不適合給貓狗用。",
      "從每天短短幾秒、先碰嘴巴開始，做完給獎勵，慢慢延長。",
      "有口臭、牙齦紅腫或不太想吃東西，請給獸醫看。",
    ],
    quiz: { q: "幫狗刷牙可以用人用的牙膏嗎？", options: ["不行，要用寵物專用的", "可以，少量就好", "可以，薄荷的最好"], answer: 0, why: "人用牙膏的成分不適合讓貓狗吞下去，請用寵物專用牙膏。" },
  },
  {
    id: "adult-danger-food", title: "家裡常見的危險食物", stages: ["幼年", "成年", "老年"], kind: "都適用",
    points: [
      "巧克力、葡萄和葡萄乾、洋蔥和蔥蒜類、含木糖醇的口香糖，都不要給貓狗吃。",
      "百合花對貓非常危險，連花粉和插花的水都要小心，家裡有貓最好不要放。",
      "家裡的藥品要收好，人用的藥不要自己拿給貓狗，對牠們可能有害。",
      "懷疑誤食時，不要自己催吐，立刻聯絡動物醫院。",
    ],
    quiz: { q: "哪一種花對貓特別危險？", options: ["百合", "向日葵", "玫瑰"], answer: 0, why: "百合對貓的毒性很強，少量也可能出事。" },
  },
  {
    id: "life-change", title: "生活有變動時", stages: ["成年", "老年"], kind: "都適用",
    points: [
      "要搬家：先找可以養寵物的房子，合約寫清楚，搬完前幾天多陪牠熟悉新環境。",
      "懷孕或家裡要有新生兒：不需要把貓狗送走。貓砂請別人清或戴手套清，寶寶來之前先讓牠熟悉新的聲音和氣味。",
      "要出國或長時間不在家：提早找好信任的照顧者或住宿，把飲食和用藥寫下來。",
      "真的遇到困難時，先找家人朋友、動保團體或獸醫討論，不要一個人扛。",
      "遇到變動時，可以做一次「生活變動檢查」（在「飼養前評估」頁，或在 LINE 打「我要搬家」這類的話），拿到分階段的準備清單。",
    ],
    quiz: { q: "家裡有人懷孕，養貓的人比較好的做法是？", options: ["請別人清貓砂或戴手套清", "一定要把貓送走", "什麼都不用注意"], answer: 0, why: "做好清潔和衛生習慣就好，不需要因為懷孕放棄貓。" },
  },
  {
    id: "adult-emergency", title: "先準備好緊急時刻", stages: ["幼年", "成年", "老年"], kind: "都適用",
    points: [
      "手機先存好附近 24 小時急診動物醫院的電話和地址。",
      "家裡準備好外出籠或牽繩，緊急時才能馬上出門。",
      "每月存一點醫療預備金，突然要花錢時不會措手不及。",
      "颱風、地震時要帶牠一起避難：準備幾天份的食物、水、藥和最近的照片。",
    ],
    quiz: { q: "哪一項最該事先存在手機裡？", options: ["24 小時急診動物醫院的電話", "寵物店的優惠碼", "寵物美容的預約"], answer: 0, why: "真的緊急時沒有時間慢慢找。" },
  },
  {
    id: "owner-duty", title: "飼主的責任", stages: ["成年", "老年"], kind: "都適用",
    points: [
      "在台灣棄養寵物是違法的，會被處罰鍰。",
      "帶狗出門要有人陪同、繫好牽繩，大便要清乾淨。",
      "照顧牠一輩子，包括生病和老了的時候。",
      "真的沒辦法繼續養時，要替牠找一個能照顧一輩子的新家，親自交接，千萬不要放養。",
    ],
    quiz: { q: "真的沒辦法繼續養時，應該怎麼做？", options: ["替牠找新家並親自交接", "放到公園讓牠自己生活", "留在空屋裡"], answer: 0, why: "放養就是棄養，牠在外面很難活下去，也違法。" },
  },
  {
    id: "senior-check", title: "老年的健康檢查", stages: ["老年"], kind: "都適用", months: { 狗: [96, 108], 貓: [120, 132] },
    points: [
      "進入老年後，很多獸醫建議大約每半年做一次健康檢查。",
      "平常留意喝水量、尿量、食慾、體重和睡覺的時間，有變化就記下來。",
      "看診時把紀錄給獸醫看，比憑印象說更準確。",
    ],
    quiz: { q: "老年貓狗的健康檢查，常見的建議是多久一次？", options: ["大約半年", "五年", "生病了才去"], answer: 0, why: "老年身體變化比較快，定期檢查比較早發現問題。" },
  },
  {
    id: "senior-home", title: "幫老毛孩調整家裡", stages: ["老年"], kind: "都適用",
    points: [
      "地板鋪止滑墊，常走的地方不要有高低差，必要時加小樓梯或斜坡。",
      "睡窩放在溫暖、安靜、不用跳上跳下的地方。",
      "狗的散步改成短而多次；貓的貓砂盆換成邊比較低的。",
    ],
    quiz: { q: "老狗散步比較好的方式是？", options: ["短而多次", "一次走很久", "不要再散步了"], answer: 0, why: "適度活動對老狗有幫助，但一次太久容易累，也傷關節。" },
  },
  {
    id: "senior-goodbye", title: "提早想好的告別", stages: ["老年"], kind: "都適用", months: { 狗: [132, 400], 貓: [156, 400] },
    points: [
      "和獸醫聊聊牠的生活品質：吃得下嗎？會痛嗎？還喜歡做原本喜歡的事嗎？",
      "安寧照顧和最後的決定，可以提早和獸醫、家人慢慢討論，不用一個人決定。",
      "後事（火化、樹葬等）先了解，真的發生時比較不會慌。",
      "多拍照片和影片，以後也可以用「紀念與告別」為牠做一個 3D 紀念。",
    ],
    quiz: { q: "關於最後的照顧，比較好的做法是？", options: ["提早和獸醫、家人討論", "等到最後再說", "自己一個人決定"], answer: 0, why: "提早討論，到時候才能照著牠和你們都能接受的方式走。" },
  },
  // 季節課：每年到了那個季節再上一次，成年期好幾年也不會沒課可上。
  {
    id: "season-heat", title: "夏天怕熱", stages: ["幼年", "成年", "老年"], kind: "都適用",
    season: { months: [6, 7, 8, 9], why: "夏天到了" },
    points: [
      "散步改在清晨或傍晚。出門前用手背摸摸地面，燙手就先不要走。",
      "不要把毛孩單獨留在車上，就算開了窗、只離開幾分鐘，車裡也會很快變得很熱。",
      "家裡保持通風，隨時有乾淨的水。扁臉的品種（例如法鬥、巴哥、波斯貓）和老年的特別怕熱。",
      "一直喘、流很多口水、站不穩時，先移到陰涼處，立刻聯絡動物醫院。",
    ],
    quiz: { q: "夏天帶狗散步，比較好的時間是？", options: ["清晨或傍晚", "中午", "下午兩點"], answer: 0, why: "中午的氣溫最高，柏油路也很燙，容易燙傷腳掌、熱到受不了。" },
  },
  {
    id: "season-typhoon", title: "颱風來之前", stages: ["幼年", "成年", "老年"], kind: "都適用",
    season: { months: [7, 8, 9, 10], why: "颱風季到了" },
    points: [
      "颱風來之前，把在院子、陽台或頂樓的毛孩帶進室內，不要綁在外面。",
      "把幾天份的食物和水、平常的藥品、外出籠和最近的照片放在一起，要避難時拿了就走。",
      "確認晶片登記的電話是最新的，項圈掛上寫電話的名牌，萬一走失比較找得回來。",
      "風雨很大時，讓牠躲在安靜的角落，不要硬拉出來。",
    ],
    quiz: { q: "颱風要來了，養在院子的狗應該怎麼辦？", options: ["帶進室內", "綁緊一點", "放出去讓牠自己躲"], answer: 0, why: "強風和淹水很危險，綁在外面牠逃不了，放出去又容易走失。" },
  },
  {
    id: "season-fireworks", title: "跨年和過年的鞭炮煙火", stages: ["幼年", "成年", "老年"], kind: "都適用",
    season: { months: [12, 1, 2], why: "鞭炮煙火多的季節" },
    points: [
      "鞭炮和煙火的聲音會讓很多貓狗害怕，有些會嚇到衝出門，是常見的走失時機。",
      "這段時間門窗關好，出門一定繫牽繩，項圈掛上寫電話的名牌。",
      "在家準備一個安靜的角落，開電視或音樂蓋過聲音，讓牠自己決定要不要躲。",
      "害怕得很嚴重的，提早問獸醫有什麼方法能幫牠。",
    ],
    quiz: { q: "外面在放鞭炮時，比較好的做法是？", options: ["關好門窗，讓牠躲在安靜的角落", "帶牠出去看煙火", "把牠拉出來習慣聲音"], answer: 0, why: "硬讓牠面對害怕的聲音，可能會更怕；先讓牠覺得安全最重要。" },
  },
  {
    id: "season-cold", title: "寒流來了", stages: ["幼年", "成年", "老年"], kind: "都適用",
    season: { months: [12, 1, 2], why: "天氣變冷了" },
    points: [
      "幼年、老年和短毛的貓狗比較怕冷，睡窩放在不會直接吹到風的地方，多加一條毯子。",
      "電暖器和暖暖包要小心，不要讓牠一直貼著，電線也要收好，免得被咬。",
      "天冷時喝水容易變少，可以多放幾個水碗。",
      "貓冬天常躲進機車或汽車的引擎附近取暖，發動前先拍拍車子，給牠離開的時間。",
    ],
    quiz: { q: "冬天發動車子前先拍拍車身，是為了什麼？", options: ["讓躲在裡面取暖的貓先離開", "讓引擎比較快熱", "檢查輪胎"], answer: 0, why: "天冷時貓常鑽進引擎附近，先拍一拍給牠逃出來的機會。" },
  },
];

export const lessonById = (id: string) => LESSONS.find((l) => l.id === id) ?? null;

/** 顯示用的題目：選項依課程 ID 固定輪轉，正確答案才不會永遠是第一個。LINE 按鈕和網頁用同一個順序。 */
export function quizOf(l: Lesson) {
  const n = l.quiz.options.length;
  const shift = [...l.id].reduce((s, ch) => s + ch.charCodeAt(0), 0) % n;
  const options = l.quiz.options.map((_, i) => l.quiz.options[(i + shift) % n]);
  return { q: l.quiz.q, options, answer: (l.quiz.answer - shift + n) % n, why: l.quiz.why };
}

type PetLike = Pick<PetDoc, "kind" | "birth" | "status" | "name"> & Partial<Pick<PetDoc, "neutered" | "chipped">>;

/** 現在幾個月大（依台灣時間的年月）。不知道生日回 null。 */
export function ageMonths(pet: Pick<PetDoc, "birth">, now = new Date()) {
  const [by, bm] = (pet.birth ?? "").split("-").map(Number);
  if (!by || !bm) return null;
  const [y, m] = taipeiDate(now).split("-").map(Number);
  return Math.max(0, y * 12 + m - (by * 12 + bm));
}

const ageText = (m: number) => (m < 12 ? `${m} 個月大` : `${Math.floor(m / 12)} 歲`);
const windowOf = (l: Lesson, kind: PetKind) => (!l.months ? null : Array.isArray(l.months) ? l.months : l.months[kind]);

/** 這課對這位飼主的時機：0 正是時候、1 當季、2 其他適合的、3 還沒到月齡（先不推）。 */
export type Timing = { tier: 0 | 1 | 2 | 3; why: string };

function timingFor(l: Lesson, pet: PetLike, now: Date): Timing | null {
  const stage = stageOf(pet, now);
  if (!l.stages.includes(stage) || (l.kind !== "都適用" && l.kind !== pet.kind)) return null;
  if (l.skipIf && pet[l.skipIf]) return null;
  if (l.season) {
    const month = Number(taipeiDate(now).slice(5, 7));
    return l.season.months.includes(month) ? { tier: 1, why: l.season.why } : null;
  }
  const age = ageMonths(pet, now);
  const w = windowOf(l, pet.kind);
  if (w && age !== null) {
    if (age >= w[0] && age < w[1]) return { tier: 0, why: `${pet.name} ${ageText(age)}了，正是時候` };
    if (age < w[0]) return { tier: 3, why: `等${pet.name} ${ageText(w[0])}再上` };
  }
  return { tier: 2, why: `${pet.name}在${stage}期` };
}

/**
 * 這位飼主現在適合的課，已照時機排好：依在世毛孩的月齡、種類、季節，做過的事（已結紮、已登記）跳過。
 * 多隻毛孩時，每課取最急的那隻。沒有毛孩就是「養之前」。
 */
export function lessonsFor(pets: PetLike[], now = new Date()) {
  const alive = pets.filter((p) => p.status === "在世");
  if (!alive.length) {
    const why = "還沒有毛孩，先從養之前開始";
    const lessons = LESSONS.filter((l) => l.stages.includes("養之前"));
    return { lessons, timing: new Map<string, Timing>(lessons.map((l) => [l.id, { tier: 2, why }])), why };
  }
  const timing = new Map<string, Timing>();
  for (const l of LESSONS) for (const p of alive) {
    const t = timingFor(l, p, now);
    const cur = timing.get(l.id);
    if (t && (!cur || t.tier < cur.tier)) timing.set(l.id, t);
  }
  const tier = (l: Lesson) => timing.get(l.id)!.tier;
  const lessons = LESSONS.filter((l) => timing.has(l.id)).sort((a, b) => tier(a) - tier(b));
  return { lessons, timing, why: alive.map((p) => `${p.name}在${stageOf(p, now)}期`).join("、") };
}

/** 算上過的課。季節課半年前上的不算，明年同一季會再出現。 */
export function doneIds(progress: LessonProgress[], now = new Date()) {
  const fresh = (p: LessonProgress) => now.getTime() - Date.parse(p.at) < 180 * 864e5;
  return new Set(progress.filter((p) => !lessonById(p.id)?.season || fresh(p)).map((p) => p.id));
}

/** 下一課：照時機排序後第一個還沒上的；還沒到月齡的不算。都上過就回 null。 */
export function nextLesson(pets: PetLike[], progress: LessonProgress[], now = new Date()) {
  const done = doneIds(progress, now);
  const { lessons, timing } = lessonsFor(pets, now);
  const lesson = lessons.find((l) => !done.has(l.id) && timing.get(l.id)!.tier < 3);
  return lesson ? { lesson, ...timing.get(lesson.id)! } : null;
}

/** 剛好到了最佳月齡、還沒上也還沒推過的課。排程每天檢查，有就主動推，不受每月一次的限制。 */
export function timelyLesson(pets: PetLike[], progress: LessonProgress[], pushed: string[], now = new Date()) {
  const done = doneIds(progress, now);
  const { lessons, timing } = lessonsFor(pets, now);
  const lesson = lessons.find((l) => timing.get(l.id)!.tier === 0 && !done.has(l.id) && !pushed.includes(l.id));
  return lesson ? { lesson, why: timing.get(lesson.id)!.why } : null;
}
