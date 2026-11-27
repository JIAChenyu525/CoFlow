"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { canReview, requireUser } from "@/lib/auth";
import { appendEvent } from "@/lib/events";

const schema = z.object({
  taskId: z.string().min(1),
  verdict: z.enum(["PASS", "RETURN", "NEED_MORE"]),
  criteriaNotes: z.string().trim().default(""),
  comment: z.string().trim().default(""),
  artifactId: z.string().optional().nullable(),
});

/**
 * 验收是完成状态的唯一入口：标准 → 证据 → 结论（§6.8）。
 * 自动检查可以产出证据，但只有具备验收权的人能下结论。
 */
export async function submitReview(input: z.input<typeof schema>) {
  try {
    const parsed = schema.safeParse(input);
    if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "校验失败" };
    const d = parsed.data;

    const task = await prisma.task.findUnique({
      where: { id: d.taskId },
      include: { _count: { select: { artifacts: true } } },
    });
    if (!task) return { ok: false as const, error: "任务不存在" };
    if (task.status !== "IN_REVIEW") {
      return { ok: false as const, error: "只有「待验收」的任务可以做验收结论" };
    }
    if (task._count.artifacts === 0) {
      return { ok: false as const, error: "没有任何产物或说明，不能通过验收" };
    }

    const user = await requireUser();
    const m = await prisma.membership.findUnique({
      where: { projectId_userId: { projectId: task.projectId, userId: user.id } },
    });
    if (!canReview(m?.role)) {
      return { ok: false as const, error: "当前身份没有验收权" };
    }

    await prisma.$transaction(async (tx) => {
      await tx.review.create({
        data: {
          taskId: task.id,
          artifactId: d.artifactId || null,
          verdict: d.verdict,
          criteriaNotes: d.criteriaNotes,
          comment: d.comment,
          reviewerId: user.id,
        },
      });

      const nextStatus = d.verdict === "PASS" ? "DONE" : "IN_PROGRESS";
      await tx.task.update({
        where: { id: task.id },
        data: { status: nextStatus, version: { increment: 1 } },
      });

      await appendEvent(tx, {
        projectId: task.projectId,
        type: "review.completed",
        actorId: user.id,
        subjectType: "task",
        subjectId: task.id,
        payload: { verdict: d.verdict, nextStatus, comment: d.comment },
      });

      if (d.verdict !== "PASS") {
        await tx.message.create({
          data: {
            projectId: task.projectId,
            taskId: task.id,
            channel: "general",
            type: "SYSTEM",
            authorId: user.id,
            body: `验收${d.verdict === "RETURN" ? "退回" : "要求补充材料"}：${
              d.comment || "请按验收标准补齐证据"
            }`,
            refType: "TASK",
            refId: task.id,
          },
        });
      }
    });

    revalidatePath(`/projects/${task.projectId}`, "layout");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "验收失败" };
  }
}
