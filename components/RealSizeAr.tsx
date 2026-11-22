"use client";
import { useEffect, useRef, useState } from "react";

type ModelViewerElement = HTMLElement & { canActivateAR: boolean; activateAR: () => Promise<void> };

/**
 * 「放在身邊看看」：把 3D 模型調成真實高度，交給手機內建 AR（iPhone 快速查看、Android Scene Viewer），系統會自己偵測地板。
 */
export function RealSizeAr({ modelUrl, heightCm, name }: { modelUrl: string; heightCm: number; name: string }) {
  const el = useRef<ModelViewerElement | null>(null);
  const [state, setState] = useState<"preparing" | "ready" | "unsupported" | "error">("preparing");

  useEffect(() => {
    let cancelled = false;
    let blobUrl = "";
    (async () => {
      try {
        const [{ realSizeGlb }] = await Promise.all([import("@/lib/petModel"), import("@google/model-viewer")]);
        const data = await realSizeGlb(modelUrl, heightCm / 100);
        if (cancelled) return;
        blobUrl = URL.createObjectURL(new Blob([data], { type: "model/gltf-binary" }));
        const mv = document.createElement("model-viewer") as ModelViewerElement;
        mv.setAttribute("src", blobUrl);
        mv.setAttribute("ar", "");
        mv.setAttribute("ar-modes", "webxr scene-viewer quick-look");
        mv.setAttribute("ar-scale", "fixed");
        mv.setAttribute("ar-placement", "floor");
        mv.setAttribute("loading", "eager");
        mv.setAttribute("alt", `${name}的真實大小 3D 模型`);
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
  }, [modelUrl, heightCm, name]);

  const label = { preparing: "準備中…", ready: "放在身邊看看（AR）", unsupported: "用手機開啟可以放在身邊看", error: "AR 暫時無法使用" }[state];
  return <button className="btn" disabled={state !== "ready"} onClick={() => void el.current?.activateAR()}>{label}</button>;
}
