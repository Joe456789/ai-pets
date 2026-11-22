/** 切換分頁時馬上先出現骨架，資料讀好再換成真的內容，不會按了像沒反應。 */
export default function Loading() {
  return (
    <div className="skel" role="status" aria-label="載入中">
      <div className="skel-line" style={{ width: "46%", height: 26 }} />
      <div className="skel-line" style={{ width: "78%" }} />
      <div className="skel-card" />
      <div className="skel-card" />
      <div className="skel-card short" />
    </div>
  );
}
