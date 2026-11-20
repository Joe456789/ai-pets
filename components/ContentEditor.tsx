"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { generateListingAction, publishListingAction, saveListingAction, unpublishAction } from "@/app/shelter/actions";
import { MotionPanel } from "@/components/MotionPanel";
import { PetImage } from "@/components/PetImage";
import { Badge } from "@/components/ui";
import type { AnimalDoc, MatchTags } from "@/lib/types";

const split = (s: string) => s.split(/[、,，\n]/).map((x) => x.trim()).filter(Boolean);
const TAG_LABELS: [keyof MatchTags, string, string[]][] = [
  ["energy", "活動量", ["未知", "低", "中", "高"]],
  ["beginnerOk", "適合新手", ["未知", "是", "否"]],
  ["kidOk", "可和小孩相處", ["未知", "是", "否"]],
  ["apartmentOk", "適合公寓", ["未知", "是", "否"]],
];

type Form = { name: string; story: string; social: string; traits: string; needs: string; goodFor: string; tags: MatchTags };
const toForm = (a: AnimalDoc): Form => ({
  name: a.name, story: a.story || a.draft?.web || "", social: a.social || a.draft?.social || "",
  traits: a.traits.join("、"), needs: a.needs.join("、"), goodFor: a.goodFor.join("、"), tags: a.tags,
});

export function ContentEditor({ animals, initialId }: { animals: AnimalDoc[]; initialId?: string }) {
  const router = useRouter();
  const [id, setId] = useState(initialId && animals.some((a) => a.id === initialId) ? initialId : animals[0]?.id);
  const animal = animals.find((a) => a.id === id);
  const [form, setForm] = useState<Form | null>(animal ? toForm(animal) : null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [aiDrafted, setAiDrafted] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    const a = animals.find((x) => x.id === id);
    setForm(a ? toForm(a) : null);
    setMessage(null);
    setAiDrafted(false);
    // 只有切換動物時才重設表單，不要蓋掉正在編輯的內容。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!animal || !form) return <p className="muted">目前沒有動物。現場人員在 LINE 建檔後會出現在這裡。</p>;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm({ ...form, [k]: v });
  const payload = () => ({ name: form.name, story: form.story, social: form.social, traits: split(form.traits), needs: split(form.needs), goodFor: split(form.goodFor), tags: form.tags });

  const generate = () => start(async () => {
    setMessage(null);
    const res = await generateListingAction(animal.id);
    if (!res.ok) { setMessage({ ok: false, text: res.error }); return; }
    const d = res.data!;
    setForm({
      ...form, story: d.web, social: d.social,
      traits: form.traits || d.traits.join("、"), needs: form.needs || d.needs.join("、"), goodFor: form.goodFor || d.goodFor.join("、"), tags: d.tags,
    });
    setAiDrafted(true);
    setMessage({ ok: true, text: "AI 草稿好了。請確認內容屬實，再發布。" });
  });
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okText: string) => start(async () => {
    setMessage(null);
    const res = await fn();
    setMessage(res.ok ? { ok: true, text: okText } : { ok: false, text: res.error ?? "發生錯誤" });
    if (res.ok) { setAiDrafted(false); router.refresh(); }
  });

  return (
    <div className="grid-split">
      <div className="picker card">
        {animals.map((x) => (
          <button key={x.id} className={x.id === animal.id ? "on" : ""} onClick={() => setId(x.id)}>
            <span className="thumb"><PetImage pet={x} /></span>
            <span>{x.name}<br /><Badge tone={x.published ? "good" : "warn"}>{x.published ? "已發布" : "未發布"}</Badge></span>
          </button>
        ))}
      </div>
      <div className="stack">
      <section className="card stack" style={{ gap: 12 }}>
        <div className="row between">
          <h2 style={{ margin: 0 }}>{animal.name}{aiDrafted && <span className="ai-tag" style={{ marginLeft: 8 }}>AI 草稿</span>}</h2>
          <button className="btn small" disabled={pending} onClick={generate}>{pending ? "處理中…" : "請 AI 寫草稿"}</button>
        </div>
        {message && <p className={message.ok ? "ok-box" : "error-box"} role="status">{message.text}</p>}
        <label className="field">名字<input value={form.name} onChange={(e) => set("name", e.target.value)} /></label>
        <label className="field">公開頁介紹<textarea className="draft" value={form.story} onChange={(e) => set("story", e.target.value)} /></label>
        <label className="field">社群貼文<textarea className="draft" value={form.social} onChange={(e) => set("social", e.target.value)} /></label>
        <div className="form-grid">
          <label className="field">個性（用頓號分開）<input value={form.traits} onChange={(e) => set("traits", e.target.value)} /></label>
          <label className="field">照顧重點<input value={form.needs} onChange={(e) => set("needs", e.target.value)} /></label>
          <label className="field">可能適合<input value={form.goodFor} onChange={(e) => set("goodFor", e.target.value)} /></label>
          {TAG_LABELS.map(([k, label, opts]) => (
            <label className="field" key={k}>{label}（媒合計分用）
              <select value={form.tags[k]} onChange={(e) => set("tags", { ...form.tags, [k]: e.target.value } as MatchTags)}>
                {opts.map((o) => <option key={o}>{o}</option>)}
              </select>
            </label>
          ))}
        </div>
        <p className="small muted">文案不可以寫保證健康或醫療效果。發布前請確認內容屬實，照護紀錄不會公開。</p>
        <div className="row">
          <button className="btn primary" disabled={pending} onClick={() => run(() => publishListingAction(animal.id, payload()), "已發布到公開頁。")}>{animal.published ? "更新公開內容" : "確認並發布"}</button>
          <button className="btn" disabled={pending} onClick={() => run(() => saveListingAction(animal.id, payload()), "已儲存，尚未公開。")}>只儲存</button>
          <button className="btn" onClick={() => { navigator.clipboard?.writeText(form.social); setMessage({ ok: true, text: "貼文已複製。" }); }}>複製貼文</button>
          {animal.published && <button className="btn" disabled={pending} onClick={() => run(() => unpublishAction(animal.id), "已從公開頁下架。")}>下架</button>}
          {animal.published && <button className="btn" disabled={pending} onClick={() => run(() => unpublishAction(animal.id, "已領養"), "已標記為已領養並下架。")}>標記已領養</button>}
        </div>
      </section>
      <MotionPanel key={animal.id} animal={animal} />
      </div>
    </div>
  );
}
