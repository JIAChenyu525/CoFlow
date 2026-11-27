"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { appendEvent } from "@/lib/events";

const schema = z.object({
  projectId: z.string().min(1),
  body: z.string().trim().min(1, "消息不能为空").max(4000),
  taskId: z.string().optional().nullable(),
  channel: z.string().default("general"),
  refType: z.string().optional().nullable(),
  refId: z.string().optional().nullable(),
});

export async function postMessage(input: z.input<typeof schema>) {
  try {
    const parsed = schema.safeParse(input);
    if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "校验失败" };
    const d = parsed.data;
    const user = await requireUser();
    const m = await prisma.membership.findUnique({
      where: { projectId_userId: { projectId: d.projectId, userId: user.id } },
    });
    if (!m || m.role === "OBSERVER") return { ok: false as const, error: "观察员不能发言" };

    await prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: {
          projectId: d.projectId,
          taskId: d.taskId || null,
          channel: d.channel,
          type: "TEXT",
          body: d.body,
          authorId: user.id,
          refType: d.refType || null,
          refId: d.refId || null,
        },
      });
      await appendEvent(tx, {
        projectId: d.projectId,
        type: "message.posted",
        actorId: user.id,
        subjectType: "message",
        subjectId: msg.id,
        payload: { channel: d.channel, taskId: d.taskId || null },
      });
    });

    revalidatePath(`/projects/${d.projectId}`, "layout");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "发送失败" };
  }
}
