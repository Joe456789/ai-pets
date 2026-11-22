import { HEALTH_NOTICE } from "@/lib/constants";
import type { LineMessage } from "@/lib/line/client";
import { quizOf, type Lesson } from "@/lib/lessons";
import type { CareItem, PetDoc, RecordDraft, ReminderDoc } from "@/lib/types";

const ROSE = "#B5523B";
const MOSS = "#2F5D50";
const INK = "#26302B";
const MUTED = "#6B736D";

/** LINE 裡打開網頁用 LIFF 網址，這樣網頁會自動知道是哪位飼主。沒有設定 LIFF 時退回一般網址。 */
export function liffUrl(path: string) {
  const id = process.env.LIFF_ID;
  if (id) return `https://liff.line.me/${id}${path}`;
  return `${(process.env.APP_URL ?? "").replace(/\/$/, "")}${path}`;
}

type Button = { label: string; data?: string; uri?: string; primary?: boolean };

export function text(body: string, quick?: { label: string; data?: string; text?: string }[]): LineMessage {
  const msg: LineMessage = { type: "text", text: body.slice(0, 4900) };
  if (quick?.length) {
    msg.quickReply = {
      items: quick.slice(0, 13).map((q) => ({
        type: "action",
        action: q.data
          ? { type: "postback", label: q.label.slice(0, 20), data: q.data, displayText: q.label }
          : { type: "message", label: q.label.slice(0, 20), text: q.text ?? q.label },
      })),
    };
  }
  return msg;
}

function row(key: string, value: string) {
  return {
    type: "box", layout: "baseline", spacing: "md",
    contents: [
      { type: "text", text: key, size: "sm", color: MUTED, flex: 3, wrap: true },
      { type: "text", text: value || "—", size: "sm", color: value ? INK : MUTED, flex: 6, wrap: true, align: "end" },
    ],
  };
}

export function card(opts: { alt: string; head: string; tone?: "rose" | "moss"; rows?: [string, string][]; note?: string; notice?: boolean; buttons?: Button[] }): LineMessage {
  const body: unknown[] = (opts.rows ?? []).map(([k, v]) => row(k, v));
  if (opts.note) body.push({ type: "text", text: opts.note, size: "sm", color: INK, wrap: true, margin: body.length ? "md" : undefined });
  if (opts.notice) body.push({ type: "text", text: HEALTH_NOTICE, size: "xxs", color: MUTED, wrap: true, margin: "md" });
  const bubble: Record<string, unknown> = {
    type: "bubble",
    header: {
      type: "box", layout: "vertical", backgroundColor: opts.tone === "moss" ? MOSS : ROSE, paddingAll: "12px",
      contents: [{ type: "text", text: opts.head, color: "#FFFFFF", weight: "bold", size: "md", wrap: true }],
    },
    body: { type: "box", layout: "vertical", spacing: "sm", paddingAll: "14px", contents: body.length ? body : [{ type: "text", text: " " }] },
  };
  if (opts.buttons?.length) {
    bubble.footer = {
      type: "box", layout: "vertical", spacing: "sm",
      contents: opts.buttons.map((b) => ({
        type: "button", style: b.primary ? "primary" : "secondary", color: b.primary ? ROSE : undefined, height: "sm",
        action: b.uri ? { type: "uri", label: b.label, uri: b.uri } : { type: "postback", label: b.label, data: b.data, displayText: b.label },
      })),
    };
  }
  return { type: "flex", altText: opts.alt.slice(0, 390), contents: bubble };
}

export const WELCOME =
  "歡迎來到「從此有你」。\n\n從決定要不要養、照顧牠一輩子，到最後好好說再見，我們都陪著你。\n\n・飼養前評估：先想清楚時間、經濟、住處和家人\n・生活變動檢查：搬家、懷孕、出國時，幫你一步步準備\n・照顧日曆：驅蟲、疫苗、健檢，前一天用 LINE 提醒\n・飼主小學堂：依毛孩的月齡和季節，在對的時候上對的課\n・醫療單據：拍下看診單據，AI 幫你整理成紀錄\n・紀念與告別：用照片為離開的牠做一個 3D 紀念\n\n從下方選單開始，隨時打「說明」可以看使用說明。";

export const HELP =
  "使用說明\n\n【飼養前評估】回答 15 個問題，得到準備度報告和一輩子花費的粗估。\n【生活變動檢查】已經在養的人，遇到搬家、懷孕、出國、工作變忙時做，拿到分階段的準備清單；填了日期會在前一週提醒你。也可以直接在聊天室打「我要搬家」。\n【我的毛孩】新增或編輯毛孩，每隻都有醫療紀錄。\n【拍醫療單據】選毛孩後傳單據照片，AI 照原文整理，確認後才存檔；有回診日會在前一天提醒你。\n【照顧日曆】加入驅蟲、疫苗、健康檢查，到期前一天提醒，按「完成了」就幫你算下一次。\n【飼主小學堂】依毛孩的月齡排課：疫苗、結紮、老年健檢這類有時機的課，時間到了就推給你；平常每月一課，換季時有季節課。附小測驗，打「小學堂」隨時再來一課。\n【紀念與告別】上傳照片，為離開的毛孩做 3D 紀念。\n\n" + HEALTH_NOTICE;

