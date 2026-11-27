import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { computeProgress } from "@/lib/task-state";
import { AvatarGroup, ThinProgressBar } from "@/components/ds";
import { QuickCreate } from "@/components/quick-create";
import { JoinProject } from "@/components/join-project";

export const dynamic = "force-dynamic";

type Stage = "DEFINE" | "BUILD" | "INTEGRATE" | "REVIEW" | "ARCHIVED";

const STAGE_LABEL: Record<Stage, string> = {
  DEFINE: "定义",
  BUILD: "开发",
  INTEGRATE: "联调",
  REVIEW: "验收",
  ARCHIVED: "归档",
};

const STAGE_STYLE: Record<Stage, React.CSSProperties> = {
  DEFINE: {
    backgroundColor: "var(--cf-warning-bg)",
    color: "var(--cf-warning)",
    borderColor: "var(--cf-warning-border)",
  },
  BUILD: {
    backgroundColor: "var(--cf-info-bg)",
    color: "var(--cf-info)",
    borderColor: "var(--cf-info-border)",
  },
  INTEGRATE: {
    backgroundColor: "var(--cf-primary-tint)",
    color: "var(--cf-primary)",
    borderColor: "var(--cf-primary)",
  },
  REVIEW: {
    backgroundColor: "var(--cf-warning-bg)",
    color: "var(--cf-warning)",
    borderColor: "var(--cf-warning)",
    borderLeftWidth: "3px",
  },
  ARCHIVED: {
    backgroundColor: "var(--cf-surface-tertiary)",
    color: "var(--cf-text-tertiary)",
    borderColor: "var(--cf-border-strong)",
  },
};

