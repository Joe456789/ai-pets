"use client";
import { FlexCard, LineSim, type Scene } from "@/demo/line-sim/LineSim";
import { Notice } from "@/components/ui";
import { faq } from "@/demo/data";

const q1 = "領養要多少錢？";

const scenes: Scene[] = [
  { id: "faq", title: "1. AI 回答常見問題", hint: "領養流程、費用、開放時間，由協會設定的內容回答。", steps: [
    { me: true, text: q1 },
    { text: faq[q1] },
  ] },
  { id: "progress", title: "2. 查詢申請進度", hint: "領養人主動查詢，不用等協會通知。", steps: [
    { me: true, text: "我的申請進度" },
    { card: <FlexCard head="申請：阿福" rows={[["送出日期", "11/04"], ["目前進度", "協會審核中"], ["下一步", "協會會與你約面談"]]} /> },
  ] },
  { id: "health", title: "3. 健康問題不亂回答", hint: "AI 不做診斷，提醒找獸醫並通知協會。", steps: [
    { me: true, text: "狗狗這兩天一直吐，要先餵藥嗎？" },
    { card: <FlexCard alert head="建議盡快諮詢獸醫" note={<><span>我沒辦法判斷原因，也不建議自行用藥。如果持續嘔吐或精神變差，請盡快帶牠就醫。我已經通知協會人員，他們會再跟你聯絡。</span><Notice compact /></>} /> },
  ] },
  { id: "rehome", title: "4. 想退養時轉人工", hint: "不批評、不由 AI 處理，直接交給協會。", steps: [
    { me: true, text: "最近要搬家，可能沒辦法繼續養了……" },
    { text: "謝謝你告訴我們。這件事需要協會人員一起討論，我已經請他們盡快聯絡你。在那之前，如果有緊急狀況，可以直接打給協會。" },
    { card: <FlexCard head="已轉給協會人員" rows={[["協會", "暖窩動物協會"], ["狀態", "等待人員回覆"]]} /> },
  ] },
];

export default function AdopterLine() {
  return (
    <LineSim
      account="暖窩動物協會"
      sub="領養人視角"
      title="用戶端：協會的 LINE 官方帳號（操作示範）"
      lede="領養人從協會自己的官方帳號詢問。沒有自動回訪，領養人有事主動傳訊息，AI 先回答，需要人處理的轉給協會。"
      intro="你好，這裡是暖窩動物協會。有什麼想問的都可以傳訊息給我們！"
      scenes={scenes}
      menu={[{ label: "看領養動物" }, { label: "常見問題", scene: "faq" }, { label: "申請進度", scene: "progress" }, { label: "問照顧問題", scene: "health" }, { label: "聯絡協會", scene: "rehome" }, { label: "分享近況" }]}
      menuImage="/richmenu/adopter.png"
    />
  );
}
