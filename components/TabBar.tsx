"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/assess", label: "飼養前評估", icon: "M9 3h6v3H9z M8 4.5H5.5V21h13V4.5H16 M8.5 13l2.2 2.2 4.6-4.7" },
  { href: "/me", label: "我的毛孩", icon: "M12 21c-4-3-7-5.5-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 12c0 3.5-3 6-7 9z" },
  { href: "/learn", label: "小學堂", icon: "M12 6.5C10 5 6.5 4.6 3.5 5.3V19c3-.7 6.5-.3 8.5 1.2 2-1.5 5.5-1.9 8.5-1.2V5.3C17.5 4.6 14 5 12 6.5z M12 6.5V20" },
  { href: "/memorial", label: "紀念", icon: "M6 21V10a6 6 0 0 1 12 0v11z M10 14h4" },
];

// 「我的毛孩」底下還有毛孩頁、醫療紀錄、照顧日曆和生活變動檢查。
const isActive = (href: string, path: string) =>
  href === "/me" ? path === "/me" || ["/pets", "/care", "/change"].some((p) => path.startsWith(p)) : path.startsWith(href);

/** 在 LINE 裡打開時的底部分頁，取代網站頁首，用起來像 App。 */
export function TabBar() {
  const path = usePathname();
  return (
    <nav className="tabbar" aria-label="分頁">
      {TABS.map((t) => {
        const on = isActive(t.href, path);
        return (
          <Link key={t.href} href={t.href} className={on ? "on" : ""} aria-current={on ? "page" : undefined} prefetch>
            <svg viewBox="0 0 24 24" aria-hidden><path d={t.icon} /></svg>
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
