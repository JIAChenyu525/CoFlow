import Link from "next/link";
import type { ReactNode } from "react";

export function Pill({
  children,
  tone = "slate",
  dot = false,
}: {
  children: ReactNode;
  tone?: string;
  dot?: boolean;
}) {
  return (
    <span className={`pill pill--${tone}`}>
      {dot && <span className="pill-dot" />}
      {children}
    </span>
  );
}

export function Avatar({
  name,
  color,
  size = 24,
}: {
  name: string;
  color: string;
  size?: number;
}) {
  return (
    <span
      className="avatar"
      style={{ background: color, width: size, height: size, fontSize: size * 0.42 }}
      title={name}
    >
      {name.slice(0, 1)}
    </span>
  );
}

export function Progress({
  value,
  tone = "var(--accent)",
  height = 4,
}: {
  value: number;
  tone?: string;
  height?: number;
}) {
  return (
    <div
      className="w-full overflow-hidden rounded-full"
      style={{ height, background: "var(--surface-3)" }}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: tone }}
      />
    </div>
  );
}

export function Empty({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-[var(--line-strong)] px-6 py-10 text-center">
      <div className="text-[13px] font-semibold text-[var(--ink-2)]">{title}</div>
      {hint && <div className="max-w-[36ch] text-[12px] leading-relaxed text-[var(--muted)]">{hint}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="card px-4 py-3">
      <div className="label">{label}</div>
      <div
        className="mono mt-1.5 text-[22px] font-semibold leading-none tracking-tight"
        style={{ color: tone }}
      >
        {value}
      </div>
      {hint && <div className="mt-1.5 text-[11.5px] text-[var(--muted)]">{hint}</div>}
    </div>
  );
}

export function SectionHead({
  title,
  sub,
  right,
}: {
  title: string;
  sub?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
        {sub && <p className="mt-0.5 text-[12px] text-[var(--muted)]">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-[12px] text-[var(--muted)]">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-[var(--line-strong)]">/</span>}
          {it.href ? (
            <Link href={it.href} className="hover:text-[var(--ink)]">
              {it.label}
            </Link>
          ) : (
            <span className="text-[var(--ink-2)]">{it.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

export function formatTime(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(
    2,
    "0"
  )} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function relativeTime(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const day = Math.floor(h / 24);
  if (day < 30) return `${day} 天前`;
  return formatDate(date);
}
