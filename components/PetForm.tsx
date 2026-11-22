"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { savePetAction } from "@/app/actions";
import { shrinkImage } from "@/lib/clientImage";
import type { PetDoc } from "@/lib/types";

export function PetForm({ pet }: { pet?: PetDoc }) {
  const router = useRouter();
  const [kind, setKind] = useState(pet?.kind ?? "狗");
  const [status, setStatus] = useState(pet?.status ?? "在世");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const submit = (form: FormData) => start(async () => {
    setError("");
    const photo = form.get("photo");
    if (photo instanceof File && photo.size > 0) form.set("photo", await shrinkImage(photo));
    const r = await savePetAction(form);
    if (!r.ok) { setError(r.error); return; }
    router.push(status === "已離開" && pet?.status !== "已離開" ? `/memorial/new?pet=${r.data}` : "/me");
  });

  return (
    <form action={submit} className="card stack">
      {pet && <input type="hidden" name="id" value={pet.id} />}
      <label className="field">名字<input name="name" defaultValue={pet?.name} maxLength={20} required /></label>
      <div className="row">
        <label className="field grow">種類
          <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as PetDoc["kind"])}><option>狗</option><option>貓</option></select>
        </label>
        {kind === "狗" && (
          <label className="field grow">體型
            <select name="size" defaultValue={pet?.size ?? "中型"}><option>小型</option><option>中型</option><option>大型</option></select>
          </label>
        )}
        <label className="field grow">性別
          <select name="sex" defaultValue={pet?.sex ?? ""}><option value="">不填</option><option>公</option><option>母</option></select>
        </label>
      </div>
      <label className="field">出生年月（大約就好）<input type="month" name="birth" defaultValue={pet?.birth} /></label>
      {status === "在世" && (
        <div className="row">
          <label className="check"><input type="checkbox" name="neutered" defaultChecked={pet?.neutered} />已結紮</label>
          <label className="check"><input type="checkbox" name="chipped" defaultChecked={pet?.chipped} />已植入晶片並登記</label>
        </div>
      )}
      <label className="field">照片<input type="file" name="photo" accept="image/*" /></label>
      {pet && (
        <label className="field">狀態
          <select name="status" value={status} onChange={(e) => setStatus(e.target.value as PetDoc["status"])}><option>在世</option><option>已離開</option></select>
        </label>
      )}
      {status === "已離開" && pet?.status !== "已離開" && <p className="small muted">很遺憾。存檔後可以為牠建立 3D 紀念。</p>}
      {error && <p className="error-box">{error}</p>}
      <button className="btn primary" disabled={pending}>{pending ? "儲存中…" : "儲存"}</button>
    </form>
  );
}
