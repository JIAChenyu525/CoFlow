import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { canReview, requireUser } from "@/lib/auth";
import { PRIORITY_META, ROLE_META, ARTIFACT_META } from "@/lib/constants";
import { computeProgress } from "@/lib/task-state";
import { computeRisks } from "@/lib/risks";
import { Avatar, Progress, formatDate, relativeTime } from "@/components/ui";
import { Conversation, type FeedMessage } from "@/components/conversation";
import { ConfirmDecisionButton } from "@/components/decision-actions";
import { TaskStatusBadge } from "@/components/ds";
import { ProjectAgents } from "@/components/project-agents";

export const dynamic = "force-dynamic";

export default async function WorkbenchPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireUser();

  // 当前用户自己连接的 AI 端点：没连也不影响协作，界面上只提示可选项
  const myEndpoints = await prisma.agentEndpoint.findMany({
    where: {
      device: { userId: user.id, revokedAt: null },
      status: { not: "REVOKED" },
    },
    orderBy: { createdAt: "desc" },
  });

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      charters: { orderBy: { version: "desc" }, take: 1 },
      milestones: { orderBy: { sort: "asc" }, include: { tasks: { select: { id: true, status: true, weight: true } } } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 60,
        include: { author: true, task: { select: { title: true } } },
      },
      decisions: {
        orderBy: { createdAt: "desc" },
        take: 12,
        include: { decidedBy: true },
      },
      artifacts: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { submittedBy: true },
      },
      tasks: {
        include: { assignee: { select: { name: true, color: true } } },
        orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
      },
      members: { include: { user: true } },
    },
  });

  if (!project) notFound();

  const me = project.members.find((m) => m.userId === user.id);
  const writable = !!me && me.role !== "OBSERVER";
  const reviewer = canReview(me?.role);
  const charter = project.charters[0];

  const feed: FeedMessage[] = [...project.messages].reverse().map((m) => ({
    id: m.id,
    type: m.type,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    author: { name: m.author.name, color: m.author.color },
    authorType: m.authorType === "AGENT" ? ("AGENT" as const) : ("HUMAN" as const),
    taskId: m.taskId,
    taskTitle: m.task?.title ?? null,
    refType: m.refType,
    refId: m.refId,
  }));

  const riskTasks = await prisma.task.findMany({
    where: { projectId: project.id, status: { notIn: ["DONE", "CANCELLED"] } },
    include: {
      dependencies: {
        include: { dependsOn: { select: { id: true, title: true, status: true } } },
      },
    },
  });

  const risks = computeRisks(
    riskTasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      dueDate: t.dueDate,
      updatedAt: t.updatedAt,
      createdAt: t.createdAt,
      blockedNeeds: t.blockedNeeds,
      dependencies: t.dependencies.map((d) => ({
        taskId: d.dependsOn.id,
        title: d.dependsOn.title,
        status: d.dependsOn.status,
      })),
    }))
  );

  const projectEndpoints = await prisma.agentEndpoint.count({
    where: { projectId: project.id, status: { not: "REVOKED" } },
  });

  const activeSessions = await prisma.agentSession.findMany({
    where: { task: { projectId: project.id }, status: "ACTIVE" },
    include: {
      task: { select: { id: true, title: true } },
      endpoint: { select: { toolType: true } },
      lease: { select: { declaredPaths: true } },
    },
    orderBy: { startedAt: "desc" },
  });

  const pendingReview = project.tasks.filter((t) => t.status === "IN_REVIEW");
  const blocked = project.tasks.filter((t) => t.status === "BLOCKED");
  const proposals = project.decisions.filter((d) => d.status === "PROPOSED");
  const confirmed = project.decisions.filter((d) => d.status === "CONFIRMED").slice(0, 4);

  return (
    <main className="grid h-[calc(100dvh-134px)] grid-cols-1 lg:h-[calc(100dvh-52px)] lg:grid-cols-[236px_minmax(0,1fr)] xl:grid-cols-[236px_minmax(0,1fr)_306px]">
      {/* 左：方向 */}
      <aside className="scroll-thin hidden overflow-y-auto border-r border-[var(--line)] px-4 py-5 lg:block">
        <div className="label">目标 · 章程 v{charter?.version ?? "—"}</div>
        <p className="mt-1.5 text-[12.5px] font-medium leading-relaxed text-[var(--ink)]">
          {charter?.goal ?? "尚未填写目标"}
        </p>

        <div className="mt-4 space-y-3">
          <CharterField label="交付范围" value={charter?.scope} />
          <CharterField label="非目标" value={charter?.nonGoals} />
          <CharterField label="硬性约束" value={charter?.constraints} />
          <CharterField label="验收口径" value={charter?.acceptance} />
        </div>

        <div className="my-5 h-px bg-[var(--line)]" />

        <div className="label">里程碑</div>
        <div className="mt-2 space-y-2">
          {project.milestones.length === 0 && (
            <p className="text-[11.5px] text-[var(--muted)]">尚未设置里程碑</p>
          )}
          {project.milestones.map((ms) => {
            const p = computeProgress(ms.tasks);
            return (
              <div key={ms.id} className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11.5px] font-semibold leading-snug">{ms.title}</span>
                  <span className="mono shrink-0 text-[10px] text-[var(--muted)]">{p}%</span>
                </div>
                <div className="mt-1.5">
                  <Progress value={p} height={3} />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[10px] text-[var(--muted)]">
                  <span>{ms.tasks.length} 个任务</span>
                  <span>{ms.status === "DONE" ? "已完成" : ms.status === "ACTIVE" ? "进行中" : "计划中"}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="my-5 h-px bg-[var(--line)]" />

        <div className="label">成员 · {project.members.length}</div>
        <div className="mt-2 space-y-1.5">
          {project.members.map((m) => (
            <div key={m.id} className="flex items-center gap-2">
              <Avatar name={m.user.name} color={m.user.color} size={20} />
              <span className="min-w-0 flex-1 truncate text-[11.5px]">{m.user.name}</span>
              <span className="text-[10px] text-[var(--muted)]">{ROLE_META[m.role].label}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* 中：对话 */}
      <section className="flex min-h-0 flex-col border-r border-[var(--line)] bg-[var(--surface)]">
        {/* 窄屏没有右栏，把「我的 AI 工具」折成一条横条，保证任何尺寸下都能选要不要用 AI */}
        <div className="border-b border-[var(--line)] px-4 py-2 xl:hidden">
          <ProjectAgents
            compact
            endpoints={myEndpoints.map((e) => ({
              id: e.id,
              toolType: e.toolType,
              toolVersion: e.toolVersion,
              capability: e.capability,
              status: e.status,
              allowedPaths: Array.isArray(e.allowedPaths) ? (e.allowedPaths as string[]) : [],
              preferred: e.id === user.preferredEndpointId,
            }))}
          />
        </div>

        <header className="flex items-center gap-3 border-b border-[var(--line)] px-5 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-[14px] font-semibold tracking-tight">项目频道</h2>
              <span className="tag">#general</span>
            </div>
            <p className="mt-0.5 text-[11px] text-[var(--muted)]">
              交流意图的地方。结论需确认后才进入事实层。
            </p>
          </div>
          <div className="ml-auto flex -space-x-1.5">
            {project.members.slice(0, 4).map((m) => (
              <span key={m.id} className="rounded-full ring-2 ring-[var(--surface)]">
                <Avatar name={m.user.name} color={m.user.color} size={22} />
              </span>
            ))}
          </div>
        </header>

        <Conversation projectId={project.id} messages={feed} canWrite={writable} />
      </section>

      {/* 右：行动 */}
      <aside className="scroll-thin hidden overflow-y-auto px-4 py-5 xl:block">
        <div className="mb-5">
          <ProjectAgents
            endpoints={myEndpoints.map((e) => ({
              id: e.id,
              toolType: e.toolType,
              toolVersion: e.toolVersion,
              capability: e.capability,
              status: e.status,
              allowedPaths: Array.isArray(e.allowedPaths) ? (e.allowedPaths as string[]) : [],
              preferred: e.id === user.preferredEndpointId,
            }))}
          />
        </div>

        {risks.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <div className="label">风险 · {risks.length}</div>
              <span className="text-[10px] text-[var(--faint)]">
                高 {risks.filter((r) => r.level === "high").length}
                {" · "}中 {risks.filter((r) => r.level === "medium").length}
              </span>
            </div>
            <div className="mt-2 space-y-1.5">
              {risks.slice(0, 5).map((r) => (
                <Link
                  key={r.id}
                  href={`/projects/${project.id}/tasks/${r.taskId}`}
                  className={`block rounded-lg border px-2.5 py-1.5 transition hover:border-[var(--line-strong)] ${
                    r.level === "high"
                      ? "border-[var(--red)]/30 bg-[var(--red-soft)]/40"
                      : r.level === "medium"
                        ? "border-[var(--amber)]/30 bg-[var(--amber-soft)]/40"
                        : "border-[var(--line)]"
                  }`}
                >
                  <div className="flex items-start gap-1.5">
                    <span
                      className="mt-[6px] h-[5px] w-[5px] shrink-0 rounded-full"
                      style={{
                        background:
                          r.level === "high"
                            ? "var(--red)"
                            : r.level === "medium"
                              ? "var(--amber)"
                              : "var(--faint)",
                      }}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[11.5px] font-medium">{r.title}</p>
                      <p className="mt-0.5 text-[10.5px] leading-relaxed text-[var(--muted)]">
                        {r.detail}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
              {risks.length > 5 && (
                <p className="px-1 text-[10px] text-[var(--faint)]">
                  还有 {risks.length - 5} 条未显示
                </p>
              )}
            </div>
            <div className="my-5 h-px bg-[var(--line)]" />
          </>
        )}

        <div className="label">需要处理</div>
        <div className="mt-2 space-y-2">
          {proposals.map((d) => (
            <div key={d.id} className="rounded-lg border border-[var(--amber)]/35 bg-[var(--amber-soft)]/50 p-2.5">
              <div className="flex items-center gap-1.5">
                <span className="pill pill--amber">待确认决策</span>
              </div>
              <p className="mt-1 text-[11.5px] font-semibold leading-snug">{d.title}</p>
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-[var(--muted)]">
                {d.conclusion}
              </p>
              {reviewer && <ConfirmDecisionButton decisionId={d.id} />}
            </div>
          ))}

          {pendingReview.map((t) => (
            <Link
              key={t.id}
              href={`/projects/${project.id}/tasks/${t.id}`}
              className="block rounded-lg border border-[var(--line)] p-2.5 transition hover:border-[var(--amber)]"
            >
              <div className="flex items-center justify-between">
                <TaskStatusBadge status="pending_accept" />
                <span className="mono text-[10px] text-[var(--muted)]">
                  {PRIORITY_META[t.priority].label}
                </span>
              </div>
              <p className="mt-1 text-[11.5px] font-medium leading-snug">{t.title}</p>
            </Link>
          ))}

          {blocked.map((t) => (
            <Link
              key={t.id}
              href={`/projects/${project.id}/tasks/${t.id}`}
              className="block rounded-lg border border-[var(--red)]/30 bg-[var(--red-soft)]/40 p-2.5"
            >
              <span className="pill pill--red">阻塞</span>
              <p className="mt-1 text-[11.5px] font-medium leading-snug">{t.title}</p>
              {t.blockedNeeds && (
                <p className="mt-0.5 line-clamp-2 text-[10.5px] text-[var(--muted)]">
                  需要：{t.blockedNeeds}
                </p>
              )}
            </Link>
          ))}

          {proposals.length + pendingReview.length + blocked.length === 0 && (
            <p className="rounded-lg border border-dashed border-[var(--line-strong)] px-3 py-4 text-center text-[11px] text-[var(--muted)]">
              没有待办。当前没有阻塞，也没有等结论的验收。
            </p>
          )}
        </div>

        {activeSessions.length > 0 && (
          <>
            <div className="my-5 h-px bg-[var(--line)]" />
            <div className="flex items-center justify-between">
              <div className="label">正在执行 · {activeSessions.length}</div>
              <span className="text-[10px] text-[var(--faint)]">工作声明</span>
            </div>
            <div className="mt-2 space-y-1.5">
              {activeSessions.map((s) => {
                const paths = Array.isArray(s.lease.declaredPaths)
                  ? (s.lease.declaredPaths as string[])
                  : [];
                return (
                  <div
                    key={s.id}
                    className="rounded-lg border border-[var(--accent)]/25 bg-[var(--accent-soft)]/30 px-2.5 py-1.5"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="pill pill--accent">执行中</span>
                      <span className="mono ml-auto text-[9.5px] text-[var(--muted)]">
                        {s.endpoint.toolType}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] font-medium">{s.task.title}</p>
                    <p className="mono mt-0.5 truncate text-[9.5px] text-[var(--muted)]">
                      {paths.length ? paths.join(", ") : "未声明路径"}
                    </p>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="my-5 h-px bg-[var(--line)]" />

        <div className="flex items-center justify-between">
          <div className="label">已确认决策</div>
          <Link href={`/projects/${project.id}/timeline`} className="text-[10.5px] text-[var(--accent-ink)]">
            全部
          </Link>
        </div>
        <div className="mt-2 space-y-2">
          {confirmed.length === 0 && (
            <p className="text-[11px] text-[var(--muted)]">尚无已确认决策</p>
          )}
          {confirmed.map((d) => (
            <div key={d.id} className="rounded-lg border-l-2 border-[var(--green)] bg-[var(--surface-2)] py-1.5 pl-2.5 pr-2">
              <p className="text-[11.5px] font-medium leading-snug">{d.title}</p>
              <p className="mt-0.5 text-[10px] text-[var(--muted)]">
                {d.decidedBy?.name ?? "—"} · {formatDate(d.confirmedAt ?? d.createdAt)}
              </p>
            </div>
          ))}
        </div>

        <div className="my-5 h-px bg-[var(--line)]" />

        <div className="flex items-center justify-between">
          <div className="label">最新产物</div>
          <Link href={`/projects/${project.id}/artifacts`} className="text-[10.5px] text-[var(--accent-ink)]">
            产物中心
          </Link>
        </div>
        <div className="mt-2 space-y-1.5">
          {project.artifacts.length === 0 && (
            <p className="text-[11px] text-[var(--muted)]">还没有产物</p>
          )}
          {project.artifacts.map((a) => (
            <div key={a.id} className="rounded-lg border border-[var(--line)] px-2.5 py-1.5">
              <div className="flex items-center gap-1.5">
                <span className="tag">{ARTIFACT_META[a.type].label}</span>
                <span className="mono ml-auto text-[9.5px] text-[var(--faint)]">{a.version}</span>
              </div>
              <p className="mt-0.5 truncate text-[11px] font-medium">{a.title}</p>
            </div>
          ))}
        </div>

        <div className="my-5 h-px bg-[var(--line)]" />

        <div className="label">Agent 端点</div>
        <div className="mt-2 rounded-lg border border-[var(--line)] p-2.5">
          {projectEndpoints > 0 ? (
            <>
              <p className="text-[11px] font-medium text-[var(--ink-2)]">
                {projectEndpoints} 个端点可用
                {activeSessions.length > 0 && ` · ${activeSessions.length} 个会话执行中`}
              </p>
              <Link
                href="/agent"
                className="mt-1 inline-block text-[10.5px] text-[var(--accent-ink)] hover:underline"
              >
                管理设备与授权
              </Link>
            </>
          ) : (
            <>
              <p className="text-[11px] font-medium text-[var(--ink-2)]">还没有绑定端点</p>
              <p className="mt-0.5 text-[10.5px] leading-relaxed text-[var(--muted)]">
                没有端点也能用完整流程：人工执行，网页提交产物。
              </p>
              <Link
                href="/agent"
                className="mt-1 inline-block text-[10.5px] text-[var(--accent-ink)] hover:underline"
              >
                去连接 Agent
              </Link>
            </>
          )}
        </div>

        <div className="mt-4 text-[10px] text-[var(--faint)]">
          最后同步 · {project.messages[0] ? relativeTime(project.messages[0].createdAt) : "—"}
        </div>
      </aside>
    </main>
  );
}

function CharterField({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <div className="label">{label}</div>
      <p className="mt-0.5 whitespace-pre-wrap text-[11.5px] leading-relaxed text-[var(--ink-2)]">
        {value}
      </p>
    </div>
  );
}
