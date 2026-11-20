"use client";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { generateMotionAction, saveCutoutAction, setMotionApprovedAction } from "@/app/shelter/actions";
import { MotionPlayer, type MotionPlayerHandle } from "@/components/MotionPlayer";
import { Badge } from "@/components/ui";
import { REACTION_TEXT, type ReactionKey } from "@/lib/ar";
import { cutoutFromPhoto, greenFrame, toBase64, type Pt } from "@/lib/cutout";
import type { AnimalDoc } from "@/lib/types";

const CLIP_LABEL: Record<string, string> = { approach: "靠過來", hop: "開心跳", shy: "害羞躲", nod: "點點頭", tilt: "歪頭" };

/** 協會後台：準備 AR 試放的去背圖和 AI 動態影片。影片要按「公開」才會出現在領養頁。 */
export function MotionPanel({ animal }: { animal: AnimalDoc }) {
  const router = useRouter();
  const player = useRef<MotionPlayerHandle>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<"cut" | "save" | "video" | null>(null);
  const [, start] = useTransition();
  const photo = animal.photos[0];
  const m = animal.motion;
  const cutout = draft ?? animal.cutout ?? null;

  if (!photo) {
    return (
      <section className="card">
        <h2>AR 試放素材</h2>
        <p className="small muted">還沒有照片。請現場人員在 LINE 按「新增動物」傳照片，才能做去背和 AI 動態影片。沒有照片的動物不會開放 AR 試放。</p>
      </section>
    );
  }

  const runCut = async (point?: Pt) => {
    setBusy("cut");
    setMsg(null);
    try {
      const url = await cutoutFromPhoto(photo, point);
      if (url) setDraft(url);
      else setMsg({ ok: false, text: "沒有找到動物，請按「點照片重選」，點一下照片裡的動物。" });
    } catch {
      setMsg({ ok: false, text: "去背失敗，請重新整理頁面再試一次。" });
    } finally {
      setBusy(null);
    }
  };
  const saveCut = () => start(async () => {
    if (!draft) return;
    setBusy("save");
    const r = await saveCutoutAction(animal.id, await toBase64(draft));
    setBusy(null);
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
    setDraft(null);
    setMsg({ ok: true, text: "去背圖已儲存。" });
    router.refresh();
  });
  const makeVideo = () => {
    if (!cutout) return;
    if (m?.status === "完成" && !window.confirm("重新產生會再花一次費用（約 NT$30），確定嗎？")) return;
    start(async () => {
      setBusy("video");
      setMsg(null);
      const r = await generateMotionAction(animal.id, await toBase64(await greenFrame(cutout)));
      setBusy(null);
      setMsg(r.ok ? { ok: true, text: "影片完成了，請先預覽，確認沒問題再按「公開動態影片」。" } : { ok: false, text: r.error });
      router.refresh();
    });
  };
  const approve = (v: boolean) => start(async () => {
    const r = await setMotionApprovedAction(animal.id, v);
    setMsg(r.ok ? { ok: true, text: v ? "已公開，領養頁的 AR 試放會播放動態影片。" : "已取消公開，AR 試放改回靜態照片。" } : { ok: false, text: r.error });
    router.refresh();
  });

  return (
    <section className="card stack" style={{ gap: 12 }}>
      <div className="row between">
        <h2 style={{ margin: 0 }}>AR 試放素材</h2>
        {m?.status === "完成" && <Badge tone={m.approved ? "good" : "warn"}>{m.approved ? "動態影片已公開" : "動態影片未公開"}</Badge>}
      </div>
      {msg && <p className={msg.ok ? "ok-box" : "error-box"}>{msg.text}</p>}

      <div>
        <b className="small">1. 去背</b>
        <div className="row" style={{ alignItems: "flex-start", marginTop: 6 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="原始照片" className="mp-thumb" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {cutout ? <img src={cutout} alt="去背結果" className="mp-thumb mp-checker" /> : <span className="mp-thumb mp-empty small muted">還沒去背</span>}
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn small" disabled={busy !== null} onClick={() => void runCut()}>{busy === "cut" ? "去背中…" : cutout ? "重新去背" : "自動去背"}</button>
          <button className="btn small" disabled={busy !== null} onClick={() => setPicking(true)}>點照片重選</button>
          {draft && <button className="btn small primary" disabled={busy !== null} onClick={saveCut}>{busy === "save" ? "儲存中…" : "儲存去背圖"}</button>}
        </div>
        {picking && (
          <div className="mp-pick">
            <p className="small">點一下照片裡的{animal.name}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="點選要去背的動物" onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setPicking(false);
              void runCut({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
            }} />
            <button className="btn small" onClick={() => setPicking(false)}>取消</button>
          </div>
        )}
      </div>

      <div>
        <b className="small">2. AI 動態影片</b>
        <p className="small muted" style={{ margin: "4px 0 8px" }}>
          AI 依去背圖生成 3 段短片：平常的樣子，以及依個性的 2 段反應。每次約 NT$30，約需 1 分鐘，生成時請不要關閉頁面。影片是 AI 生成的模擬，不是實拍。
        </p>
        {m?.status === "失敗" && <p className="error-box small">上次生成失敗：{m.error}</p>}
        <button className="btn small primary" disabled={!animal.cutout || busy !== null || m?.status === "生成中"} onClick={makeVideo}>
          {busy === "video" || m?.status === "生成中" ? "生成中，約 1 分鐘…" : m?.status === "完成" ? "重新產生動態影片" : "產生動態影片"}
        </button>
        {!animal.cutout && <span className="small muted" style={{ marginLeft: 8 }}>請先儲存去背圖</span>}

        {m?.status === "完成" && m.idle && (
          <div style={{ marginTop: 10 }}>
            <div className="mp-preview">
              <MotionPlayer ref={player} idle={m.idle} reactions={m.reactions} />
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              {Object.keys(m.reactions).map((k) => (
                <button key={k} className="btn small" title={REACTION_TEXT[k as ReactionKey]} onClick={() => player.current?.play(k)}>播放：{CLIP_LABEL[k] ?? k}</button>
              ))}
              {m.approved
                ? <button className="btn small" onClick={() => approve(false)}>取消公開</button>
                : <button className="btn small primary" onClick={() => approve(true)}>確認沒問題，公開動態影片</button>}
            </div>
            <p className="small muted" style={{ marginTop: 6 }}>請確認動物外觀和原照片一致、動作自然、沒有奇怪的畫面再公開。</p>
          </div>
        )}
      </div>
    </section>
  );
}
