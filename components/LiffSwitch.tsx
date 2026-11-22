"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { liffLogin } from "@/lib/liffLogin";

/** 在 LINE 裡卻還停在示範帳號（之前按過「先看示範」）：自動換成自己的 LINE 帳號。 */
export function LiffSwitch({ liffId }: { liffId: string | null }) {
  const router = useRouter();
  const [error, setError] = useState("");
  useEffect(() => {
    if (!liffId) return;
    liffLogin(liffId).then((r) => {
      if (r.status !== "ok") return;
      // 示範毛孩的頁面換帳號後就看不到了，回「我的毛孩」。
      if (location.pathname.includes("demo-")) router.replace("/me"); else router.refresh();
    }, (e) => setError((e as Error).message));
  }, [liffId, router]);
  if (!liffId) return <p className="notice" style={{ marginBottom: 14 }}>你正在看示範帳號，資料都是虛構的，只能瀏覽。</p>;
  return (
    <p className={error ? "error-box" : "notice"} style={{ marginBottom: 14 }}>
      {error ? `換成你的帳號時出了問題：${error}。請關掉這個頁面再開一次。` : "這是示範帳號，正在換成你自己的 LINE 帳號…"}
    </p>
  );
}
