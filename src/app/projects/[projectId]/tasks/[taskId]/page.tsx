import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { canReview, requireUser } from "@/lib/auth";
import { checkTransition, TRANSITIONS } from "@/lib/task-state";
import { loadDispatchData } from "@/lib/dispatch-data";
import {
  ARTIFACT_META,
  STATUS_META,
  VERDICT_META,
} from "@/lib/constants";
import { Avatar, Breadcrumb, Pill, formatDate, formatTime } from "@/components/ui";
import { PriorityBadge, TaskStatusBadge } from "@/components/ds";
import { DS_PRIORITY, DS_STATUS } from "@/lib/ds-map";
import { TaskTransitionPanel, ArtifactForm, ReviewForm } from "@/components/task-panels";
import { DispatchLease } from "@/components/dispatch-lease";
import { TaskClaimCard } from "@/components/task-claim";
import { TaskEditForm } from "@/components/task-edit";
import type { TaskStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = {
  "CLARIFY->UNCLAIMED": "输入齐备",
  "UNCLAIMED->READY": "标记就绪",
  "READY->IN_PROGRESS": "开始执行",
  "IN_PROGRESS->IN_REVIEW": "提交验收",
  "IN_REVIEW->IN_PROGRESS": "退回修改",
  "DONE->IN_PROGRESS": "重新打开（返工）",
  "BLOCKED->IN_PROGRESS": "解除阻塞",
  "BLOCKED->READY": "解除阻塞",
  "PAUSED->IN_PROGRESS": "恢复执行",
};

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; taskId: string }>;
}) {
  const { projectId, taskId } = await params;
  const user = await requireUser();

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      project: { include: { members: { include: { user: true } }, milestones: { orderBy: { sort: "asc" } } } },
      assignee: true,
      reviewer: true,
      milestone: true,
      artifacts: { orderBy: { createdAt: "desc" }, include: { submittedBy: true } },
      reviews: { orderBy: { createdAt: "desc" }, include: { reviewer: true } },
      dependencies: { include: { dependsOn: { select: { id: true, title: true, status: true } } } },
      _count: { select: { artifacts: true } },
    },
  });

  if (!task || task.projectId !== projectId) notFound();

  const { endpoints, activeLease, dispatchOptions } = await loadDispatchData(projectId, {
    id: task.id,
    scope: task.scope,
  });

  const me = task.project.members.find((m) => m.userId === user.id);
  const writable = !!me && me.role !== "OBSERVER";
  const reviewer = canReview(me?.role);

  const ctx = {
    hasAssignee: !!task.assigneeId,
    hasAcceptance: task.acceptance.trim().length > 0,
    hasInputs: task.inputs.trim().length > 0,
    artifactCount: task._count.artifacts,
    canReview: reviewer,
    canRework: reviewer,
  };

  const actions = TRANSITIONS[task.status as TaskStatus]
    .filter((to) => to !== "DONE")
    .map((to) => ({
      to,
      issue: checkTransition(task.status as TaskStatus, to, ctx),
    }))
    .filter((a) => !a.issue)
    .map((a) => ({
      to: a.to,
      label: LABELS[`${task.status}->${a.to}`] ?? `→ ${STATUS_META[a.to as TaskStatus].label}`,
      kind:
        a.to === "CANCELLED"
          ? ("danger" as const)
          : a.to === "IN_PROGRESS" || a.to === "IN_REVIEW"
            ? ("primary" as const)
            : ("normal" as const),
    }));

  const meta = STATUS_META[task.status as TaskStatus];

  return (
    <main className="px-5 py-5">
      <Breadcrumb
        items={[
          { label: "项目大厅", href: "/" },
          { label: task.project.name, href: `/projects/${projectId}` },
          { label: "任务与分工", href: `/projects/${projectId}/tasks` },
          { label: task.title },
        ]}
      />

      <div className="mt-3 grid gap-5 xl:grid-cols-[minmax(0,1fr)_322px]">
        <div className="min-w-0 space-y-4">
          <header>
            <div className="flex flex-wrap items-center gap-2">
              <TaskStatusBadge status={DS_STATUS[task.status]} size="default" />
              <PriorityBadge level={DS_PRIORITY[task.priority]} showLabel={false} />
              {task.milestone && <span className="tag">{task.milestone.title}</span>}
              {task.revision > 1 && <span className="tag">返工第 {task.revision - 1} 轮</span>}
            </div>
            <h1 className="mt-2 text-[22px] font-semibold leading-snug tracking-tight">
              {task.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-[var(--muted)]">
              <span className="flex items-center gap-1.5">
                负责人
                {task.assignee ? (
                  <>
                    <Avatar name={task.assignee.name} color={task.assignee.color} size={18} />
                    <span className="text-[var(--ink-2)]">{task.assignee.name}</span>
                  </>
                ) : (
                  <span className="text-[var(--amber)]">未指定</span>
                )}
              </span>
              <span>
                验收人{" "}
                <span className="text-[var(--ink-2)]">{task.reviewer?.name ?? "项目负责人"}</span>
              </span>
              <span>
                截止 <span className="text-[var(--ink-2)]">{formatDate(task.dueDate)}</span>
              </span>
              <span className="mono">权重 w{task.weight}</span>
            </div>
          </header>

          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="label">任务定义</span>
              <div className="flex items-center gap-2">
                <Link
                  href={`/projects/${projectId}/tasks/${task.id}/context`}
                  className="btn btn-sm"
                >
                  上下文包
                </Link>
                {writable && (
                  <TaskEditForm
                    canEdit={writable}
                    members={task.project.members.map((m) => ({
                      userId: m.userId,
                      name: m.user.name,
                    }))}
                    milestones={task.project.milestones.map((m) => ({
                      id: m.id,
                      title: m.title,
                    }))}
                    task={{
                      id: task.id,
                      version: task.version,
                      title: task.title,
                      description: task.description,
                      inputs: task.inputs,
                      scope: task.scope,
                      nonScope: task.nonScope,
                      acceptance: task.acceptance,
                      priority: task.priority,
                      assigneeId: task.assigneeId,
                      reviewerId: task.reviewerId,
                      milestoneId: task.milestoneId,
                      dueDate: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : null,
                      weight: task.weight,
                    }}
                  />
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Def label="任务说明" value={task.description} full />
              <Def label="输入材料" value={task.inputs} />
              <Def label="工作范围" value={task.scope} />
              <Def label="非工作范围" value={task.nonScope} />
              <Def label="验收标准" value={task.acceptance} full accent />
            </div>

            {task.status === "BLOCKED" && (
              <div className="mt-4 rounded-lg border border-[var(--red)]/30 bg-[var(--red-soft)]/50 p-3">
                <div className="text-[11.5px] font-semibold text-[var(--red)]">阻塞中</div>
                <p className="mt-1 text-[12px] text-[var(--ink-2)]">{task.blockedReason}</p>
                {task.blockedNeeds && (
                  <p className="mt-1 text-[11.5px] text-[var(--muted)]">需要：{task.blockedNeeds}</p>
                )}
              </div>
            )}
          </div>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[13.5px] font-semibold">产物与证据 · {task.artifacts.length}</h2>
              <span className="text-[10.5px] text-[var(--muted)]">完成状态必须关联产物或明确说明</span>
            </div>
            {task.artifacts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--line-strong)] px-4 py-6 text-center text-[12px] text-[var(--muted)]">
                还没有产物。右侧可以提交提交号、文件、测试报告或链接。
              </div>
            ) : (
              <div className="card divide-y divide-[var(--line)]">
                {task.artifacts.map((a) => (
                  <div key={a.id} className="flex items-start gap-3 px-4 py-2.5">
                    <span className="tag mt-0.5 shrink-0">{ARTIFACT_META[a.type].label}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[12.5px] font-medium">{a.title}</span>
                        <span className="mono text-[10px] text-[var(--faint)]">{a.version}</span>
                      </div>
                      <p className="mono mt-0.5 truncate text-[11px] text-[var(--accent-ink)]">
                        {a.location}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-[10.5px] text-[var(--muted)]">
                      <div>{a.submittedBy.name}</div>
                      <div className="mono text-[var(--faint)]">{formatTime(a.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-[13.5px] font-semibold">验收记录 · {task.reviews.length}</h2>
            {task.reviews.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--line-strong)] px-4 py-6 text-center text-[12px] text-[var(--muted)]">
                还没有验收记录。
              </div>
            ) : (
              <div className="space-y-2">
                {task.reviews.map((r) => (
                  <div key={r.id} className="card p-3">
                    <div className="flex items-center gap-2">
                      <Pill tone={VERDICT_META[r.verdict].tone}>{VERDICT_META[r.verdict].label}</Pill>
                      <span className="text-[11.5px] font-medium">{r.reviewer.name}</span>
                      <span className="mono ml-auto text-[10.5px] text-[var(--faint)]">
                        {formatTime(r.createdAt)}
                      </span>
                    </div>
                    {r.criteriaNotes && (
                      <p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-relaxed text-[var(--ink-2)]">
                        {r.criteriaNotes}
                      </p>
                    )}
                    {r.comment && (
                      <p className="mt-1 text-[11.5px] text-[var(--muted)]">{r.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-3">
          {writable && !["DONE", "CANCELLED"].includes(task.status) && (
            <TaskClaimCard taskId={task.id} assigneeName={task.assignee?.name ?? null} />
          )}

          {writable ? (
            <TaskTransitionPanel taskId={task.id} statusLabel={meta.label} actions={actions} />
          ) : (
            <div className="card p-3.5 text-[11.5px] text-[var(--muted)]">
              当前身份为观察员，只能查看。
            </div>
          )}

          {task.status === "IN_REVIEW" && reviewer && (
            <ReviewForm taskId={task.id} />
          )}

          {activeLease && (
            <div className="card p-3.5">
              <div className="flex items-center justify-between">
                <span className="label">当前租约</span>
                <Pill tone={activeLease.status === "OFFERED" ? "amber" : "accent"} dot>
                  {activeLease.status === "OFFERED"
                    ? "待领取"
                    : activeLease.status === "ACCEPTED"
                      ? "已接受"
                      : "执行中"}
                </Pill>
              </div>
              <p className="mt-1.5 text-[11.5px] text-[var(--ink-2)]">
                {activeLease.endpoint.toolType} · 上下文 {activeLease.contextSnapshotId.slice(-6)}
              </p>
              <p className="mt-0.5 text-[10.5px] text-[var(--muted)]">
                过期时间 {formatTime(activeLease.expiresAt)}。过期后本租约作废，需重新派发。
              </p>
            </div>
          )}

          {!activeLease && task.status === "READY" && writable && endpoints.length > 0 && (
            <div className="card p-3">
              <div className="label mb-2">派发</div>
              <DispatchLease taskId={task.id} options={dispatchOptions} />
              <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--faint)]">
                派发不等于开工。连接器领取后任务才进入进行中，且只能提交到待验收。
              </p>
            </div>
          )}

          {!activeLease && task.status === "READY" && writable && endpoints.length === 0 && (
            <div className="rounded-lg border border-dashed border-[var(--line-strong)] p-3 text-[10.5px] leading-relaxed text-[var(--muted)]">
              还没有可用端点。去
              <Link href="/agent" className="mx-1 text-[var(--accent-ink)] underline-offset-2 hover:underline">
                Agent 连接
              </Link>
              配对一台设备后才能派发。
            </div>
          )}

          {writable && (
            <div className="card p-3">
              <div className="label mb-2">提交产物</div>
              <ArtifactForm projectId={projectId} taskId={task.id} />
            </div>
          )}

          {task.dependencies.length > 0 && (
            <div className="card p-3.5">
              <div className="label">前置依赖</div>
              <div className="mt-2 space-y-1.5">
                {task.dependencies.map((d) => (
                  <Link
                    key={d.id}
                    href={`/projects/${projectId}/tasks/${d.dependsOn.id}`}
                    className="row-link flex items-center gap-2 rounded-md px-1.5 py-1"
                  >
                    <Pill tone={STATUS_META[d.dependsOn.status as TaskStatus].tone} dot>
                      {STATUS_META[d.dependsOn.status as TaskStatus].label}
                    </Pill>
                    <span className="truncate text-[11.5px]">{d.dependsOn.title}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="card space-y-1.5 p-3.5 text-[11px]">
            <div className="label">元信息</div>
            <Row k="任务 ID" v={<span className="mono">{task.id.slice(-8)}</span>} />
            <Row k="定义版本" v={<span className="mono">v{task.version}</span>} />
            <Row k="返工轮次" v={<span className="mono">{task.revision - 1}</span>} />
            <Row k="创建时间" v={formatDate(task.createdAt)} />
            <Row k="更新时间" v={formatDate(task.updatedAt)} />
            <Row k="所属项目" v={task.project.key} />
          </div>
        </aside>
      </div>
    </main>
  );
}

function Def({
  label,
  value,
  full,
  accent,
}: {
  label: string;
  value: string;
  full?: boolean;
  accent?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <div className="label">{label}</div>
      <p
        className={`mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed ${
          value
            ? accent
              ? "rounded-md bg-[var(--accent-soft)]/50 px-2 py-1.5 text-[var(--ink)]"
              : "text-[var(--ink-2)]"
            : "text-[var(--faint)]"
        }`}
      >
        {value || "未填写"}
      </p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[var(--muted)]">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  );
}
