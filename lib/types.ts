// 「從此有你」的資料型別。資料都放在飼主底下：owners/{uid}/...，uid 是 LINE 使用者 ID。

export type PetKind = "狗" | "貓";
export type PetSize = "小型" | "中型" | "大型";
export type PetStatus = "在世" | "已離開";

export type OwnerDoc = {
  uid: string;
  displayName: string;
  createdAt: string;
  /** LINE 對話進行到哪一步，只在 LINE 流程使用。 */
  state?: OwnerState;
  /** 最近一次推播「本月小學堂」的月份（2026-11），每月只推一次。 */
  lessonMonth?: string;
  /** 到了最佳月齡而主動推過的課（課程 ID），同一課不重複推。 */
  lessonPushed?: string[];
  /** 最近一次主動推課的日期（2026-11-20），兩次之間至少隔 7 天。 */
  lessonPushedAt?: string;
};

/* 照顧日曆：驅蟲、疫苗、健康檢查這類定期要做的事。放在 care/{id}，排程才能跨飼主找到明天要提醒的。 */
export type CareKind = "驅蟲" | "疫苗" | "健康檢查" | "其他";

export type CareItem = {
  id: string;
  uid: string;
  petId: string;
  petName: string;
  kind: CareKind;
  label: string;
  everyMonths: number;
  /** 上次做的日期 2026-11-20；不記得就留空。 */
  lastDone: string;
  nextDue: string;
  /** 已經為哪一個 nextDue 提醒過，避免重複推播。 */
  remindedFor: string;
  createdAt: string;
};

/* 飼主小學堂 */
export type Stage = "養之前" | "幼年" | "成年" | "老年";
export type LessonProgress = { id: string; correct: boolean; at: string };

export type OwnerState =
  | { mode: "none" }
  | { mode: "record_photo"; petId: string }
  | { mode: "record_review"; petId: string; token: string; photo: string; draft: RecordDraft };

export type PetDoc = {
  id: string;
  name: string;
  kind: PetKind;
  size?: PetSize;
  sex?: "公" | "母" | "";
  /** 生日或大約出生年月，格式 2020-05，可留空。 */
  birth?: string;
  photo?: string;
  /** 已結紮、已植入晶片並登記：做過了，小學堂就不再推那一課。 */
  neutered?: boolean;
  chipped?: boolean;
  status: PetStatus;
  passedAt?: string;
  createdAt: string;
};

/* 飼養前評估 */
export type Readiness = "準備好了" | "再準備一下" | "先等等";

export type AssessAnswers = {
  kind: "狗" | "貓" | "還沒決定";
  alone: "4 小時以內" | "4～8 小時" | "8～10 小時" | "10 小時以上";
  /** 每天能陪玩或散步多久。 */
  activity: "30 分鐘以內" | "30 分鐘～1 小時" | "1 小時以上";
  travel: "很少" | "每月 1～2 次" | "經常";
  budget: "2,000 元以內" | "2,000～4,000 元" | "4,000～6,000 元" | "6,000 元以上";
  fund: "沒有" | "1 萬元以內" | "1～3 萬元" | "3 萬元以上";
  housing: "自有住宅" | "租屋，房東同意" | "租屋，還沒問房東" | "租屋，房東不同意" | "住家裡，家人同意" | "住家裡，家人還沒同意";
  space: "套房" | "公寓或大樓" | "有院子";
  family: ("6 歲以下小孩" | "長輩" | "懷孕或備孕" | "有人過敏")[];
  otherPets: "沒有" | "有狗" | "有貓" | "有鳥、兔子或鼠類";
  changes: ("可能搬家" | "出國讀書或工作" | "換工作或輪班" | "結婚或同居")[];
  experience: "第一次養" | "養過貓或狗" | "現在就有";
  backup: "家人或室友" | "朋友" | "寵物保姆或住宿" | "還沒想過";
  /** 十幾年後自己的體力和健康。 */
  ownerHealth: "應該可以" | "不確定" | "可能會有困難";
  reason: "想有個陪伴" | "家裡小孩想要" | "想送給別人" | "看到覺得很可愛" | "想了很久";
  /** 想補充的話，選填，給 AI 參考。 */
  why?: string;
};

