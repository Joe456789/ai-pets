"use client";
import { useEffect, useRef, useState } from "react";
import { pngBytes } from "@/lib/cutout";
import { cardGlb } from "@/lib/glb";

type ModelViewerElement = HTMLElement & { canActivateAR: boolean; activateAR: () => Promise<void> };

/**
 * 「放到地上看真實大小」：有 3D 模型就用模型（調成真實高度），沒有就把去背照片做成真實高度的立牌，交給手機內建 AR。
 * iPhone 開啟 AR 快速查看，Android 開啟 WebXR 或 Google 的 AR，系統會自己偵測地板。
 */
export function RealSizeAr({ imageUrl, modelUrl, heightCm, name }: { imageUrl: string | null; modelUrl?: string | null; heightCm: number; name: string }) {
  const el = useRef<ModelViewerElement | null>(null);
  const [state, setState] = useState<"preparing" | "ready" | "unsupported" | "error">("preparing");

  useEffect(() => {
    if (!imageUrl && !modelUrl) return;
    let cancelled = false;
    let blobUrl = "";
    setState("preparing");
    (async () => {
      try {
        const glb = async () => {
          if (modelUrl) {
            try {
              const { realSizeGlb } = await import("@/lib/petModel");
              return await realSizeGlb(modelUrl, heightCm / 100);
            } catch {
              if (!imageUrl) throw new Error("模型載入失敗");
            }
          }
          const { bytes, width, height } = await pngBytes(imageUrl!);
          return cardGlb(bytes, width, height, heightCm / 100);
        };
        const [data] = await Promise.all([glb(), import("@google/model-viewer")]);
        if (cancelled) return;
        blobUrl = URL.createObjectURL(new Blob([data as BlobPart], { type: "model/gltf-binary" }));
        const mv = document.createElement("model-viewer") as ModelViewerElement;
        mv.setAttribute("src", blobUrl);
        mv.setAttribute("ar", "");
        mv.setAttribute("ar-modes", "webxr scene-viewer quick-look");
        mv.setAttribute("ar-scale", "fixed");
        mv.setAttribute("ar-placement", "floor");
        mv.setAttribute("loading", "eager"); // 預設要看得到才載入，這裡要先準備好，按下按鈕才能立刻開啟 AR
        mv.setAttribute("alt", modelUrl ? `${name}的真實大小 3D 模型` : `${name}的真實大小立牌`);
        mv.style.cssText = "position:fixed;left:-20px;top:0;width:10px;height:10px;opacity:0;pointer-events:none";
        await new Promise<void>((ok, fail) => {
          mv.addEventListener("load", () => ok(), { once: true });
          mv.addEventListener("error", () => fail(new Error("模型載入失敗")), { once: true });
          document.body.appendChild(mv);
        });
        if (cancelled) return;
        el.current = mv;
        setState(mv.canActivateAR ? "ready" : "unsupported");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
      el.current?.remove();
      el.current = null;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [imageUrl, modelUrl, heightCm, name]);

  if (!imageUrl && !modelUrl) return null;
  const label = { preparing: "準備真實大小…", ready: "放到地上看真實大小", unsupported: "真實大小需用手機開啟", error: "真實大小暫時無法使用" }[state];
  return (
    <button className="btn small primary" disabled={state !== "ready"} onClick={() => void el.current?.activateAR()} title="使用手機內建 AR，自動偵測地板並以真實大小擺放">
      {label}
    </button>
  );
}
