"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

export type Bubble =
  | { me?: boolean; text: string }
  | { me?: boolean; node: ReactNode; cls?: string }
  | { card: ReactNode };

export type Scene = { id: string; title: string; hint: string; needs?: string; steps: Bubble[] };
export type MenuItem = { label: string; scene?: string };

// 模擬 LINE 對話：按下情境後依序播放訊息，回覆內容是預先寫好的示範。
export function LineSim({ account, sub, title, lede, scenes, menu, menuImage, lockedImage, unlockAfter, intro, children }: {
  account: string; sub: string; title: string; lede: string; scenes: Scene[]; menu: MenuItem[]; menuImage: string; lockedImage?: string; unlockAfter?: string;
  intro: string; children?: ReactNode;
}) {
  const [log, setLog] = useState<Bubble[]>([{ text: intro }]);
  const [played, setPlayed] = useState<string[]>([]);
  const [typing, setTyping] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" }); }, [log, typing]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const locked = unlockAfter ? !played.includes(unlockAfter) : false;
  const canRun = (s: Scene) => !typing && !played.includes(s.id) && (s.id === unlockAfter || !locked);

  const play = (id?: string) => {
    const s = scenes.find((x) => x.id === id);
    if (!s || !canRun(s)) return;
    setTyping(true);
    s.steps.forEach((b, i) => {
      timers.current.push(setTimeout(() => {
        setLog((l) => [...l, b]);
        if (i === s.steps.length - 1) { setTyping(false); setPlayed((p) => [...p, s.id]); }
      }, 300 + i * 750));
    });
  };

  const reset = () => { timers.current.forEach(clearTimeout); setLog([{ text: intro }]); setPlayed([]); setTyping(false); };

  return (
    <div className="sim">
      <div className="phone" aria-label="LINE 對話模擬">
        <div className="phone-top"><span>{account}</span><small>{sub}</small></div>
        <div className="chat" ref={box} aria-live="polite">
          {log.map((b, i) => {
            if ("card" in b) return <div className="flex-card" key={i}>{b.card}</div>;
            if ("node" in b) return <div className={`msg ${b.me ? "me" : ""} ${b.cls ?? ""}`} key={i}>{b.node}</div>;
            return <div className={`msg ${b.me ? "me" : ""}`} key={i}>{b.text}</div>;
          })}
          {typing && <div className="msg typing">輸入中…</div>}
        </div>
        <div className="rich-img">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={locked && lockedImage ? lockedImage : menuImage} alt="LINE 圖文選單" />
          <div className="rich-hit">
            {menu.map((m) => {
              const s = scenes.find((x) => x.id === m.scene);
              const on = s && canRun(s) && !locked;
              return <button key={m.label} aria-label={m.label} className={s && played.includes(s.id) ? "dim" : ""} disabled={!on} onClick={() => play(m.scene)} />;
            })}
          </div>
        </div>
        <div className="rich-bar">{locked ? "尚未綁定：先傳工作號，選單才會切換" : "▾ 選單"}</div>
      </div>
      <div className="sim-side">
        <h1>{title}</h1>
        <p className="muted">{lede}</p>
        <div className="scene-list">
          {scenes.map((s) => (
            <button key={s.id} className={`scene ${played.includes(s.id) ? "done" : ""}`} disabled={!canRun(s)} onClick={() => play(s.id)}>
              <b>{played.includes(s.id) ? "✓ " : ""}{s.title}</b>
              <span>{s.hint}</span>
            </button>
          ))}
        </div>
        <button className="btn small" style={{ marginTop: 12 }} onClick={reset}>重新開始</button>
        {children && <div style={{ marginTop: 16 }}>{children}</div>}
      </div>
    </div>
  );
}

export function FlexCard({ head, alert, rows, note, acts }: { head: string; alert?: boolean; rows?: [string, string][]; note?: ReactNode; acts?: { label: string; solid?: boolean }[] }) {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <>
      <div className={`flex-head ${alert ? "alert" : ""}`}>{head}</div>
      <div className="flex-body">
        {rows?.map(([k, v]) => <div className="flex-row" key={k}><span>{k}</span><span>{v}</span></div>)}
        {note}
      </div>
      {acts && (
        <div className="flex-acts">
          {picked ? <span className="small muted">已選擇：{picked}</span> : acts.map((a) => <button key={a.label} className={a.solid ? "solid" : ""} onClick={() => setPicked(a.label)}>{a.label}</button>)}
        </div>
      )}
    </>
  );
}
