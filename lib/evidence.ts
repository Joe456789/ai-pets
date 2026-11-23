// 飼養前評估和生活變動檢查的依據：每一題為什麼要問、出處是什麼。
// 出處都查證過網址；研究多數來自美國和英國。我們沒有找到台灣公開的「棄養原因」統計，這是目前的限制。
// 依據強弱：研究（期刊論文或學位論文）、指引（動保或寵物專業機構給飼主的建議）、法規、常識（一般飼養常識，尚未找到文獻）。

export type Strength = "研究" | "指引" | "法規" | "常識";
export type Source = { id: string; cite: string; url: string };

export const SOURCES: Source[] = [
  { id: "salman1998", cite: "Salman 等（1998）。Human and animal factors related to the relinquishment of dogs and cats in 12 selected animal shelters in the United States. Journal of Applied Animal Welfare Science, 1(3), 207–226.", url: "https://caninewelfare.centers.purdue.edu/resource/human-and-animal-factors-related-to-the-relinquishment-of-dogs-and-cats-in-12-selected-animal-shelters-in-the-united-states" },
  { id: "scarlett1999", cite: "Scarlett 等（1999）。Reasons for relinquishment of companion animals in U.S. animal shelters: selected health and personal issues. Journal of Applied Animal Welfare Science.", url: "https://pubmed.ncbi.nlm.nih.gov/16363961/" },
  { id: "weiss2015", cite: "Weiss 等（2015）。Goodbye to a good friend: An exploration of the re-homing of cats and dogs in the U.S. Open Journal of Animal Sciences, 5, 435–456.", url: "https://www.aspcapro.org/sites/default/files/Goodbye%20to%20a%20Good%20Friend.pdf" },
  { id: "weiss2013", cite: "Weiss 等（2013）。Should dogs and cats be given as gifts? Animals, 3, 995–1001.", url: "https://doaj.org/article/a4e9b0d1c3ca43efa2e90c0ef70f7107" },
  { id: "aspcaGift", cite: "ASPCA。Position Statement on Pets as Gifts.", url: "https://www.aspca.org/about-us/aspca-policy-and-position-statements/position-statement-on-pets-as-gifts" },
  { id: "aspcaKeep", cite: "ASPCA。Position Statement on Keeping Pets and People Together.", url: "https://aspca.org/node/58012" },
  { id: "coe2014", cite: "Coe 等（2014）。A scoping review of published research on the relinquishment of companion animals. Journal of Applied Animal Welfare Science.", url: "https://doi.org/10.1080/10888705.2014.899910" },
  { id: "carroll2023", cite: "Carroll, Torjussen, Reeve（2023）。Companion animal adoption and relinquishment during the COVID-19 pandemic: Households with children at greatest risk of relinquishing a cat or dog. Animal Welfare, 32, e56.", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10936344/" },
  { id: "gregory2000", cite: "Gregory（2000）。格拉斯哥大學博士論文，蘇格蘭犬隻被送出的飼主與犬隻特徵。", url: "https://theses.gla.ac.uk/6885/" },
  { id: "anderson2024", cite: "Anderson 等（2024）。Owner expectations and surprises of dog ownership experiences in the United Kingdom. Frontiers in Veterinary Science.", url: "https://pubmed.ncbi.nlm.nih.gov/38384957/" },
  { id: "bestFriendsHousing", cite: "Best Friends Animal Society（2024）。Literature review: Housing.", url: "https://network.bestfriends.org/sites/default/files/2024-05/Literature%20Review%20-%20Housing.pdf" },
  { id: "pdsaAlone", cite: "PDSA。Home alone – preventing separation anxiety.", url: "https://www.pdsa.org.uk/preventing-separation-anxiety" },
  { id: "pdsaExercise", cite: "PDSA。How much exercise does your dog need?", url: "https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/puppies-dogs/how-much-exercise-does-your-dog-need" },
  { id: "rcTwDog", cite: "法國皇家 Royal Canin 台灣。養狗須知：養狗前需要考慮哪些事？養狗前六大必看指南。", url: "https://www.royalcanin.com/tw/dogs/thinking-of-getting-a-dog/things-to-consider-before-getting-a-dog" },
  { id: "umichPoll", cite: "University of Michigan National Poll on Healthy Aging。How pets contribute to healthy aging: benefits and challenges.", url: "https://ihpi.umich.edu/national-poll-healthy-aging/national-findings/how-pets-contribute-healthy-aging-benefits-challenges" },
  { id: "twLaw", cite: "動物保護法第 5 條第 3 項（飼主不得棄養）、第 29 條（棄養處新臺幣 3 萬元以上 15 萬元以下罰鍰），全國法規資料庫。", url: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=m0060027" },
];

export type Basis = { topic: string; asks: string; why: string; strength: Strength; sources: string[] };

/** 飼養前評估每一題的依據，順序和問卷一樣。 */
export const ASSESS_BASIS: Basis[] = [
  { topic: "想養貓還是狗", asks: "kind", why: "貓和狗需要的時間、空間和花費不同，後面的建議和一輩子花費都依這題計算。", strength: "指引", sources: ["rcTwDog"] },
  { topic: "每天家裡沒人的時間", asks: "alone", why: "「沒時間照顧」是常見的送出原因；動保機構建議成犬平常獨處以 4 小時為上限，所以狗狗獨處越久扣分越多。", strength: "研究", sources: ["salman1998", "scarlett1999", "pdsaAlone"] },
  { topic: "每天能陪玩或散步多久", asks: "activity", why: "多數狗狗每天至少要散步一兩次，需要的運動量依品種從約 30 分鐘到 2 小時以上；活動量不夠，容易出現行為問題，而行為問題是最常見的送出原因之一。", strength: "指引", sources: ["pdsaExercise", "salman1998"] },
  { topic: "出差或旅行", asks: "travel", why: "養狗前要先想好旅行時牠跟著去，或由誰照顧。", strength: "指引", sources: ["rcTwDog"] },
  { topic: "每月預算", asks: "budget", why: "照顧花費是常見的送出原因，收入較低的飼主特別容易因為花費和住處而送出。門檻金額是本作品依台灣常見市價的估算。", strength: "研究", sources: ["salman1998", "weiss2015", "rcTwDog"] },
  { topic: "緊急預備金", asks: "fund", why: "動保機構指出，四成送出寵物的低收入飼主表示，負擔得起的醫療費用原本可以讓他們留下寵物。預備金金額是本作品的估算。", strength: "研究", sources: ["aspcaKeep", "weiss2015"] },
  { topic: "住處和房東、家人是否同意", asks: "housing", why: "搬家和房東不准養是最常被研究、也最常見的送出原因之一；租屋的人以住處問題為第一名。", strength: "研究", sources: ["salman1998", "weiss2015", "coe2014", "bestFriendsHousing"] },
  { topic: "住處空間", asks: "space", why: "「空間不夠」被列為住處相關的送出原因；有沒有可以活動的戶外空間也是養狗前要確認的事。", strength: "研究", sources: ["weiss2015", "rcTwDog"] },
  { topic: "家裡的小孩、長輩、懷孕、過敏", asks: "family", why: "家人過敏和家裡有新生兒，是貓被送出的前幾名原因；有小孩的家庭考慮或已經送出貓狗的機率較高。", strength: "研究", sources: ["scarlett1999", "weiss2015", "carroll2023"] },
  { topic: "家裡已經有其他寵物", asks: "otherPets", why: "要先想好原本的寵物會怎麼反應，新成員要慢慢介紹。貓狗和鳥、兔、鼠類要能完全分開，屬於一般飼養常識。", strength: "指引", sources: ["rcTwDog"] },
  { topic: "未來 5 年的變動", asks: "changes", why: "搬家、家庭變動、沒時間都是常見的送出原因。結婚或同居目前只有「飼主個人問題」這類較廣的研究分類支持。", strength: "研究", sources: ["salman1998", "scarlett1999", "weiss2015"] },
  { topic: "養貓狗的經驗", asks: "experience", why: "沒有經驗、一時衝動又幾乎沒花錢取得狗的飼主，比較容易送出牠；期待和實際落差大，也是送出的因素之一。", strength: "研究", sources: ["gregory2000", "anderson2024"] },
  { topic: "生病、住院或出差時誰能幫忙", asks: "backup", why: "飼主的個人問題（例如生病）是常見的送出原因；健康老化研究建議事先安排住院時誰照顧寵物。", strength: "研究", sources: ["scarlett1999", "umichPoll"] },
  { topic: "十幾年後自己的體力和健康", asks: "ownerHealth", why: "健康老化民調指出，健康和體力會影響長者能不能照顧寵物，並建議事先想好住院時誰照顧。所以先想好接手的人，或選擇成年、老年的毛孩，比較符合陪伴的年數。", strength: "研究", sources: ["umichPoll"] },
  { topic: "為什麼想養", asks: "reason", why: "一時衝動和不切實際的期待與送出有關。至於當成禮物：研究發現多數被送的貓狗都留在原本的家，所以只提醒先確認對方自己想養、也能照顧，不列高風險。", strength: "研究", sources: ["gregory2000", "anderson2024", "weiss2013", "aspcaGift"] },
];

/** 生活變動檢查的 8 種變動為什麼要特別準備。 */
export const CHANGE_BASIS: Basis[] = [
  { topic: "搬家", asks: "搬家", why: "搬家和房東不准養是最常見的送出原因之一。", strength: "研究", sources: ["salman1998", "weiss2015", "bestFriendsHousing"] },
  { topic: "懷孕或家裡有新生兒", asks: "懷孕或家裡有新生兒", why: "新生兒是貓被送出的前幾名原因。", strength: "研究", sources: ["scarlett1999", "weiss2015"] },
  { topic: "出國或長時間不在家", asks: "出國或長時間不在家", why: "沒時間照顧是常見的送出原因。", strength: "研究", sources: ["salman1998", "scarlett1999"] },
  { topic: "工作變忙或輪班", asks: "工作變忙或輪班", why: "沒時間照顧是常見的送出原因；成犬平常獨處以 4 小時為上限。", strength: "研究", sources: ["scarlett1999", "pdsaAlone"] },
  { topic: "經濟變緊", asks: "經濟變緊", why: "花費是常見的送出原因；負擔得起的醫療費用能讓不少飼主留下寵物。", strength: "研究", sources: ["weiss2015", "aspcaKeep"] },
  { topic: "結婚或同居", asks: "結婚或同居", why: "只有「飼主個人問題」這類較廣的研究分類支持，目前依據較弱。", strength: "常識", sources: ["scarlett1999"] },
  { topic: "家人過敏或生病", asks: "家人過敏或生病", why: "家人過敏是貓被送出的第一名健康原因。", strength: "研究", sources: ["scarlett1999"] },
  { topic: "自己生病或體力變差", asks: "自己生病或體力變差", why: "飼主的個人問題是常見的送出原因；建議事先安排住院時誰照顧寵物。", strength: "研究", sources: ["scarlett1999", "umichPoll"] },
];

export const sourceById = (id: string) => SOURCES.find((s) => s.id === id);
