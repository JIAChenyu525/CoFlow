"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "项目大厅", exact: true },
  { href: "/agent", label: "Agent 连接", exact: false },
  { href: "/docs/protocol", label: "事件协议", exact: false },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden items-stretch gap-0.5 self-stretch md:flex">
      {ITEMS.map((it) => {
        const active = it.exact ? pathname === it.href : pathname.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            style={{
              color: active ? "var(--cf-primary)" : "var(--cf-text-secondary)",
              borderBottomColor: active ? "var(--cf-primary)" : "transparent",
              backgroundColor: active ? "var(--cf-primary-tint)" : "transparent",
            }}
            className="flex items-center border-b-2 px-3 text-[12.5px] font-medium transition-colors hover:text-[var(--cf-primary)]"
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
