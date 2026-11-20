// 兩套圖文選單的定義。圖片由 scripts/render-rich-menus.mjs 產生，格子順序要一致。
const W = 2500;
const H = 1686;
const COL = [0, 833, 1667, W];
const ROW = [0, 843, H];

type Action = { type: "postback"; data: string; displayText: string } | { type: "uri"; uri: string };

const postback = (data: string, displayText: string): Action => ({ type: "postback", data, displayText });

function grid(actions: Action[]) {
  return actions.map((action, i) => {
    const c = i % 3;
    const r = Math.floor(i / 3);
    return { bounds: { x: COL[c], y: ROW[r], width: COL[c + 1] - COL[c], height: ROW[r + 1] - ROW[r] }, action };
  });
}

export const STAFF_MENU_ITEMS = ["新增動物", "回報照護", "查詢動物", "今日摘要", "我的資料", "使用說明"];
export const ADOPTER_MENU_ITEMS = ["看領養動物", "常見問題", "申請進度", "問照顧問題", "聯絡協會", "分享近況"];

export const staffMenu = () => ({
  size: { width: W, height: H }, selected: true, name: "浪浪夥伴 現場人員", chatBarText: "工作選單",
  areas: grid([
    postback("a=intake", "新增動物"), postback("a=care", "回報照護"), postback("a=lookup", "查詢動物"),
    postback("a=digest", "今日摘要"), postback("a=me", "我的資料"), postback("a=help", "使用說明"),
  ]),
});

export const adopterMenu = (appUrl: string, sid: string) => ({
  size: { width: W, height: H }, selected: true, name: "浪浪夥伴 領養人", chatBarText: "選單",
  areas: grid([
    { type: "uri", uri: `${appUrl}/adopt/shelters/${sid}` }, postback("a=faq", "常見問題"), postback("a=progress", "申請進度"),
    postback("a=askcare", "問照顧問題"), postback("a=contact", "聯絡協會"), postback("a=share", "分享近況"),
  ]),
});
