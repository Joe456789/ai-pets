export type Tri = "是" | "否" | "未知";
export type Energy = "低" | "中" | "高" | "未知";
export type AnimalStatus = "開放領養" | "在所照護" | "送醫中" | "已領養";
export type ApplicationStatus = "待審核" | "面談中" | "已通過" | "未通過";
export type ConversationStatus = "待處理" | "處理中" | "已結案" | "AI 已回覆";
export type ConversationTag = "想退養" | "健康疑慮" | "緊急" | "近況" | "其他";

export type MatchTags = { energy: Energy; beginnerOk: Tri; kidOk: Tri; apartmentOk: Tri };

export type Faq = { q: string; a: string };

export type ShelterDoc = {
  id: string;
  name: string;
  area: string;
  intro: string;
  hours: string;
  phone: string;
  codePrefix: string;
  areas: string[];
  faq: Faq[];
  lineAddUrl?: string;
  /** 每月 AI 呼叫上限，沒設定時用環境變數的預設值。 */
  aiCap?: number | null;
  createdAt?: string;
  plan: "試用" | "基本" | "進階";
  due: string;
  status: "使用中" | "試用中" | "已停用";
};

export type LineCreds = { channelSecret: string; channelAccessToken: string; staffMenuId?: string; adopterMenuId?: string };

export type ManagerDoc = { email: string; name: string; sid: string; passwordHash: string };

export type StaffDoc = {
  code: string;
  name: string;
  role: "現場人員" | "志工";
  area: string;
  disabled: boolean;
  createdAt?: string;
  lineUserId?: string;
  boundAt?: string;
  lastReportAt?: string;
};

export type AnimalDoc = {
  id: string;
  code: string;
  name: string;
  kind: "狗" | "貓" | "其他";
  sex: "公" | "母" | "未知";
  age: string;
  ageGroup: "幼年" | "成年" | "老年" | "未知";
  size: "小型" | "中型" | "大型" | "未知";
  coat: string;
  foundAt: string;
  area: string;
  neutered: Tri;
  status: AnimalStatus;
  intakeAt: string;
  vaccineDue: string;
  traits: string[];
  story: string;
  needs: string[];
  goodFor: string[];
  photos: string[];
  color?: string;
  bg?: string;
  tags: MatchTags;
  published: boolean;
  draft?: { web: string; social: string; at: string };
  social?: string;
  flaggedUntil?: string;
  flagNote?: string;
  adoptedAt?: string;
  /** 去背後的透明 PNG，給 AR 試放使用。 */
  cutout?: string;
  motion?: MotionDoc;
  /** 由照片做成的 3D 模型（GLB 網址），AR 相機模式會用它 */
  model3d?: string;
};

/** AI 生成的動態影片：綠幕 MP4，播放時在瀏覽器去掉綠色。協會確認（approved）後才會公開。 */
export type MotionDoc = {
  status: "生成中" | "完成" | "失敗";
  at: string;
  approved: boolean;
  idle?: string;
  reactions: Record<string, string>;
  error?: string;
};
export type PublicMotion = { idle: string; reactions: Record<string, string> };

export type PublicAnimal = Pick<
  AnimalDoc,
  "name" | "kind" | "sex" | "age" | "ageGroup" | "size" | "coat" | "neutered" | "traits" | "story" | "needs" | "goodFor" | "photos" | "color" | "bg" | "tags"
> & { id: string; sid: string; animalId: string; shelterName: string; shelterArea: string; publishedAt: string; cutout?: string; motion?: PublicMotion; model3d?: string };

export type CareCategory = "食慾" | "排便" | "嘔吐" | "受傷" | "精神" | "行為" | "醫療" | "其他";
export type CareDoc = {
  id: string;
  animalId: string;
  at: string;
  who: string;
  text: string;
  category: CareCategory;
  concerning: boolean;
};

export type ApplicationDoc = {
  id: string;
  publicCode: string;
  animalId: string;
  animalName: string;
  who: string;
  phone: string;
  housing: string;
  family: string;
  plan: string;
  message: string;
  status: ApplicationStatus;
  createdAt: string;
  score: number;
  reason: string;
  answers?: Record<string, string>;
  lineUserId?: string;
};

export type ChatMessage = { at: string; from: "user" | "ai" | "staff"; text: string; photo?: string };
export type ConversationDoc = {
  id: string;
  displayName: string;
  tag: ConversationTag;
  status: ConversationStatus;
  lastAt: string;
  lastAckAt?: string;
  messages: ChatMessage[];
};

export type IntakeDraft = {
  kind: "狗" | "貓" | "其他" | "未知";
  sex: "公" | "母" | "未知";
  name: string;
  age: string;
  ageGroup: "幼年" | "成年" | "老年" | "未知";
  size: "小型" | "中型" | "大型" | "未知";
  coat: string;
  foundAt: string;
  neutered: Tri;
  traits: string[];
  notes: string;
};

export type CareEntryDraft = {
  animalId: string;
  mentionedName: string;
  text: string;
  category: CareCategory;
  concerning: boolean;
  candidates?: string[];
};
export type CareDraft = { areas: string[]; entries: CareEntryDraft[] };

export type LineUserState =
  | { mode: "none" }
  | { mode: "intake"; photos: string[] }
  | { mode: "intake_review"; token: string; photos: string[]; draft: IntakeDraft }
  | { mode: "intake_edit"; token: string; photos: string[]; draft: IntakeDraft }
  | { mode: "care" }
  | { mode: "care_review"; token: string; draft: CareDraft }
  | { mode: "lookup" }
  | { mode: "progress" }
  | { mode: "askcare" }
  | { mode: "contact" }
  | { mode: "share" };

export type LineUserDoc = {
  id: string;
  staffCode?: string;
  state: LineUserState;
  failedBinds?: number;
  blockedUntil?: string;
};
