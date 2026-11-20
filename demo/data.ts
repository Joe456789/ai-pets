// 畫面原型用的虛構資料：協會、人員、動物皆非真實。之後會換成 Firestore。

export type Shelter = {
  id: string; name: string; area: string; intro: string; hours: string;
  animals: number; plan: "試用" | "基本" | "進階"; due: string; status: "使用中" | "試用中" | "已停用";
  aiCalls: number; aiCost: number; aiCap: number; lineOk: boolean; adopted: number;
};

export const shelters: Shelter[] = [
  { id: "nuanwo", name: "暖窩動物協會", area: "新北市", intro: "以中大型犬中途為主，每週六開放預約互動。", hours: "週三至週日 13:00–17:00", animals: 42, plan: "基本", due: "2027/02/28", status: "使用中", aiCalls: 1840, aiCost: 412, aiCap: 800, lineOk: true, adopted: 11 },
  { id: "shanqiu", name: "山丘毛孩之家", area: "桃園市", intro: "山邊園區，收容年長與需要長期照顧的狗狗。", hours: "週六、週日 10:00–16:00", animals: 87, plan: "進階", due: "2027/03/15", status: "使用中", aiCalls: 3120, aiCost: 705, aiCap: 1500, lineOk: true, adopted: 19 },
  { id: "gangbian", name: "港邊浪貓社", area: "基隆市", intro: "關注港區街貓，協助中途與送養。", hours: "預約制", animals: 23, plan: "試用", due: "2026/12/20", status: "試用中", aiCalls: 460, aiCost: 96, aiCap: 300, lineOk: true, adopted: 4 },
  { id: "daotian", name: "稻田狗狗中途", area: "彰化縣", intro: "小型中途之家，由志工輪班照顧。", hours: "週六 09:00–12:00", animals: 16, plan: "基本", due: "2026/11/30", status: "使用中", aiCalls: 290, aiCost: 61, aiCap: 800, lineOk: false, adopted: 3 },
];

export type CareEntry = { time: string; who: string; text: string; flag?: boolean };
export type Animal = {
  id: string; code: string; name: string; kind: "狗" | "貓"; sex: "公" | "母"; age: string; ageGroup: "幼年" | "成年" | "老年";
  size: "小型" | "中型" | "大型"; coat: string; color: string; bg: string; shelterId: string;
  status: "開放領養" | "在所照護" | "送醫中" | "已領養"; days: number; area: string; neutered: boolean; vaccineDue: string;
  traits: string[]; story: string; needs: string[]; goodFor: string[]; note: string; flagged?: boolean; care: CareEntry[];
};

