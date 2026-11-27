import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { BOARD_COLUMNS, STATUS_META } from "@/lib/constants";
import { Avatar, Empty, formatDate } from "@/components/ui";
import { PriorityBadge, TaskStatusBadge } from "@/components/ds";
import { DS_PRIORITY, DS_STATUS } from "@/lib/ds-map";
import { TaskCreateDialog } from "@/components/task-create-dialog";
import type { TaskStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function TasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ q?: string; assignee?: string }>;
}) {
  const { projectId } = await params;
  const sp = await searchParams;
  const query = (sp.q ?? "").trim();
  const assignee = sp.assignee ?? "";
  const user = await requireUser();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      members: { include: { user: true } },
      milestones: { orderBy: { sort: "asc" } },
      tasks: {
        orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
        include: {
          assignee: { select: { name: true, color: true } },
          _count: { select: { artifacts: true, dependencies: true } },
        },
      },
    },
  });
  if (!project) notFound();

  const me = project.members.find((m) => m.userId === user.id);
  const writable = !!me && me.role !== "OBSERVER";

  // 看板数据量小，直接在内存里过滤，避免为筛选拼 where 条件
  const tasks = project.tasks.filter((t) => {
    const hitQuery =
      !query ||
      t.title.toLowerCase().includes(query.toLowerCase()) ||
      t.description.toLowerCase().includes(query.toLowerCase());
    const hitAssignee = !assignee || t.assigneeId === assignee;
    return hitQuery && hitAssignee;
  });
  const filtering = Boolean(query || assignee);
  const sideTasks = tasks.filter((t) => !BOARD_COLUMNS.includes(t.status));

  return (
    <main className="px-5 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label">Tasks</div>
          <h1 className="mt-1 text-[21px] font-semibold tracking-tight">任务与分工</h1>
          <p className="mt-1 text-[12.5px] text-[var(--muted)]">
            状态由规则驱动：待澄清 → 待认领 → 已就绪 → 进行中 → 待验收 → 已完成。不能跳级。
          </p>
        </div>
        {writable && (
          <TaskCreateDialog
            projectId={project.id}
            currentUserId={user.id}
            members={project.members.map((m) => ({
              userId: m.userId,
              name: m.user.name,
              color: m.user.color,
            }))}
            milestones={project.milestones.map((m) => ({ id: m.id, title: m.title }))}
          />
        )}
      </div>

      <form method="get" className="mt-4 flex flex-wrap items-center gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="搜索标题或说明"
          className="input h-[30px] w-[220px] py-0 text-[12.5px]"
        />
        <select
          name="assignee"
          defaultValue={assignee}
          className="select h-[30px] w-[150px] py-0 text-[12.5px]"
        >
          <option value="">全部负责人</option>
          {project.members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.user.name}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-sm">
          筛选
        </button>
        {filtering && (
          <Link
            href={`/projects/${project.id}/tasks`}
            className="text-[12px] text-[var(--cf-primary)] hover:underline"
          >
            清除
          </Link>
        )}
        <span className="ml-auto font-mono-tabular text-[11px] text-[var(--muted)]">
          显示 {tasks.length} / {project.tasks.length}
        </span>
      </form>

      {sideTasks.length > 0 && (
        <div className="mt-5">
          <div className="label mb-2">旁路状态</div>
          <div className="flex flex-wrap gap-2">
            {sideTasks.map((t) => (
              <Link
                key={t.id}
                href={`/projects/${project.id}/tasks/${t.id}`}
                className="flex min-w-[220px] flex-1 items-start gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2.5 transition hover:border-[var(--line-strong)]"
              >
                <span className="shrink-0">
                  <TaskStatusBadge status={DS_STATUS[t.status as TaskStatus]} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-medium">{t.title}</p>
                  {t.blockedReason && (
                    <p className="mt-0.5 line-clamp-1 text-[10.5px] text-[var(--muted)]">
                      {t.blockedReason}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="scroll-thin mt-5 overflow-x-auto pb-3">
        <div className="grid min-w-[1100px] grid-cols-6 gap-3">
          {BOARD_COLUMNS.map((status) => {
            const meta = STATUS_META[status];
            const items = tasks.filter((t) => t.status === status);
            const weight = items.reduce((s, t) => s + t.weight, 0);
            return (
              <section key={status} className="kanban-col flex flex-col">
                <header className="flex items-center gap-2 border-b border-[var(--line)] px-2.5 py-2">
                  <TaskStatusBadge status={DS_STATUS[status]} />
                  <span className="font-mono-tabular ml-auto text-[10.5px] text-[var(--muted)]">
                    {items.length}
                  </span>
                </header>
                <div className="flex flex-1 flex-col gap-2 p-2">
                  {items.length === 0 && (
                    <p className="px-1 py-6 text-center text-[10.5px] text-[var(--faint)]">
                      {meta.hint}
                    </p>
                  )}
                  {items.map((t) => (
                    <Link
                      key={t.id}
                      href={`/projects/${project.id}/tasks/${t.id}`}
                      className="card card-hover block p-2.5"
                    >
                      <div className="flex items-center gap-1.5">
                        <PriorityBadge level={DS_PRIORITY[t.priority]} showLabel={false} />
                        {t.revision > 1 && (
                          <span className="tag" title="返工轮次">
                            R{t.revision}
                          </span>
                        )}
                        {t.dueDate && (
                          <span
                            className={`mono ml-auto text-[9.5px] ${
                              t.dueDate < new Date() && t.status !== "DONE"
                                ? "text-[var(--red)]"
                                : "text-[var(--faint)]"
                            }`}
                          >
                            {formatDate(t.dueDate).slice(5)}
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-[12px] font-medium leading-snug">{t.title}</p>
                      <div className="mt-2 flex items-center justify-between">
                        {t.assignee ? (
                          <span className="flex items-center gap-1">
                            <Avatar name={t.assignee.name} color={t.assignee.color} size={17} />
                            <span className="text-[10px] text-[var(--muted)]">{t.assignee.name}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-[var(--faint)]">未指派</span>
                        )}
                        <span className="mono flex items-center gap-1.5 text-[9.5px] text-[var(--faint)]">
                          {t._count.artifacts > 0 && <span title="产物数">◇{t._count.artifacts}</span>}
                          {t._count.dependencies > 0 && <span title="依赖数">⛓{t._count.dependencies}</span>}
                          <span title="权重">w{t.weight}</span>
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
                {weight > 0 && (
                  <div className="border-t border-[var(--line)] px-2.5 py-1.5 text-[9.5px] text-[var(--faint)]">
                    权重合计 {weight}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>

      {project.tasks.length === 0 && (
        <div className="mt-6">
          <Empty
            title="还没有任务"
            hint="把目标拆成可交付的任务，每条都要有输入、边界和验收标准。缺任何一项，任务只能停在待澄清。"
          />
        </div>
      )}
    </main>
  );
}
