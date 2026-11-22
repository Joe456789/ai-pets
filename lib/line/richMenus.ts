// 飼主圖文選單的定義。圖片由 scripts/render-rich-menus.mjs 產生，格子順序要一致。
import { liffUrl } from "@/lib/line/messages";

const W = 2500;
const H = 1686;
const COL = [0, 833, 1667, W];
const ROW = [0, 843, H];

type Action = { type: "postback"; data: string; displayText: string } | { type: "uri"; uri: string };

const postback = (data: string, displayText: string): Action => ({ type: "postback", data, displayText });
const open = (path: string): Action => ({ type: "uri", uri: liffUrl(path) });

function grid(actions: Action[]) {
  return actions.map((action, i) => {
    const c = i % 3;
    const r = Math.floor(i / 3);
    return { bounds: { x: COL[c], y: ROW[r], width: COL[c + 1] - COL[c], height: ROW[r + 1] - ROW[r] }, action };
  });
}

// 醫療紀錄在「我的毛孩」底下；使用說明改成在聊天室打「說明」。
export const OWNER_MENU_ITEMS = ["飼養前評估", "我的毛孩", "拍醫療單據", "照顧日曆", "飼主小學堂", "紀念與告別"];

export const ownerMenu = () => ({
  size: { width: W, height: H }, selected: true, name: "從此有你", chatBarText: "選單",
  areas: grid([
    open("/assess"), open("/me"), postback("a=record", "拍醫療單據"),
    open("/care"), postback("a=lesson", "飼主小學堂"), open("/memorial"),
  ]),
});