export const animals: Animal[] = [
  { id: "xiaohei", code: "NW-0231", name: "小黑", kind: "狗", sex: "公", age: "約 3 歲", ageGroup: "成年", size: "中型", coat: "黑色短毛", color: "#2d2a28", bg: "#e7dfcf", shelterId: "nuanwo", status: "在所照護", days: 214, area: "A 區", neutered: true, vaccineDue: "2026/11/20", traits: ["慢熟", "愛散步", "聽得懂坐下"], story: "小黑一開始會躲在角落觀察人，熟了以後會把頭靠在你腿上。每天最期待傍晚散步，看到牽繩就會原地轉圈。", needs: ["每天至少散步一次", "需要時間慢慢建立信任"], goodFor: ["有養狗經驗", "家中無幼童"], note: "連續 2 天回報未進食", flagged: true,
    care: [
      { time: "今天 08:40", who: "林小芸", text: "今天沒吃早餐，精神尚可", flag: true },
      { time: "昨天 17:10", who: "陳志豪", text: "晚餐幾乎沒吃", flag: true },
      { time: "11/02 09:00", who: "林小芸", text: "完成驅蟲" },
      { time: "10/28 16:30", who: "張雅婷", text: "散步時願意主動靠近志工" },
    ] },
  { id: "afu", code: "NW-0198", name: "阿福", kind: "狗", sex: "公", age: "約 6 歲", ageGroup: "成年", size: "大型", coat: "黃色短毛", color: "#c98f45", bg: "#f3e3c3", shelterId: "nuanwo", status: "開放領養", days: 386, area: "A 區", neutered: true, vaccineDue: "2027/01/12", traits: ["親人", "穩定", "喜歡曬太陽"], story: "阿福是園區裡的大哥，新來的狗狗緊張時都會往他身邊靠。不太愛吵鬧，只想找個有太陽的地方趴著，順便等你摸摸他。", needs: ["需要足夠活動空間", "體型大，出入需能控制牽繩"], goodFor: ["第一次養狗", "有院子或常出門"], note: "今天回報軟便一次", flagged: true,
    care: [
      { time: "今天 08:40", who: "林小芸", text: "軟便一次，食慾正常", flag: true },
      { time: "10/30 10:00", who: "陳志豪", text: "體重 26 公斤" },
    ] },
  { id: "douhua", code: "NW-0247", name: "豆花", kind: "狗", sex: "母", age: "約 1 歲", ageGroup: "幼年", size: "小型", coat: "白色長毛", color: "#f6f1e7", bg: "#d7e3da", shelterId: "nuanwo", status: "開放領養", days: 38, area: "B 區", neutered: true, vaccineDue: "2027/03/02", traits: ["活潑", "愛玩球", "學習快"], story: "豆花的尾巴幾乎沒有停過。她三天就學會坐下和握手，只要有球，可以開心地玩上一整個下午。", needs: ["每天需要陪玩", "還在學習獨處"], goodFor: ["有時間陪伴", "活動量大的家庭"], note: "無異常回報",
    care: [{ time: "11/03 15:20", who: "張雅婷", text: "完成基礎訓練：坐下、握手" }] },
  { id: "atu", code: "NW-0102", name: "阿土", kind: "狗", sex: "公", age: "約 10 歲", ageGroup: "老年", size: "中型", coat: "棕色短毛", color: "#7a5433", bg: "#ecdcc8", shelterId: "nuanwo", status: "開放領養", days: 702, area: "A 區", neutered: true, vaccineDue: "2026/12/05", traits: ["安靜", "黏人", "不爆衝"], story: "阿土走路慢慢的，最喜歡跟在人的腳邊。他在園區快兩年了，還在等一個能陪他慢慢變老的家。", needs: ["定期回診追蹤", "適合步調較慢的生活"], goodFor: ["退休或在家時間長", "公寓也可以"], note: "無異常回報",
    care: [{ time: "10/25 11:00", who: "陳志豪", text: "回診追蹤，獸醫建議維持現有飲食" }] },
  { id: "mochi", code: "GB-0066", name: "麻糬", kind: "貓", sex: "母", age: "約 2 歲", ageGroup: "成年", size: "小型", coat: "白底灰斑", color: "#e8e3da", bg: "#dbe2ea", shelterId: "gangbian", status: "開放領養", days: 121, area: "貓房", neutered: true, vaccineDue: "2027/02/10", traits: ["溫柔", "愛踩踏", "會呼嚕"], story: "麻糬在港邊被發現時很怕人，現在只要你坐下，她就會跳上來踩一踩，然後在腿上睡著。", needs: ["窗戶需要加裝防護", "適合安靜的環境"], goodFor: ["公寓", "第一次養貓"], note: "無異常回報",
    care: [{ time: "11/01 10:30", who: "黃品瑜", text: "換到貓房二樓，適應良好" }] },
  { id: "juzi", code: "GB-0071", name: "橘子", kind: "貓", sex: "公", age: "約 8 個月", ageGroup: "幼年", size: "小型", coat: "橘色虎斑", color: "#dd8a3e", bg: "#f6e6c9", shelterId: "gangbian", status: "開放領養", days: 45, area: "貓房", neutered: false, vaccineDue: "2026/12/18", traits: ["好奇", "愛爬高", "很會吃"], story: "橘子對什麼都好奇，塑膠袋、紙箱、水龍頭都是他的玩具。他也是開飯時第一個衝到碗前面的那隻。", needs: ["需要貓跳台", "待完成絕育"], goodFor: ["有時間陪玩", "可接受多貓"], note: "待安排絕育",
    care: [{ time: "10/29 14:00", who: "黃品瑜", text: "體重 3.1 公斤，活動力佳" }] },
  { id: "zhima", code: "SQ-0314", name: "芝麻", kind: "貓", sex: "母", age: "約 7 歲", ageGroup: "老年", size: "中型", coat: "黑白賓士", color: "#35322f", bg: "#e3dde8", shelterId: "shanqiu", status: "開放領養", days: 533, area: "室內區", neutered: true, vaccineDue: "2027/01/25", traits: ["獨立", "愛乾淨", "喜歡窗邊"], story: "芝麻不太主動撒嬌，但每天都會準時坐在窗邊看鳥。她會在你看書的時候，悄悄睡到你旁邊。", needs: ["適合單貓家庭", "環境變動時需要適應期"], goodFor: ["喜歡安靜的人", "上班族"], note: "無異常回報",
    care: [{ time: "10/20 09:30", who: "吳承翰", text: "例行健康檢查已完成" }] },
  { id: "naicha", code: "SQ-0288", name: "奶茶", kind: "狗", sex: "母", age: "約 4 歲", ageGroup: "成年", size: "中型", coat: "奶茶色捲毛", color: "#c7a27c", bg: "#efe2d4", shelterId: "shanqiu", status: "開放領養", days: 167, area: "前院", neutered: true, vaccineDue: "2027/01/08", traits: ["溫和", "愛撒嬌", "親小孩"], story: "奶茶喜歡把下巴放在人的手上，也很能接受小朋友的摸摸。她怕打雷，下雨天會希望有人陪。", needs: ["打雷時需要安撫", "毛髮需要定期整理"], goodFor: ["有小孩的家庭", "第一次養狗"], note: "無異常回報",
    care: [{ time: "11/02 13:00", who: "吳承翰", text: "完成美容" }] },
];

