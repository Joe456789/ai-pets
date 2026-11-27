"use client";
import { useCallback, useState } from "react";
import { checkShapePhotoAction } from "@/app/actions";

/**
 * 送出 3D 前先讓 AI 看第一張照片：躺著、坐著、正面或腳被切掉，做出來的身形就會壞。
 * 有問題時先提醒，飼主可以換照片，或確定後照樣送出。
 */
export function useShapeCheck() {
  const [warning, setWarning] = useState("");
  const [accepted, setAccepted] = useState(false);
  /** 回傳 true 代表可以送出。 */
  const check = async (first: File, force = false) => {
    if (accepted || force) return true;
    const form = new FormData();
    form.set("photo", first);
    const r = await checkShapePhotoAction(form);
    if (r.ok && !r.data.ok) { setWarning(r.data.problem); return false; }
    return true;
  };
  // 換了第一張照片就重新檢查；要固定同一個函式，放進 useEffect 才不會一直重跑
  const reset = useCallback(() => { setWarning(""); setAccepted(false); }, []);
  return { warning, check, reset, accept: () => { setAccepted(true); setWarning(""); } };
}

export function ShapeWarning({ text, onAccept, busy }: { text: string; onAccept: () => void; busy: boolean }) {
  if (!text) return null;
  return (
    <div className="notice stack" style={{ gap: 8 }}>
      <b>第一張照片可能做不好 3D</b>
      <span className="small">{text}</span>
      <span className="tiny">3D 的身形照第一張做，牠站著、從側面拍到全身最好。可以換一張再送出。</span>
      <button type="button" className="btn small" style={{ justifySelf: "start" }} disabled={busy} onClick={onAccept}>還是用這張送出</button>
    </div>
  );
}
