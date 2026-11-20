import type { ReactNode } from "react";
import { HEALTH_NOTICE } from "@/lib/constants";

const toneOf: Record<string, string> = {
  開放領養: "good", 已通過: "good", 已收款: "good", 使用中: "good", 正常: "good", 已結案: "muted", 已領養: "muted", 已綁定: "good",
  在所照護: "info", 面談中: "info", 處理中: "info", 試用中: "info", 基本: "muted", 進階: "info", 試用: "muted",
  待審核: "warn", 待收款: "warn", 待處理: "warn", 待抽查: "warn", 未綁定: "warn", 送醫中: "warn",
  未通過: "muted", 已停用: "muted", 異常: "bad", 想退養: "bad", 健康疑慮: "warn", 其他: "muted",
};

export function Badge({ children, tone }: { children: string; tone?: string }) {
  return <span className={`badge ${tone ?? toneOf[children] ?? "muted"}`}>{children}</span>;
}

export function PageHead({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {action}
    </header>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <strong>{value}</strong>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}

export function Notice({ compact }: { compact?: boolean }) {
  return <p className={`notice ${compact ? "compact" : ""}`}>{HEALTH_NOTICE}</p>;
}

export function Concept({ children }: { children: ReactNode }) {
  return <p className="concept"><b>規劃中</b>{children}</p>;
}

// 單一系列長條圖：只有一種顏色，由標題說明數值；滑過顯示數字，並直接標出最新值。
export function Bars({ rows, unit }: { rows: { label: string; value: number }[]; unit: string }) {
  const max = Math.max(...rows.map((r) => r.value));
  return (
    <div className="bars" role="table">
      {rows.map((r, i) => (
        <div className="bar-col" key={r.label} role="row" tabIndex={0}>
          <span className="bar-tip" role="cell">{r.label}：{r.value} {unit}</span>
          <div className="bar-track">
            {i === rows.length - 1 && <span className="bar-last">{r.value}</span>}
            <div className="bar" style={{ height: `${(r.value / max) * 100}%` }} />
          </div>
          <span className="bar-label" role="cell">{r.label}</span>
        </div>
      ))}
    </div>
  );
}