export const adoptable = () => animals.filter((a) => a.status === "開放領養");
export const getAnimal = (id: string) => animals.find((a) => a.id === id);
export const getShelter = (id: string) => shelters.find((s) => s.id === id);
export const ME = shelters[0];
export const myAnimals = animals.filter((a) => a.shelterId === ME.id);

export const staff = [
  { name: "林小芸", role: "現場人員", code: "HP-7K3Q", area: "A、B 區", bound: true, last: "今天 08:40" },
  { name: "陳志豪", role: "現場人員", code: "HP-2M9X", area: "A 區", bound: true, last: "昨天 17:10" },
  { name: "張雅婷", role: "志工", code: "HP-5T8R", area: "B 區", bound: true, last: "11/03 15:20" },
  { name: "王柏翔", role: "志工", code: "HP-9C4L", area: "未指定", bound: false, last: "尚未綁定" },
];

export const applications = [
  { id: "ap1", who: "郭先生", animalId: "afu", date: "11/04", status: "待審核", match: 86, home: "透天、有院子", exp: "曾養過中型犬", reason: "有院子且常在家，符合阿福需要的活動空間；需確認家人都同意，以及是否能控制大型犬牽繩。" },
  { id: "ap2", who: "蔡小姐", animalId: "douhua", date: "11/03", status: "面談中", match: 78, home: "公寓、已徵得房東同意", exp: "第一次養狗", reason: "每天可陪玩兩小時，符合豆花的活動需求；因為是第一次養狗，建議面談時說明獨處訓練。" },
  { id: "ap3", who: "李先生", animalId: "atu", date: "10/30", status: "面談中", match: 91, home: "公寓、已退休", exp: "養過老犬", reason: "在家時間長且有照顧老犬的經驗，與阿土的生活步調相符。" },
  { id: "ap4", who: "方小姐", animalId: "afu", date: "10/28", status: "未通過", match: 42, home: "套房、禁養寵物", exp: "無", reason: "目前居住合約禁養寵物，建議先確認居住條件。" },
];

