import { LiffSwitch } from "@/components/LiffSwitch";
import { SignIn } from "@/components/SignIn";
import { isAppMode } from "@/lib/appMode";
import { isDemo } from "@/lib/repo";

/** 伺服器端：沒登入就顯示登入卡片。 */
export async function SignInCard({ what }: { what: string }) {
  return <SignIn liffId={process.env.LIFF_ID ?? null} devLogin={process.env.NODE_ENV !== "production"} what={what} app={await isAppMode()} />;
}

export async function DemoBanner({ uid }: { uid: string }) {
  if (!isDemo(uid)) return null;
  // 在 LINE 裡的人已經加了好友，直接換成自己的帳號才能記錄。
  if (await isAppMode()) return <LiffSwitch liffId={process.env.LIFF_ID ?? null} />;
  return <p className="notice" style={{ marginBottom: 14 }}>你正在看示範帳號，資料都是虛構的，只能瀏覽。加入 LINE 好友就能建立自己的紀錄。</p>;
}
