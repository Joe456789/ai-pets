import type { ReactNode } from "react";
import { HEALTH_NOTICE } from "@/lib/constants";

const toneOf: Record<string, string> = {
  準備好了: "good", 再準備一下: "warn", 先等等: "bad", 高: "bad", 中: "warn",
  在世: "good", 已離開: "muted", 完成: "good", 排隊中: "warn", 製作中: "warn", 失敗: "bad",
};

export function Badge({ children, tone }: { children: string; tone?: string }) {
  return <span className={`badge ${tone ?? toneOf[children] ?? "muted"}`}>{children}</span>;
}

export function PageHead({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <header className="page-head">
      <div className="row between">
        <h1>{title}</h1>
        {action}
      </div>
      {sub && <p>{sub}</p>}
    </header>
  );
}

/** 比賽注意事項規定的獸醫提示，放在有健康相關資訊的畫面。 */
export function Notice() {
  return <p className="notice">{HEALTH_NOTICE}</p>;
}

export function PetAvatar({ name, photo }: { name: string; photo?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return photo ? <img className="avatar" src={photo} alt={`${name}的照片`} /> : <span className="avatar" aria-hidden>{name.slice(0, 1)}</span>;
}
