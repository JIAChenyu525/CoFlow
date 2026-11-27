"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { appendEvent } from "@/lib/events";
import { ARTIFACT_META } from "@/lib/constants";
import type { ArtifactType } from "@prisma/client";

const schema = z.object({
  projectId: z.string().min(1),
  taskId: z.string().optional().nullable(),
  type: z.enum(["COMMIT", "BUILD", "DOC", "DESIGN", "IMAGE", "DATA", "TEST_REPORT", "LINK", "NOTE"]),
  title: z.string().trim().min(2, "产物名称至少 2 个字").max(120),
  location: z.string().trim().min(1, "请填写可定位的位置（提交号 / 路径 / 链接）"),
  version: z.string().trim().default("v1"),
  note: z.string().trim().default(""),
  submitForReview: z.boolean().default(false),
});

/**
 * 产物是"完成"的唯一凭据（§6.8）。
 * 允许提交 NOTE 类型作为明确的无产物说明，但不允许空口完成。
 */
export async function submitArtifact(input: z.input<typeof schema>) {
  try {
    const parsed = schema.safeParse(input);
    if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "校验失败" };
    const d = parsed.data;
    const user = await requireUser();

    const m = await prisma.membership.findUnique({
      where: { projectId_userId: { projectId: d.projectId, userId: user.id } },
    });
    if (!m || m.role === "OBSERVER") return { ok: false as const, error: "没有提交产物的权限" };

    const task = d.taskId ? await prisma.task.findUnique({ where: { id: d.taskId } }) : null;

    await prisma.$transaction(async (tx) => {
      const artifact = await tx.artifact.create({
        data: {
          projectId: d.projectId,
          taskId: d.taskId || null,
          type: d.type as ArtifactType,
          title: d.title,
          location: d.location,
          version: d.version,
          note: d.note,
          submittedById: user.id,
        },
      });

      await tx.message.create({
        data: {
          projectId: d.projectId,
          taskId: d.taskId || null,
          channel: "general",
          type: "ARTIFACT_SUBMIT",
          authorId: user.id,
          body: `提交${ARTIFACT_META[d.type].label}「${d.title}」→ ${d.location}`,
          refType: "ARTIFACT",
          refId: artifact.id,
        },
      });

      await appendEvent(tx, {
        projectId: d.projectId,
        type: "artifact.submitted",
        actorId: user.id,
        subjectType: "artifact",
        subjectId: artifact.id,
        payload: {
          taskId: d.taskId || null,
          artifactType: d.type,
          title: d.title,
          location: d.location,
        },
      });

      if (d.submitForReview && task) {
        const allowed = ["IN_PROGRESS", "READY", "BLOCKED"];
        if (allowed.includes(task.status)) {
          await tx.task.update({
            where: { id: task.id },
            data: { status: "IN_REVIEW", version: { increment: 1 } },
          });
          await appendEvent(tx, {
            projectId: d.projectId,
            type: "task.status_changed",
            actorId: user.id,
            subjectType: "task",
            subjectId: task.id,
            payload: { from: task.status, to: "IN_REVIEW", via: "artifact.submitted" },
          });
        }
      }
    });

    revalidatePath(`/projects/${d.projectId}`, "layout");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "提交失败" };
  }
}