export function linkCard(head: string, note: string, label: string, path: string): LineMessage {
  return card({ alt: head, head, note, buttons: [{ label, uri: liffUrl(path), primary: true }] });
}

export function pickPet(pets: PetDoc[], action: string, prompt: string): LineMessage {
  return text(prompt, pets.slice(0, 12).map((p) => ({ label: p.name, data: `a=${action}&p=${p.id}` })));
}

export function recordDraftCard(d: RecordDraft, petName: string, token: string): LineMessage {
  const rows: [string, string][] = [
    ["毛孩", petName],
    ["看診日期", d.visitDate],
    ["醫院", d.clinic],
    ["項目", d.items.map((i) => (i.note ? `${i.name}（${i.note}）` : i.name)).join("\n")],
    ["藥品", d.meds.map((m) => (m.usage ? `${m.name}：${m.usage}` : m.name)).join("\n")],
    ["回診日", d.followUp],
    ["金額", d.total ? `${d.total.toLocaleString()} 元` : ""],
  ];
  const terms = d.terms.map((t) => `・${t.term}：${t.plain}`).join("\n");
  return card({
    alt: `${petName}的醫療單據整理`, head: "AI 整理好了，請確認", tone: "moss", rows,
    note: `${terms ? `名詞白話說明（一般意思，詳情請問你的獸醫）\n${terms}\n\n` : ""}內容照單據原文整理，不是診斷。有錯的話按「重拍」。`,
    notice: true,
    buttons: [{ label: "確認存檔", data: `a=record_ok&t=${token}`, primary: true }, { label: "重拍", data: `a=record_retry&t=${token}` }],
  });
}

export function savedRecordCard(petName: string, petId: string, followUp: string): LineMessage {
  return card({
    alt: "已存檔", head: `已存到${petName}的醫療紀錄`, tone: "moss",
    note: followUp ? `回診日 ${followUp.replaceAll("-", "/")}，前一天會提醒你。` : "之後可以在「醫療紀錄」看所有看診和花費。",
    buttons: [{ label: "看醫療紀錄", uri: liffUrl(`/pets/${petId}/records`) }],
  });
}

export function reminderCard(r: Pick<ReminderDoc, "text" | "petId" | "kind" | "path">): LineMessage {
  if (r.kind === "生活變動") {
    return card({ alt: r.text, head: "生活變動提醒", tone: "moss", note: r.text, buttons: [{ label: "打開準備清單", uri: liffUrl(r.path ?? "/me"), primary: true }] });
  }
  return card({ alt: r.text, head: "回診提醒", note: r.text, notice: true, buttons: [{ label: "看醫療紀錄", uri: liffUrl(`/pets/${r.petId}/records`) }] });
}

/** 文字裡提到生活變動時，請他做生活變動檢查。 */
export const changeCard = () => linkCard(
  "生活要有變動了嗎？",
  "搬家、懷孕、出國、工作變忙、經濟變緊時，做一次「生活變動檢查」，三分鐘拿到分階段的準備清單，讓牠可以繼續留在你身邊。",
  "開始檢查", "/change",
);

const slash = (d: string) => d.slice(5).replace("-", "/");

export function careReminderCard(c: CareItem, today: string): LineMessage {
  const when = c.nextDue === today ? "今天" : `明天（${slash(c.nextDue)}）`;
  return card({
    alt: `${c.petName}${when}該做${c.label}`, head: "照顧提醒", tone: "moss",
    rows: [["毛孩", c.petName], ["項目", c.label], ["日期", when]],
    note: "做完按「完成了」，我會幫你算下一次。間隔請照獸醫的建議。",
    buttons: [{ label: "完成了", data: `a=care_done&c=${c.id}`, primary: true }, { label: "打開照顧日曆", uri: liffUrl("/care") }],
  });
}

export function careDoneText(c: CareItem) {
  return text(`記下來了：${c.petName}的${c.label}。\n下一次是 ${c.nextDue.replaceAll("-", "/")}，前一天會提醒你。`);
}

/** 小學堂卡片：重點加一題測驗，答案直接在聊天室按。 */
export function lessonCard(l: Lesson, why: string, monthly = false): LineMessage {
  const quiz = quizOf(l);
  return card({
    alt: `${monthly ? "本月小學堂" : "小學堂"}：${l.title}`, head: `${monthly ? "本月小學堂" : "小學堂"}：${l.title}`, tone: "moss",
    note: `${why ? `（${why}）\n\n` : ""}${l.points.map((p) => `・${p}`).join("\n")}\n\n小測驗：${quiz.q}`,
    buttons: [
      ...quiz.options.map((o, i) => ({ label: o.slice(0, 20), data: `a=quiz&l=${l.id}&c=${i}` })),
      { label: "看完整內容", uri: liffUrl(`/learn/${l.id}`) },
    ],
  });
}

export function memorialReadyCard(petName: string, memorialId: string): LineMessage {
  return card({
    alt: `${petName}的 3D 紀念完成了`, head: `${petName}的 3D 紀念完成了`,
    note: "用你的照片重建的樣子，可以轉動看看，也可以用手機放在身邊。",
    buttons: [{ label: "去看看牠", uri: liffUrl(`/memorial/${memorialId}`), primary: true }],
  });
}
