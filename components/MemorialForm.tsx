"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { createMemorialAction } from "@/app/actions";
import { shrinkImage } from "@/lib/clientImage";

type PetOpt = { id: string; name: string };

export function MemorialForm({ pets, initial }: { pets: PetOpt[]; initial?: string }) {
  const router = useRouter();
  const [petId, setPetId] = useState(initial ?? pets[0]?.id ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [memories, setMemories] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  // 先複製出來：清空 input 時 FileList 也會跟著變空
  const add = (list: FileList | null) => { const picked = Array.from(list ?? []); setFiles((cur) => [...cur, ...picked].slice(0, 4)); };
  const makeFirst = (i: number) => setFiles((cur) => [cur[i], ...cur.filter((_, j) => j !== i)]);

  const submit = () => start(async () => {
    setError("");
    const form = new FormData();
    form.set("petId", petId);
    form.set("memories", memories);
    for (const f of files) form.append("photos", await shrinkImage(f));
    const r = await createMemorialAction(form);
    if (!r.ok) { setError(r.error); return; }
    router.push(`/memorial/${r.data}`);
  });

  return (
    <div className="card stack">
      <label className="field">為哪一隻建立紀念
        <select value={petId} onChange={(e) => setPetId(e.target.value)}>{pets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      </label>

      <div className="field">
        <span>照片（1～4 張）</span>
        <p className="tiny">第一張最重要：請選<b>站著、看得到全身的側面照</b>，3D 的身形會照這張做；其他角度（正面、背面）用來補臉和毛色。點照片可以設為第一張。</p>
        <ul className="points tiny photo-tips">
          <li><b>四隻腳分開、看得到腳掌</b>：腳黏在一起的照片，做出來跑跳時腳會變形。</li>
          <li>鏡頭和牠差不多高，不要從上往下拍。</li>
          <li>不要被人抱著、坐著或趴著；背景越單純越好。</li>
          <li>照片清楚、光線夠，毛色才會像。</li>
        </ul>
        {previews.length > 0 && (
          <div className="photo-grid">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {previews.map((u, i) => <img key={u} src={u} alt={`第 ${i + 1} 張`} className={i === 0 ? "first" : ""} onClick={() => makeFirst(i)} />)}
          </div>
        )}
        {files.length < 4 && <input type="file" accept="image/*" multiple onChange={(e) => { add(e.target.files); e.target.value = ""; }} />}
        {files.length > 0 && <button className="btn small" style={{ justifySelf: "start" }} onClick={() => setFiles([])}>清除照片</button>}
      </div>

      <label className="field">想留下的回憶（選填）
        <textarea value={memories} maxLength={1200} onChange={(e) => setMemories(e.target.value)} placeholder="牠最喜歡做什麼？你們之間有什麼小習慣？AI 可以依這些替牠寫一段紀念文，你確認後才會顯示。" />
      </label>

      {error && <p className="error-box">{error}</p>}
      <button className="btn primary" disabled={pending || !files.length || !petId} onClick={submit}>{pending ? "上傳中…" : "開始製作 3D 紀念"}</button>
      <p className="tiny">照片會送到我們的 3D 工作站重建模型，通常幾分鐘到幾小時內完成，完成後用 LINE 通知你。照片只用來做這個紀念。</p>
    </div>
  );
}
