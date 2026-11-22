"use client";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { confirmReceiptAction, readReceiptAction, type ReceiptPreview } from "@/app/actions";
import { shrinkImage } from "@/lib/clientImage";

const fmt = (d: string) => (d ? d.replaceAll("-", "/") : "看不清楚");

/** 在網頁直接拍醫療單據：拍照 → AI 照原文整理 → 你看過、按確認才存。流程和 LINE 聊天室的「拍醫療單據」一樣。 */
export function RecordUpload({ petId, petName }: { petId: string; petName: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ReceiptPreview | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState<"" | "read" | "save">("");
  const [, start] = useTransition();

  const pick = () => { setError(""); setSaved(false); input.current?.click(); };

  const read = (file: File | undefined) => {
    if (!file) return;
    setBusy("read");
    start(async () => {
      const form = new FormData();
      form.set("petId", petId);
      form.set("photo", await shrinkImage(file));
      const r = await readReceiptAction(form);
      setBusy("");
      if (!r.ok) { setError(r.error); return; }
      setPreview(r.data);
    });
  };

  const finish = (keep: boolean) => {
    if (!preview) return;
    setBusy("save");
    start(async () => {
      const r = await confirmReceiptAction(preview.token, keep);
      setBusy("");
      setPreview(null);
      if (!r.ok) { setError(r.error); return; }
      if (keep) { setSaved(true); router.refresh(); }
    });
  };
  // 手機只允許在按下的當下打開相機，所以直接開；舊的草稿在讀新照片時會被伺服器換掉。
  const retake = () => { setPreview(null); pick(); };

  const d = preview?.draft;
  return (
    <section className="card stack upload">
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; read(f); }} />
      {!preview && (
        <>
          <div className="row between">
            <div>
              <h2 style={{ margin: 0 }}>拍新的單據</h2>
              <p className="small muted" style={{ margin: "4px 0 0" }}>診斷證明、收據、明細或藥袋都可以，一次一張。</p>
            </div>
            <button className="btn primary" disabled={busy !== ""} onClick={pick}>{busy === "read" ? "整理中…" : "拍照或選照片"}</button>
          </div>
          {busy === "read" && <p className="notice">AI 正在照原文整理{petName}的單據，大約 10～20 秒。</p>}
          {saved && <p className="ok-box">已經存到下面的紀錄了。{"　"}<button className="linkish" onClick={pick}>再拍一張</button></p>}
          {error && <p className="error-box">{error}</p>}
        </>
      )}

      {preview && d && (
        <>
          <h2 style={{ margin: 0 }}>確認一下，沒問題再存</h2>
          <div className="review">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <a href={preview.photo} target="_blank" rel="noreferrer"><img className="thumb" src={preview.photo} alt="單據照片" /></a>
            <dl>
              <dt>日期</dt><dd>{fmt(d.visitDate)}</dd>
              {d.clinic && <><dt>醫院</dt><dd>{d.clinic}</dd></>}
              {d.items.length > 0 && <><dt>項目</dt><dd>{d.items.map((i) => (i.note ? `${i.name}（${i.note}）` : i.name)).join("、")}</dd></>}
              {d.meds.length > 0 && <><dt>藥品</dt><dd>{d.meds.map((m) => <div key={m.name}>{m.name}{m.usage && <span className="muted">：{m.usage}</span>}</div>)}</dd></>}
              {d.followUp && <><dt>回診</dt><dd>{fmt(d.followUp)}（前一天用 LINE 提醒你）</dd></>}
              {d.total !== null && <><dt>金額</dt><dd>{d.total.toLocaleString()} 元</dd></>}
            </dl>
          </div>
          {d.terms.length > 0 && (
            <div className="terms">
              <b className="small">名詞白話說明</b>（一般意思，詳情請問你的獸醫）
              {d.terms.map((t) => <div key={t.term}>・<b>{t.term}</b>：{t.plain}</div>)}
            </div>
          )}
          <p className="tiny">AI 只照單據上寫的整理，不做判讀。有看錯的地方，請按「重拍」拍清楚一點。</p>
          <div className="row">
            <button className="btn primary" disabled={busy !== ""} onClick={() => finish(true)}>{busy === "save" ? "存檔中…" : "確認存檔"}</button>
            <button className="btn" disabled={busy !== ""} onClick={retake}>重拍</button>
            <button className="btn small" disabled={busy !== ""} onClick={() => finish(false)}>不要存</button>
          </div>
        </>
      )}
    </section>
  );
}