/* 生活變動檢查：已經在養的人遇到搬家、懷孕、出國等變動時做，拿到分階段的準備清單。 */
export type ChangeKind = "搬家" | "懷孕或家裡有新生兒" | "出國或長時間不在家" | "工作變忙或輪班" | "經濟變緊" | "結婚或同居" | "家人過敏或生病" | "自己生病或體力變差";

export type ChangeAnswers = {
  petKind: PetKind;
  change: ChangeKind;
  when: "已經發生" | "一個月內" | "一到三個月" | "三個月以後";
  /** 大概哪一天（2026-12-20），選填；有填就在前幾天用 LINE 提醒。 */
  date?: string;
  /** 依變動種類問的那一題的答案。 */
  detail: string;
  helper: "家人或室友" | "朋友" | "寵物保姆或住宿" | "沒有人";
  /** 擔不擔心之後沒辦法繼續養：棄養風險最直接的訊號。 */
  worry: "不擔心" | "有點擔心" | "很擔心";
  note?: string;
};

export type ChangePhase = "現在" | "變動前" | "變動後";
export type ChangePlan = {
  level: "低" | "中" | "高";
  headline: string;
  /** 為什麼是這個程度，規則算出來的。 */
  why: string[];
  steps: { phase: ChangePhase; text: string }[];
  help: string[];
};

export type ChangeDoc = {
  id: string;
  at: string;
  petId: string;
  petName: string;
  answers: ChangeAnswers;
  plan: ChangePlan;
  /** AI 依答案寫的一段話；失敗時是 null，只顯示規則清單。 */
  aiNote: string | null;
  /** 設了提醒時，提醒推播的日期（前一天推）。 */
  remindOn?: string;
};

export type Dimension = { key: "time" | "money" | "home" | "family" | "future" | "support"; label: string; score: number; note: string };
export type Risk = { level: "高" | "中"; text: string };

export type ReadinessResult = {
  total: number;
  verdict: Readiness;
  dims: Dimension[];
  risks: Risk[];
  /** 依規則建議的類型，不推薦個別動物。 */
  fit: { kind: string; size: string; age: string; energy: string; why: string[] };
};

export type AssessReport = {
  summary: string;
  strengths: string[];
  prepare: string[];
  ifNotReady: string[];
};

export type AssessmentDoc = {
  id: string;
  at: string;
  answers: AssessAnswers;
  result: ReadinessResult;
  report: AssessReport | null;
};

/* 醫療紀錄 */
export type RecordDraft = {
  isMedicalDoc: boolean;
  visitDate: string;
  clinic: string;
  items: { name: string; note: string }[];
  meds: { name: string; usage: string }[];
  followUp: string;
  total: number | null;
  terms: { term: string; plain: string }[];
};

export type RecordDoc = RecordDraft & {
  id: string;
  petId: string;
  photo: string;
  createdAt: string;
};

export type ReminderDoc = {
  id: string;
  uid: string;
  petId: string;
  petName: string;
  date: string;
  text: string;
  sent: boolean;
  /** 沒寫就是回診提醒。生活變動提醒會帶上準備清單的頁面。 */
  kind?: "回診" | "生活變動";
  path?: string;
};

/* 紀念與告別 */
export type MemorialStatus = "排隊中" | "製作中" | "完成" | "失敗";

export type MemorialDoc = {
  id: string;
  uid: string;
  petId: string;
  petName: string;
  kind: PetKind;
  /** 肩高（公分），給真實大小 AR 用。 */
  heightCm: number;
  photos: string[];
  memories: string;
  tribute: string;
  tributeOk: boolean;
  status: MemorialStatus;
  glb?: string;
  error?: string;
  shareToken?: string;
  createdAt: string;
  updatedAt: string;
};

export type LineCreds = { channelSecret: string; channelAccessToken: string; menuId?: string };