export default async function HomePage() {
  const user = await requireUser();

  const endpointsWithPaths = await prisma.agentEndpoint.count({
    where: {
      device: { userId: user.id, revokedAt: null },
      status: { not: "REVOKED" },
      NOT: { allowedPaths: { equals: [] } },
    },
  });

  // 只列出当前账号是成员的项目：这是多租户隔离的底线，
  // 不能因为界面上看不到别人的项目就假定数据是隔离的。
  const projects = await prisma.project.findMany({
    where: { members: { some: { userId: user.id } } },
    orderBy: { createdAt: "desc" },
    include: {
      charters: { orderBy: { version: "desc" }, take: 1 },
      members: { include: { user: true } },
      tasks: { select: { status: true, weight: true } },
      events: { orderBy: { occurredAt: "desc" }, take: 1 },
    },
  });

  const pendingInvites = await prisma.projectInvitation.count({
    where: { inviteeId: user.id, status: "PENDING" },
  });

  const allTasks = projects.flatMap((p) => p.tasks);
  const totals = {
    projects: projects.length,
    active: allTasks.filter((t) => t.status === "IN_PROGRESS").length,
    review: allTasks.filter((t) => t.status === "IN_REVIEW").length,
    blocked: allTasks.filter((t) => t.status === "BLOCKED").length,
  };

  const showOnboarding = projects.length === 0 || endpointsWithPaths === 0;

  return (
    <div className="cf-scope flex min-h-[calc(100dvh-52px)] w-full flex-col">
      {showOnboarding && (
        <div
          style={{
            backgroundColor: "var(--cf-warning-bg)",
            borderBottom: "1px solid var(--cf-warning)",
            borderLeft: "4px solid var(--cf-warning)",
          }}
          className="shrink-0 px-6 py-2"
        >
          <div className="mx-auto flex max-w-[1380px] flex-wrap items-center justify-between gap-2 text-[12px]">
            <div className="flex items-center gap-2">
              <span
                style={{ backgroundColor: "var(--cf-warning)", color: "var(--cf-surface-card)" }}
                className="px-1.5 py-0.5 font-mono-tabular text-[10px] font-bold"
              >
                ONBOARDING
              </span>
              <span className="font-semibold text-[var(--cf-text-primary)]">
                15 分钟跑通第一个闭环 · 建项目 → 连设备 → 授权目录 → 建任务 → 交付验收
              </span>
            </div>
            <Link
              href="/start"
              style={{ backgroundColor: "var(--cf-primary)", color: "var(--cf-surface-card)" }}
              className="h-[24px] px-2.5 text-[12px] font-semibold leading-[24px] hover:bg-[var(--cf-primary-deep)]"
            >
              开始 →
            </Link>
          </div>
        </div>
      )}

      {pendingInvites > 0 && (
        <div
          style={{ backgroundColor: "var(--cf-primary-tint)", borderBottom: "1px solid var(--cf-primary)" }}
          className="shrink-0 px-6 py-2"
        >
          <div className="mx-auto flex max-w-[1380px] flex-wrap items-center gap-2 text-[12px]">
            <span className="font-semibold text-[var(--cf-text-primary)]">
              你有 {pendingInvites} 个项目邀请等待处理
            </span>
            <Link
              href="/invitations"
              style={{ backgroundColor: "var(--cf-primary)", color: "var(--cf-surface-card)" }}
              className="h-[24px] px-2.5 text-[12px] font-semibold leading-[24px]"
            >
              查看邀请 →
            </Link>
          </div>
        </div>
      )}

      <div className="mx-auto flex w-full max-w-[1380px] flex-1 flex-col gap-6 px-6 py-5">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--cf-border-strong)] pb-3.5">
          <div>
            <div className="font-mono-tabular text-[11px] font-semibold tracking-widest text-[var(--cf-primary)]">
              COFLOW PROJECT HALL // ARCHIVAL LEDGER
            </div>
            <div className="mt-0.5 flex flex-wrap items-baseline gap-3">
              <h1
                style={{ fontSize: "var(--cf-t1-size)", lineHeight: "var(--cf-t1-lh)" }}
                className="font-bold text-[var(--cf-text-primary)]"
              >
                项目大厅
              </h1>
              <p className="text-[13px] font-medium text-[var(--cf-text-secondary)]">
                同一份事实，给人看，也给 Agent 读。
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <JoinProject />
            <Link
              href="/projects/new"
              style={{ backgroundColor: "var(--cf-primary)", color: "var(--cf-surface-card)" }}
              className="flex h-[32px] items-center px-3 text-[13px] font-semibold hover:bg-[var(--cf-primary-deep)]"
            >
              ＋ 新建项目
            </Link>
          </div>
        </div>

        {/* 四个全局统计 */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="项目总数" value={totals.projects} hint="个活跃与归档项目" tone="var(--cf-primary)" />
          <StatCard label="进行中任务数" value={totals.active} hint="人机协同执行中" tone="var(--cf-info)" />
          <StatCard label="待验收数" value={totals.review} hint="等待人工签批结论" tone="var(--cf-warning)" />
          <StatCard label="阻塞数" value={totals.blocked} hint="需外部支持或裁决" tone="var(--cf-danger)" />
        </div>

        {/* 项目卡片 */}
        {projects.length === 0 ? (
          <div className="flex justify-center">
            <QuickCreate />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((p) => {
              const progress = computeProgress(p.tasks);
              const charter = p.charters[0];
              const counts = {
                active: p.tasks.filter((t) => t.status === "IN_PROGRESS").length,
                review: p.tasks.filter((t) => t.status === "IN_REVIEW").length,
                blocked: p.tasks.filter((t) => t.status === "BLOCKED").length,
              };
              const last = p.events[0];
              const stage = p.stage as Stage;

              return (
                <div
                  key={p.id}
                  style={{
                    backgroundColor: "var(--cf-surface-card)",
                    borderColor: "var(--cf-border-strong)",
                    boxShadow: "var(--cf-shadow-card)",
                  }}
                  className="flex flex-col border p-4 transition-shadow hover:shadow-[var(--cf-shadow-card-hover)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        style={{
                          backgroundColor: "var(--cf-primary)",
                          color: "var(--cf-surface-card)",
                        }}
                        className="font-mono-tabular px-1.5 py-0.5 text-[10px] font-bold tracking-wider"
                      >
                        {p.key}
                      </span>
                      <span
                        style={STAGE_STYLE[stage]}
                        className="inline-flex h-[20px] items-center border px-1.5 text-[11px] font-semibold leading-none"
                      >
                        阶段 · {STAGE_LABEL[stage]}
                      </span>
                    </div>
                    <Link
                      href={`/projects/${p.id}/settings`}
                      className="text-[11px] text-[var(--cf-text-tertiary)] hover:text-[var(--cf-primary)]"
                    >
                      [项目设置]
                    </Link>
                  </div>

                  <Link href={`/projects/${p.id}`} className="group mt-2.5 block">
                    <h2 className="text-[15px] font-bold leading-[22px] text-[var(--cf-text-primary)] group-hover:text-[var(--cf-primary)]">
                      {p.name}
                    </h2>
                    <p className="mt-1 line-clamp-2 min-h-[36px] text-[12.5px] leading-[18px] text-[var(--cf-text-tertiary)]">
                      {charter?.goal || p.summary}
                    </p>
                  </Link>

                  <div className="mt-3.5">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[11px] text-[var(--cf-text-tertiary)]">交付进度</span>
                      <span className="font-mono-tabular text-[12px] font-semibold text-[var(--cf-text-primary)]">
                        {progress}%
                      </span>
                    </div>
                    <ThinProgressBar percent={progress} />
                  </div>

                  <div
                    style={{ borderColor: "var(--cf-border-subtle)", backgroundColor: "var(--cf-surface-secondary)" }}
                    className="mt-3 grid grid-cols-3 divide-x divide-[var(--cf-border-subtle)] border text-[11px]"
                  >
                    <CountCell label="进行中" value={counts.active} tone="var(--cf-primary)" />
                    <CountCell label="待验收" value={counts.review} tone="var(--cf-warning)" />
                    <CountCell label="阻塞" value={counts.blocked} tone={counts.blocked ? "var(--cf-danger)" : "var(--cf-text-tertiary)"} />
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <AvatarGroup
                      items={p.members.slice(0, 5).map((m) => ({
                        id: m.userId,
                        name: m.user.name,
                        short: m.user.name.slice(0, 1),
                        kind: "human" as const,
                      }))}
                      max={5}
                    />
                    <span className="text-[11px] text-[var(--cf-text-tertiary)]">
                      {last ? `活跃于 ${relTime(last.occurredAt)}` : "刚创建"}
                    </span>
                  </div>
                </div>
              );
            })}

            <Link
              href="/projects/new"
              style={{ borderColor: "var(--cf-border-strong)" }}
              className="flex min-h-[220px] flex-col items-center justify-center gap-2 border border-dashed text-[var(--cf-text-tertiary)] transition hover:border-[var(--cf-primary)] hover:text-[var(--cf-primary)]"
            >
              <span className="text-[20px] leading-none">＋</span>
              <span className="text-[12.5px] font-semibold">新建项目</span>
              <span className="max-w-[26ch] text-center text-[11px] leading-[17px]">
                通过 5 步向导（支持软件、内容、竞赛模板）将想法转化为结构化章程与第一批任务
              </span>
            </Link>
          </div>
        )}

        {/* 说明区 */}
        <section
          style={{
            backgroundColor: "var(--cf-surface-card)",
            borderColor: "var(--cf-border-strong)",
          }}
          className="grid gap-4 border p-5 md:grid-cols-[1.1fr_1fr]"
        >
          <div>
            <div className="font-mono-tabular text-[10px] font-semibold tracking-widest text-[var(--cf-text-tertiary)]">
              FACTS OVER MESSAGES
            </div>
            <h2 className="mt-1 text-[15px] font-bold text-[var(--cf-text-primary)]">
              聊天负责交流意图，任务与产物负责表达事实
            </h2>
            <p className="mt-1.5 text-[12.5px] leading-[19px] text-[var(--cf-text-secondary)]">
              平台不会把群聊当成数据库。讨论中的候选结论需要显式「形成决策」才进入事实层；任务只有绑定产物与验收记录才算完成。Agent
              拿到的上下文包，来自这一层。
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11.5px]">
            {[
              ["目标", "带版本号，变更需分析影响"],
              ["任务", "状态机驱动，不可跳级"],
              ["决策", "确认后才进入上下文"],
              ["产物", "完成必须有证据"],
            ].map(([k, v]) => (
              <div
                key={k}
                style={{
                  backgroundColor: "var(--cf-surface-secondary)",
                  borderColor: "var(--cf-border-subtle)",
                }}
                className="border p-2.5"
              >
                <div className="font-semibold text-[var(--cf-text-primary)]">{k}</div>
                <div className="mt-0.5 leading-[16px] text-[var(--cf-text-tertiary)]">{v}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone: string;
}) {
  return (
    <div
      style={{
        backgroundColor: "var(--cf-surface-card)",
        borderColor: "var(--cf-border-strong)",
        borderLeftColor: tone,
        borderLeftWidth: 3,
      }}
      className="flex items-center justify-between border px-4 py-3"
    >
      <div>
        <div className="text-[12px] font-semibold text-[var(--cf-text-primary)]">{label}</div>
        <div className="mt-0.5 text-[10.5px] text-[var(--cf-text-tertiary)]">{hint}</div>
      </div>
      <div className="font-mono-tabular text-[26px] font-bold leading-none" style={{ color: tone }}>
        {value}
      </div>
    </div>
  );
}

function CountCell({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex items-center justify-center gap-1.5 px-1 py-1.5">
      <span className="text-[var(--cf-text-tertiary)]">{label}</span>
      <span className="font-mono-tabular font-semibold" style={{ color: tone }}>
        {value}
      </span>
    </div>
  );
}

function relTime(d: Date) {
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  return `${Math.floor(h / 24)} 天前`;
}
