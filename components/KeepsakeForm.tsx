"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { createKeepsakeAction } from "@/app/actions";
import { shrinkImage } from "@/lib/clientImage";
import { KEEPSAKE_MAX } from "@/lib/constants";

/** 拍照模式的角度，第一個（側面全身）決定 3D 的身形，其他用來補臉和毛色。 */
const ANGLES = [
  { name: "側面全身", tip: "牠站著，你在牠旁邊，四隻腳都看得到", must: true },
  { name: "正面", tip: "蹲低到牠眼睛的高度，拍到臉和前腳" },
  { name: "另一側", tip: "繞到另一邊，一樣拍全身" },
  { name: "背面", tip: "從後面拍，看得到尾巴和背上的毛色" },
  { name: "斜前方", tip: "站在牠斜前面，拍到臉的側邊和身體" },
  { name: "頭的側面", tip: "靠近一點，拍頭的側面，鼻子才會立體" },
];
const CANDIDATES = 12;

/** 從影片平均抓出幾張畫面（全在手機上做，影片不會上傳）。 */
async function framesFrom(file: File, count: number): Promise<File[]> {
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = url;
  try {
    await new Promise<void>((ok, bad) => { v.onloadedmetadata = () => ok(); v.onerror = () => bad(new Error("這段影片讀不出來，換一段或改用拍照")); });
    // iPhone 要先播一下，跳到某個時間點才畫得出畫面
    await v.play().then(() => v.pause()).catch(() => undefined);
    const dur = v.duration;
    if (!isFinite(dur) || dur < 2) throw new Error("影片太短了，至少錄 5 秒");
    const k = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k);
    const out: File[] = [];
    for (let i = 0; i < count; i++) {
      v.currentTime = dur * (0.03 + 0.94 * i / (count - 1));
      await new Promise((ok) => { v.onseeked = ok; });
      c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
      const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/jpeg", 0.88));
      if (blob) out.push(new File([blob], `frame${i}.jpg`, { type: "image/jpeg" }));
    }
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function usePreviews(files: (File | null)[]) {
  const [urls, setUrls] = useState<(string | null)[]>([]);
  useEffect(() => {
    const u = files.map((f) => (f ? URL.createObjectURL(f) : null));
    setUrls(u);
    return () => u.forEach((x) => x && URL.revokeObjectURL(x));
  }, [files]);
  return urls;
}

export function KeepsakeForm({ petId, name }: { petId: string; name: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"photo" | "video">("photo");
  const [shots, setShots] = useState<(File | null)[]>(ANGLES.map(() => null));
  const [frames, setFrames] = useState<File[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const shotUrls = usePreviews(shots);
  const [inLine, setInLine] = useState(false);
  useEffect(() => setInLine(/ Line\//i.test(navigator.userAgent)), []);
  const frameUrls = usePreviews(frames);

  const setShot = (i: number, f: File | undefined) => setShots((cur) => cur.map((x, j) => (j === i ? f ?? null : x)));

  const readVideo = async (f: File | undefined) => {
    if (!f) return;
    setError(""); setReading(true); setFrames([]); setPicked([]);
    try {
      const got = await framesFrom(f, CANDIDATES);
      setFrames(got);
      // 預設：第一張（開始錄時在側面）加上平均分布的幾張
      setPicked([0, 2, 4, 6, 8, 10].filter((i) => i < got.length).slice(0, KEEPSAKE_MAX));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReading(false);
    }
  };
  const toggle = (i: number) => setPicked((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : cur.length < KEEPSAKE_MAX ? [...cur, i] : cur));

  const chosen = mode === "photo" ? (shots[0] ? shots.filter((f): f is File => Boolean(f)) : []) : picked.map((i) => frames[i]);
  const submit = () => start(async () => {
    setError("");
    const form = new FormData();
    form.set("petId", petId);
    for (const f of chosen) form.append("photos", mode === "photo" ? await shrinkImage(f) : f);
    const r = await createKeepsakeAction(form);
    if (!r.ok) { setError(r.error); return; }
    router.push(`/memorial/${r.data}`);
  });

  return (
    <div className="card stack">
      <div className="row" role="tablist" style={{ gap: 6 }}>
        <button className={`btn small ${mode === "photo" ? "primary" : ""}`} onClick={() => setMode("photo")}>照著指示拍照</button>
        <button className={`btn small ${mode === "video" ? "primary" : ""}`} onClick={() => setMode("video")}>錄一段影片</button>
      </div>

      <ul className="points tiny photo-tips">
        <li>找{name}比較放鬆的時候，<b>站著不動</b>最好，可以請家人拿零食吸引牠。</li>
        <li>鏡頭和牠的眼睛差不多高，不要從上往下拍。光線充足、背景單純。</li>
        <li>每個角度的姿勢要一樣，牠換了姿勢就從頭再拍。</li>
      </ul>

      {mode === "photo" ? (
        <div className="stack">
          {ANGLES.map((a, i) => (
            <div className="row" key={a.name} style={{ gap: 10, alignItems: "center" }}>
              {shotUrls[i]
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={shotUrls[i]!} alt={a.name} style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 10 }} />
                : <span className="tiny" style={{ width: 64, height: 64, display: "grid", placeItems: "center", border: "1px dashed var(--line)", borderRadius: 10 }}>{i + 1}</span>}
              <div className="grow">
                <b>{a.name}</b>{a.must ? <span className="tiny">（一定要，3D 的身形照這張做）</span> : <span className="tiny">（選填）</span>}
                <div className="tiny muted">{a.tip}</div>
              </div>
              <div className="stack" style={{ gap: 4 }}>
                <label className="btn small">
                  {shots[i] ? "重拍" : "拍照"}
                  <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => { setShot(i, e.target.files?.[0]); e.target.value = ""; }} />
                </label>
                <label className="btn small">
                  相簿
                  <input type="file" accept="image/*" hidden onChange={(e) => { setShot(i, e.target.files?.[0]); e.target.value = ""; }} />
                </label>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="stack">
          <p className="small">從<b>牠的側面開始錄</b>，慢慢繞牠走一圈（大約 15～30 秒），鏡頭一直對著牠。錄完我們會在你的手機上挑出幾張畫面，<b>影片本身不會上傳</b>。</p>
          <div className="row" style={{ gap: 8 }}>
            {/* android/allowCamera：Android 14 以後只寫 video/* 不會出現錄影選項 */}
            <label className="btn">
              {frames.length ? "重新錄" : "開始錄影"}
              <input type="file" accept="video/*,android/allowCamera" capture="environment" hidden onChange={(e) => { readVideo(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            <label className="btn">
              從相簿選影片
              <input type="file" accept="video/*" hidden onChange={(e) => { readVideo(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
          </div>
          {inLine && <p className="tiny">在 LINE 裡選不到影片的話，可以先用手機相機錄好，再<a href={`${typeof location !== "undefined" ? location.pathname : ""}?openExternalBrowser=1`}>用手機瀏覽器打開這一頁</a>（用 LINE 帳號登入）從相簿選；或改用「照著指示拍照」。</p>}
          {reading && <p className="small muted">正在從影片挑畫面…</p>}
          {frames.length > 0 && (
            <>
              <p className="tiny">點畫面可以選或取消（最多 {KEEPSAKE_MAX} 張），數字是點的順序。<b>1 號要是側面全身</b>，3D 的身形照它做；不對的話按「全部取消」，先點側面那張。</p>
              <button type="button" className="btn small" style={{ justifySelf: "start" }} onClick={() => setPicked([])}>全部取消</button>
              <div className="photo-grid">
                {frameUrls.map((u, i) => u && (
                  <button key={u} type="button" onClick={() => toggle(i)}
                    style={{ position: "relative", padding: 0, border: "none", background: "none", opacity: picked.includes(i) ? 1 : 0.35 }} aria-pressed={picked.includes(i)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt={`畫面 ${i + 1}`} className={picked[0] === i ? "first" : ""} />
                    {picked.includes(i) && <span className="badge" style={{ position: "absolute", top: 4, left: 4 }}>{picked.indexOf(i) + 1}</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {error && <p className="error-box">{error}</p>}
      <button className="btn primary" disabled={pending || chosen.length < 2} onClick={submit}>
        {pending ? "上傳中…" : chosen.length < 2 ? "至少要 2 個角度（含側面全身）" : `用這 ${chosen.length} 張留下${name}的 3D`}
      </button>
      <p className="tiny">照片會送到我們的 3D 工作站，通常幾分鐘到幾小時內完成，做好用 LINE 通知你。照片只用來做牠的 3D，可以隨時連同毛孩資料一起刪除。重拍會取代舊的那一份。</p>
    </div>
  );
}
