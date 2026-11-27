"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { canReview, requireUser } from "@/lib/auth";
import { appendEvent } from "@/lib/events";
import { checkTransition, type TaskContext } from "@/lib/task-state";
import type { Priority, TaskStatus } from "@prisma/client";

type Result = { ok: true } | { ok: false; error: string };

async function assertWrite(projectId: string) {
  const user = await requireUser();
  const m = await prisma.membership.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  });
  if (!m || m.role === "OBSERVER") throw new Error("当前身份没有写入权限");
  return { user, role: m.role };
}

const createSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().trim().min(2, "任务名称至少 2 个字").max(120),
  description: z.string().trim().default(""),
  inputs: z.string().trim().default(""),
  scope: z.string().trim().default(""),
  nonScope: z.string().trim().default(""),
  acceptance: z.string().trim().default(""),
  priority: z.enum(["P0", "P1", "P2", "P3"]).default("P2"),
  assigneeId: z.string().optional().nullable(),
  reviewerId: z.string().optional().nullable(),
  milestoneId: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  weight: z.coerce.number().int().min(1).max(20).default(1),
  dependsOn: z.array(z.string()).default([]),
});

export async function createTask(input: z.input<typeof createSchema>): Promise<Result> {
  try {
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "校验失败" };
    const d = parsed.data;
    const { user } = await assertWrite(d.projectId);

    // 建任务时就具备开工条件（有验收标准 + 有负责人）的，直接进入「已就绪」，
    // 不再让人为了走状态机额外点两下。缺条件的仍停在「待澄清」，这是有意的拦截。
    const initialStatus: TaskStatus =
      d.acceptance.trim().length > 0 && d.assigneeId ? "READY" : "CLARIFY";

    await prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          projectId: d.projectId,
          title: d.title,
          description: d.description,
          inputs: d.inputs,
          scope: d.scope,
          nonScope: d.nonScope,
          acceptance: d.acceptance,
          priority: d.priority as Priority,
          assigneeId: d.assigneeId || null,
          reviewerId: d.reviewerId || null,
          milestoneId: d.milestoneId || null,
          dueDate: d.dueDate ? new Date(d.dueDate) : null,
          weight: d.weight,
          status: initialStatus,
        },
      });
      if (d.dependsOn.length) {
        await tx.taskDependency.createMany({
          data: d.dependsOn.map((id) => ({ taskId: task.id, dependsOnTaskId: id })),
        });
      }
      await appendEvent(tx, {
        projectId: d.projectId,
        type: "task.created",
        actorId: user.id,
        subjectType: "task",
        subjectId: task.id,
        payload: { title: task.title, status: initialStatus, priority: task.priority },
      });
    });

    revalidatePath(`/projects/${d.projectId}`, "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "创建失败" };
  }
}

const updateSchema = z.object({
  taskId: z.string().min(1),
  version: z.coerce.number().int(),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().default(""),
  inputs: z.string().trim().default(""),
  scope: z.string().trim().default(""),
  nonScope: z.string().trim().default(""),
  acceptance: z.string().trim().default(""),
  priority: z.enum(["P0", "P1", "P2", "P3"]),
  assigneeId: z.string().nullable().optional(),
  reviewerId: z.string().nullable().optional(),
  milestoneId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  weight: z.coerce.number().int().min(1).max(20),
});

/** 带版本号的更新：并发提交时后到者拿到冲突，而不是覆盖（§9.2） */
export async function updateTask(input: z.input<typeof updateSchema>): Promise<Result> {
  try {
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "校验失败" };
    const d = parsed.data;
    const task = await prisma.task.findUnique({ where: { id: d.taskId } });
    if (!task) return { ok: false, error: "任务不存在" };
    const { user } = await assertWrite(task.projectId);

    await prisma.$transaction(async (tx) => {
      const res = await tx.task.updateMany({
        where: { id: d.taskId, version: d.version },
        data: {
          title: d.title,
          description: d.description,
          inputs: d.inputs,
          scope: d.scope,
          nonScope: d.nonScope,
          acceptance: d.acceptance,
          priority: d.priority as Priority,
          assigneeId: d.assigneeId || null,
          reviewerId: d.reviewerId || null,
          milestoneId: d.milestoneId || null,
          dueDate: d.dueDate ? new Date(d.dueDate) : null,
          weight: d.weight,
          version: { increment: 1 },
        },
      });
      if (res.count === 0) throw new Error("任务已被他人修改，请刷新后重试（版本冲突）");
      await appendEvent(tx, {
        projectId: task.projectId,
        type: "task.updated",
        actorId: user.id,
        subjectType: "task",
        subjectId: d.taskId,
        payload: { fromVersion: d.version, toVersion: d.version + 1 },
      });
    });
    revalidatePath(`/projects/${task.projectId}`, "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "更新失败" };
  }
}

const transitionSchema = z.object({
  taskId: z.string().min(1),
  to: z.enum([
    "CLARIFY",
    "UNCLAIMED",
    "READY",
    "IN_PROGRESS",
    "IN_REVIEW",
    "DONE",
    "BLOCKED",
    "PAUSED",
    "CANCELLED",
  ]),
  note: z.string().trim().optional().default(""),
  blockedReason: z.string().trim().optional().default(""),
  blockedNeeds: z.string().trim().optional().default(""),
});

