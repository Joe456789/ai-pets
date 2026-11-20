"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export type NavItem = { href: string; label: string; count?: number };

export function SideNav({ brand, who, items, base, variant, footer }: { brand: string; who: string; items: NavItem[]; base: string; variant: "shelter" | "admin"; footer?: ReactNode }) {
  const path = usePathname();
  return (
    <aside className={`side side-${variant}`}>
      <div className="side-brand">
        <span className="logo-mark" aria-hidden>浪</span>
        <div>
          <strong>{brand}</strong>
          <small>{who}</small>
        </div>
      </div>
      <nav>
        {items.map((it) => {
          const active = it.href === base ? path === base : path.startsWith(it.href);
          return (
            <Link key={it.href} href={it.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
              <span>{it.label}</span>
              {it.count ? <em>{it.count}</em> : null}
            </Link>
          );
        })}
      </nav>
      {footer && <div className="side-foot">{footer}</div>}
    </aside>
  );
}