export const conversations = [
  { id: "c1", who: "何小姐", tag: "想退養", status: "待處理", time: "20 分鐘前", about: "阿寶（去年領養）", last: "最近要搬家，可能沒辦法繼續養了……", ai: "已回覆會請協會聯絡，並將對話轉給人工。" },
  { id: "c2", who: "蔡小姐", tag: "健康疑慮", status: "處理中", time: "2 小時前", about: "一般諮詢", last: "狗狗這兩天一直吐，要先餵藥嗎？", ai: "已提醒盡快諮詢獸醫，未提供用藥建議。" },
  { id: "c3", who: "張先生", tag: "其他", status: "已結案", time: "昨天", about: "參訪預約", last: "週六可以帶小孩一起去看狗狗嗎？", ai: "AI 已回答開放時間，人員補充親子注意事項。" },
];

export const suggestions = [
  { title: "優先曝光：阿土", tag: "送養", why: "收容 702 天、介紹頁過去 30 天瀏覽偏少，條件適合常在家的領養人。", action: "產生「老犬也值得一個家」主題貼文" },
  { title: "優先曝光：阿福", tag: "送養", why: "已收容 386 天，有 1 件待審申請，適合趁此時加強追蹤。", action: "提醒管理者本週完成審核" },
  { title: "優先留意：小黑", tag: "照護", why: "連續 2 天回報未進食，建議現場人員留意，必要時諮詢獸醫。", action: "加入明日待辦" },
  { title: "排程提醒：3 隻疫苗將到期", tag: "資源", why: "小黑、阿土、橘子 45 天內到期，合併預約可減少往返次數。", action: "建立回診清單" },
];

export const monthly = [
  { m: "6月", adopted: 5, avg: 262 }, { m: "7月", adopted: 7, avg: 255 }, { m: "8月", adopted: 6, avg: 248 },
  { m: "9月", adopted: 9, avg: 241 }, { m: "10月", adopted: 11, avg: 233 },
];

export const aiLogs = [
  { time: "今天 10:12", shelter: "暖窩動物協會", kind: "轉人工", q: "最近要搬家，可能沒辦法繼續養了", a: "謝謝你告訴我們，我們會請協會人員聯絡你，一起討論可行的安排。", state: "正常" },
  { time: "今天 09:48", shelter: "山丘毛孩之家", kind: "健康問題", q: "狗狗一直吐，要先餵藥嗎？", a: "建議盡快諮詢獸醫，不建議自行用藥。已轉給協會。", state: "正常" },
  { time: "今天 08:41", shelter: "暖窩動物協會", kind: "建檔整理", q: "（語音）A 區都正常，小黑沒吃，阿福拉肚子", a: "拆成 3 筆紀錄，等待人員確認。", state: "正常" },
  { time: "昨天 21:05", shelter: "港邊浪貓社", kind: "送養文案", q: "產生橘子的介紹文", a: "文案出現「保證健康」字樣，已被規則攔下並要求重寫。", state: "待抽查" },
];

export const auditLogs = [
  { time: "今天 09:02", who: "管理者 周怡君", shelter: "暖窩動物協會", act: "停用工作號 HP-1A6D" },
  { time: "今天 08:41", who: "林小芸", shelter: "暖窩動物協會", act: "確認 3 筆照護紀錄" },
  { time: "昨天 18:20", who: "平台管理者", shelter: "港邊浪貓社", act: "延長試用期至 12/20" },
  { time: "昨天 11:15", who: "管理者 吳承翰", shelter: "山丘毛孩之家", act: "發布芝麻的送養介紹" },
];

export const invoices = [
  { shelter: "山丘毛孩之家", plan: "進階", amount: 980, date: "2026/11/01", state: "已收款" },
  { shelter: "暖窩動物協會", plan: "基本", amount: 490, date: "2026/11/01", state: "已收款" },
  { shelter: "稻田狗狗中途", plan: "基本", amount: 490, date: "2026/10/31", state: "待收款" },
  { shelter: "港邊浪貓社", plan: "試用", amount: 0, date: "2026/10/20", state: "試用中" },
];

export const faq: Record<string, string> = {
  "領養要多少錢？": "暖窩的領養不收費，但會請你負擔晶片登記和疫苗的實際費用。詳細金額可以在面談時向協會確認喔！",
  "怎麼預約參觀？": "週三至週日 13:00–17:00 開放，請先告訴我想看哪一隻，我會幫你送出預約給協會。",
};
