"use client";
import { FlexCard, LineSim, type Scene } from "@/demo/line-sim/LineSim";
import { PetArt } from "@/components/PetArt";
import { Notice } from "@/components/ui";

const newDog = { kind: "狗" as const, color: "#b98a5e", bg: "#e6ecd8", name: "新進的狗" };

const scenes: Scene[] = [
  { id: "bind", title: "1. 用工作號綁定身分", hint: "傳送管理者發的專屬工作號，下方選單就會切換成工作選單。", steps: [
    { me: true, text: "A27391568" },
    { card: <FlexCard head="綁定成功" rows={[["姓名", "林小芸"], ["協會", "暖窩動物協會"], ["負責區域", "A、B 區"]]} note={<span className="small muted">你現在可以使用工作選單。此工作號已綁定這個 LINE 帳號。</span>} /> },
  ] },
  { id: "intake", title: "2. 新增動物", hint: "拍張照、講一段話，AI 產生檔案草稿，人員確認後才存檔。", steps: [
    { me: true, node: <PetArt pet={newDog} />, cls: "img" },
    { me: true, text: "▶ 語音 0:14\n「今天新進一隻棕色的公狗，中型，大概兩歲，在大河路那邊撿到的，還沒絕育，很親人。」" },
    { text: "收到，正在整理檔案…" },
    { card: <FlexCard head="AI 整理好了，請確認" rows={[["種類", "狗・公"], ["年齡", "約 2 歲"], ["體型", "中型"], ["毛色", "棕色"], ["發現地點", "大河路"], ["絕育", "尚未"], ["個性", "親人"], ["名字", "待取名"]]} acts={[{ label: "確認存檔", solid: true }, { label: "修改" }]} /> },
  ] },
  { id: "care", title: "3. 回報照護（只講有狀況的）", hint: "一句話講完整區，AI 會拆開記到每隻動物，不用逐隻填寫。", steps: [
    { me: true, text: "▶ 語音 0:06\n「A 區都正常，小黑今天沒吃，阿福拉肚子。」" },
    { card: <FlexCard head="AI 拆成 3 筆，請確認" rows={[["A 區其他動物", "無異常回報"], ["小黑", "今天未進食"], ["阿福", "拉肚子"]]} acts={[{ label: "確認", solid: true }, { label: "修改" }]} /> },
    { card: <FlexCard alert head="請留意：小黑" note={<><span>系統紀錄顯示小黑已連續 2 天回報未進食，建議持續留意，必要時諮詢獸醫。</span><Notice compact /></>} /> },
  ] },
  { id: "lookup", title: "4. 查詢動物", hint: "輸入名字，查看最近的狀況摘要。", steps: [
    { me: true, text: "小黑" },
    { card: <FlexCard head="小黑 NW-0231" rows={[["區域", "A 區"], ["疫苗到期", "2026/11/20"], ["最近回報", "今天未進食"], ["前次回報", "昨天晚餐幾乎沒吃"]]} /> },
  ] },
  { id: "digest", title: "5. 每日摘要", hint: "把待辦和提醒合併成一則，避免多次推播消耗 LINE 額度。", steps: [
    { card: <FlexCard head="今日摘要・11/05" rows={[["待回報區域", "B 區"], ["需留意", "小黑、阿福"], ["到期提醒", "小黑疫苗 11/20"]]} note={<span className="small muted">其餘動物無異常回報。</span>} /> },
  ] },
];

export default function StaffLine() {
  return (
    <LineSim
      account="暖窩動物協會"
      sub="現場人員視角"
      title="協會端：現場人員 LINE（操作示範）"
      lede="現場人員不用登入網頁或另外裝 App，每個人用自己的工作號綁定協會的官方帳號。"
      intro="歡迎！如果你是協會人員，請輸入工作號完成綁定。"
      unlockAfter="bind"
      scenes={scenes}
      menu={[{ label: "新增動物", scene: "intake" }, { label: "回報照護", scene: "care" }, { label: "查詢動物", scene: "lookup" }, { label: "今日摘要", scene: "digest" }, { label: "我的資料" }, { label: "使用說明" }]}
      menuImage="/richmenu/staff.png"
      lockedImage="/richmenu/adopter.png"
    />
  );
}
