"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconArtifact, IconBoard, IconSettings, IconTask, IconTimeline } from "./icons";

type Counts = { active: number; review: number; blocked: number };

function buildItems(projectId: string, counts: Counts) {
  const base = `/projects/${projectId}`;
  return [
    { href: base, label: "工作台", icon: IconBoard, badge: 0, exact: true },
    { href: `${base}/tasks`, label: "任务与分工", icon: IconTask, badge: counts.active, exact: false },
    {
      href: `${base}/artifacts`,
      label: "产物与验收",
      icon: IconArtifact,
      badge: counts.review,
      exact: false,
    },
    { href: `${base}/timeline`, label: "决策与时间线", icon: IconTimeline, badge: 0, exact: false },
    { href: `${base}/settings`, label: "项目设置", icon: IconSettings, badge: 0, exact: false },
  ];
}

export function ProjectNav({
  projectId,
  counts,
}: {
  projectId: string;
  counts: Counts;
}) {
  const pathname = usePathname();
  const items = buildItems(projectId, counts);

  return (
    <nav className="space-y-0.5">
      {items.map((it) => {
        const active = it.exact ? pathname === it.href : pathname.startsWith(it.href);
        const Icon = it.icon;
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[12.5px] font-medium transition ${
              active
                ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                : "text-[var(--ink-2)] hover:bg-[var(--surface-3)]"
            }`}
          >
            <Icon size={15} className={active ? "opacity-90" : "opacity-55"} />
            <span className="flex-1">{it.label}</span>
            {it.badge > 0 && (
              <span
                className={`mono rounded-full px-1.5 py-[1px] text-[10px] font-semibold ${
                  active
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--surface-3)] text-[var(--muted)]"
                }`}
              >
                {it.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/** 窄屏用横向标签，避免手机上丢失项目内导航 */
export function ProjectNavMobile({
  projectId,
  counts,
}: {
  projectId: string;
  counts: Counts;
}) {
  const pathname = usePathname();
  const items = buildItems(projectId, counts);

  return (
    <nav className="scroll-thin flex gap-1 overflow-x-auto border-b border-[var(--line)] bg-[var(--surface)] px-3 py-1.5">
      {items.map((it) => {
        const active = it.exact ? pathname === it.href : pathname.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`shrink-0 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition ${
              active
                ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                : "text-[var(--ink-2)]"
            }`}
          >
            {it.label}
            {it.badge > 0 && (
              <span className="mono ml-1 text-[10px] text-[var(--muted)]">{it.badge}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