export async function transitionTask(
  input: z.input<typeof transitionSchema>
): Promise<Result> {
  try {
    const parsed = transitionSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "校验失败" };
    const d = parsed.data;

    const task = await prisma.task.findUnique({
      where: { id: d.taskId },
      include: { _count: { select: { artifacts: true } } },
    });
    if (!task) return { ok: false, error: "任务不存在" };
    const { user, role } = await assertWrite(task.projectId);
    const reviewerPower = canReview(role);

    const ctx: TaskContext = {
      hasAssignee: !!task.assigneeId,
      hasAcceptance: task.acceptance.trim().length > 0,
      hasInputs: task.inputs.trim().length > 0,
      artifactCount: task._count.artifacts,
      note: d.note,
      canReview: reviewerPower,
      canRework: reviewerPower,
    };

    const issue = checkTransition(task.status, d.to as TaskStatus, ctx);
    if (issue) return { ok: false, error: issue };

    if (d.to === "BLOCKED" && !d.blockedReason.trim()) {
      return { ok: false, error: "进入阻塞必须写清原因与所需支持" };
    }

    await prisma.$transaction(async (tx) => {
      const data: Record<string, unknown> = {
        status: d.to,
        version: { increment: 1 },
      };
      if (d.to === "BLOCKED") {
        data.blockedReason = d.blockedReason;
        data.blockedNeeds = d.blockedNeeds;
      } else if (task.status === "BLOCKED") {
        data.blockedReason = null;
        data.blockedNeeds = null;
      }
      if (task.status === "DONE" && d.to === "IN_PROGRESS") {
        data.revision = { increment: 1 };
      }
      // 并发保护：带上读取时的版本号，被别人抢先改过就整体回滚
      const applied = await tx.task.updateMany({
        where: { id: task.id, version: task.version },
        data,
      });
      if (applied.count === 0) {
        throw new Error("任务已被他人修改，请刷新后重试（版本冲突）");
      }

      // 无产物说明也要留痕，否则“完成”没有解释
      if (d.to === "IN_REVIEW" && d.note.trim()) {
        await tx.message.create({
          data: {
            projectId: task.projectId,
            taskId: task.id,
            channel: "general",
            type: "ARTIFACT_SUBMIT",
            authorId: user.id,
            body: `提交验收说明：${d.note}`,
            refType: "TASK",
            refId: task.id,
          },
        });
      }

      // 通过状态机直接完成时，同样要生成验收记录
      if (d.to === "DONE") {
        await tx.review.create({
          data: {
            taskId: task.id,
            verdict: "PASS",
            criteriaNotes: d.note,
            comment: d.note || "通过",
            reviewerId: user.id,
          },
        });
      }

      await appendEvent(tx, {
        projectId: task.projectId,
        type:
          d.to === "BLOCKED"
            ? "task.blocked"
            : task.status === "BLOCKED"
              ? "task.unblocked"
              : "task.status_changed",
        actorId: user.id,
        subjectType: "task",
        subjectId: task.id,
        payload: {
          from: task.status,
          to: d.to,
          note: d.note,
          blockedReason: d.blockedReason || undefined,
        },
      });
    });

    revalidatePath(`/projects/${task.projectId}`, "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "状态变更失败" };
  }
}

/**
 * 认领任务：成员自己接下一个没人负责的任务。
 * 认领只是指定负责人，状态推进仍然走状态机规则；
 * 验收标准缺失时直接拒绝——否则认领了也开不了工。
 */
export async function claimTask(taskId: string): Promise<Result> {
  try {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return { ok: false, error: "任务不存在" };

    const { user } = await assertWrite(task.projectId);
    if (task.assigneeId) return { ok: false, error: "这个任务已经有负责人了" };
    if (!task.acceptance.trim()) {
      return { ok: false, error: "先补上验收标准，认领后才知道做到什么程度算完成" };
    }

    await prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id: taskId },
        data: { assigneeId: user.id, version: { increment: 1 } },
      });
      await appendEvent(tx, {
        projectId: task.projectId,
        type: "task.updated",
        actorId: user.id,
        subjectType: "task",
        subjectId: taskId,
        payload: { action: "claimed", assigneeId: user.id },
      });

      let status = task.status as TaskStatus;
      if (status === "CLARIFY" && task.inputs.trim()) {
        await tx.task.update({
          where: { id: taskId },
          data: { status: "UNCLAIMED", version: { increment: 1 } },
        });
        await appendEvent(tx, {
          projectId: task.projectId,
          type: "task.status_changed",
          actorId: user.id,
          subjectType: "task",
          subjectId: taskId,
          payload: { from: "CLARIFY", to: "UNCLAIMED", note: "认领任务" },
        });
        status = "UNCLAIMED";
      }

      if (status === "UNCLAIMED") {
        await tx.task.update({
          where: { id: taskId },
          data: { status: "READY", version: { increment: 1 } },
        });
        await appendEvent(tx, {
          projectId: task.projectId,
          type: "task.status_changed",
          actorId: user.id,
          subjectType: "task",
          subjectId: taskId,
          payload: { from: "UNCLAIMED", to: "READY", note: "认领任务" },
        });
      }
    });

    revalidatePath(`/projects/${task.projectId}`, "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "认领失败" };
  }
}
