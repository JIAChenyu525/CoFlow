"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { loadContext } from "@/lib/context-data";
import type { Prisma } from "@prisma/client";

/**
 * 保存上下文快照：回答「这个 Agent 那一刻看到了什么」。
 * 快照不可修改，只能新增——否则追溯就没有意义。
 */
export async function saveContextSnapshot(taskId: string) {
  const user = await requireUser();

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return { ok: false as const, error: "任务不存在" };

  const membership = await prisma.membership.findUnique({
    where: { projectId_userId: { projectId: task.projectId, userId: user.id } },
  });
  if (!membership) return { ok: false as const, error: "不是项目成员" };

  const loaded = await loadContext(taskId);
  if (!loaded) return { ok: false as const, error: "无法装配上下文" };

  if (loaded.overBudget) {
    return { ok: false as const, error: "L0/L1 已超出预算，先精简任务定义再保存" };
  }

  const count = await prisma.contextSnapshot.count({ where: { taskId } });

  const snapshot = await prisma.contextSnapshot.create({
    data: {
      taskId,
      endpointId: loaded.pkg.identity.endpoint?.id ?? null,
      hash: loaded.hash,
      version: count + 1,
      tokens: loaded.tokens,
      packageJson: loaded.pkg as unknown as Prisma.InputJsonValue,
    },
  });

  revalidatePath(`/projects/${task.projectId}/tasks/${taskId}/context`);
  return { ok: true as const, id: snapshot.id, version: snapshot.version, hash: snapshot.hash };
}
