"use client";

import Link from "next/link";
import { EndpointPaths } from "@/components/agent-panels";

type Endpoint = {
  id: string;
  toolType: string;
  toolVersion: string;
  capability: "AUTO" | "SEMI" | "MANUAL";
  status: string;
  allowedPaths: string[];
  preferred?: boolean;
};

const CAP_STYLE: Record<string, { label: string; bg: string; fg: string }> = {
  AUTO: { label: "全自动", bg: "var(--green-soft)", fg: "var(--green)" },
  SEMI: { label: "半自动", bg: "var(--amber-soft)", fg: "var(--amber)" },
  MANUAL: { label: "手动", bg: "var(--surface-3)", fg: "var(--muted)" },
};

/**
 * 项目工作页里的「我的 AI 工具」。
 * 用不用 AI 是每个人的选择：连了就显示端点并可派发，没连就保留纯人工协作。
 */
export function ProjectAgents({ endpoints, compact }: { endpoints: Endpoint[]; compact?: boolean }) {
  return (
    <section>
      <div className="flex items-center justify-between">
        <div className="label">我的 AI 工具</div>
        <Link href="/agent" className="text-[10.5px] text-[var(--muted)] hover:text-[var(--accent-ink)]">
          {endpoints.length ? "管理" : compact ? "连接" : "去连接"}
        </Link>
      </div>

      {endpoints.length === 0 ? (
        compact ? (
          <p className="mt-1 text-[11px] text-[var(--muted)]">
            可选：连上本机 AI 工具后可把任务派给它执行。
            <Link href="/agent" className="ml-1 text-[var(--accent-ink)] hover:underline">
              连接这台电脑
            </Link>
          </p>
        ) : (
        <div className="mt-2 rounded-lg border border-dashed border-[var(--line)] px-2.5 py-2.5">
          <p className="text-[11px] leading-relaxed text-[var(--muted)]">
            这一项是可选的。连上本机的 AI 工具后，你可以把任务派给它执行，自己继续和队友讨论；
            不连也能正常协作。
          </p>
          <Link href="/agent" className="btn btn-xs mt-2 inline-flex">
            连接这台电脑
          </Link>
        </div>
        )
      ) : (
        <div className="mt-2 space-y-1.5">
          {[...endpoints].sort((a, b) => Number(!!b.preferred) - Number(!!a.preferred)).map((e) => {
            const cap = CAP_STYLE[e.capability] ?? CAP_STYLE.MANUAL;
            const online = e.status === "ONLINE" || e.status === "BUSY";
            return (
              <div key={e.id} className="rounded-lg border border-[var(--line)] px-2.5 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="mono flex min-w-0 items-center gap-1.5 text-[11px] font-medium">
                    <span className="truncate">
                      {e.toolType} {e.toolVersion}
                    </span>
                    {e.preferred && (
                      <span className="shrink-0 text-[9.5px] font-semibold text-[var(--accent-ink)]">
                        ★ 我的助手
                      </span>
                    )}
                  </span>
                  <span
                    style={{ backgroundColor: cap.bg, color: cap.fg }}
                    className="shrink-0 px-1.5 py-0.5 text-[9.5px] font-semibold"
                  >
                    {cap.label}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[10.5px] text-[var(--muted)]">
                  <span
                    style={{ backgroundColor: online ? "var(--green)" : "var(--faint)" }}
                    className="h-[6px] w-[6px] rounded-full"
                  />
                  {online ? "在线" : "离线"}
                  <span className="text-[var(--faint)]">·</span>
                  {e.allowedPaths.length > 0 ? `已授权 ${e.allowedPaths.length} 个目录` : "未授权目录（只读）"}
                </div>
                <div className="mt-1.5">
                  <EndpointPaths endpointId={e.id} paths={e.allowedPaths} />
                </div>
              </div>
            );
          })}
          <p className="text-[10px] leading-relaxed text-[var(--faint)]">
            派发入口在任务详情页：任务「已就绪」后，右侧选端点下发。
          </p>
        </div>
      )}
    </section>
  );
}
