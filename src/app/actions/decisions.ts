"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { appendEvent } from "@/lib/events";

const proposeSchema = z.object({
  projectId: z.string().min(1),
  taskId: z.string().optional().nullable(),
  title: z.string().trim().min(2, "给这个决策一个可检索的标题").max(120),
  conclusion: z.string().trim().min(2, "结论不能为空"),
  rationale: z.string().trim().min(2, "理由不能为空"),
  alternatives: z.string().trim().default(""),
  impact: z.string().trim().default(""),
});

/**
 * 讨论 → 决策：只有在"确认"之后才进入事实层。
 * 提案本身不参与上下文构建，避免把未定论当成指令（§5.3）。
 */
export async function proposeDecision(input: z.input<typeof proposeSchema>) {
  try {
    const parsed = proposeSchema.safeParse(input);
    if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "校验失败" };
    const d = parsed.data;
    const user = await requireUser();
    const m = await prisma.membership.findUnique({
      where: { projectId_userId: { projectId: d.projectId, userId: user.id } },
    });
    if (!m || m.role === "OBSERVER") return { ok: false as const, error: "没有提案权限" };

    await prisma.$transaction(async (tx) => {
      const decision = await tx.decision.create({
        data: {
          projectId: d.projectId,
          taskId: d.taskId || null,
          title: d.title,
          conclusion: d.conclusion,
          rationale: d.rationale,
          alternatives: d.alternatives,
          impact: d.impact,
          status: "PROPOSED",
          decidedById: user.id,
        },
      });
      await tx.message.create({
        data: {
          projectId: d.projectId,
          taskId: d.taskId || null,
          channel: "general",
          type: "DECISION_PROPOSAL",
          authorId: user.id,
          body: `提出决策「${d.title}」：${d.conclusion}`,
          refType: "DECISION",
          refId: decision.id,
        },
      });
      await appendEvent(tx, {
        projectId: d.projectId,
        type: "decision.proposed",
        actorId: user.id,
        subjectType: "decision",
        subjectId: decision.id,
        payload: { title: d.title, conclusion: d.conclusion },
      });
    });

    revalidatePath(`/projects/${d.projectId}`, "layout");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "提案失败" };
  }
}

const confirmSchema = z.object({
  decisionId: z.string().min(1),
  supersedesId: z.string().optional().nullable(),
});

export async function confirmDecision(input: z.input<typeof confirmSchema>) {
  try {
    const parsed = confirmSchema.safeParse(input);
    if (!parsed.success) return { ok: false as const, error: "参数错误" };
    const d = parsed.data;

    const user = await requireUser();
    const decision = await prisma.decision.findUnique({ where: { id: d.decisionId } });
    if (!decision) return { ok: false as const, error: "决策不存在" };

    const m = await prisma.membership.findUnique({
      where: { projectId_userId: { projectId: decision.projectId, userId: user.id } },
    });
    if (!m || !["OWNER", "LEAD"].includes(m.role)) {
      return { ok: false as const, error: "只有发起人或负责人可以确认决策" };
    }

    await prisma.$transaction(async (tx) => {
      if (d.supersedesId) {
        await tx.decision.update({
          where: { id: d.supersedesId },
          data: { status: "SUPERSEDED" },
        });
      }
      await tx.decision.update({
        where: { id: decision.id },
        data: {
          status: "CONFIRMED",
          confirmedAt: new Date(),
          decidedById: user.id,
          supersedesId: d.supersedesId || null,
          version: { increment: d.supersedesId ? 1 : 0 },
        },
      });
      await appendEvent(tx, {
        projectId: decision.projectId,
        type: "decision.confirmed",
        actorId: user.id,
        subjectType: "decision",
        subjectId: decision.id,
        payload: {
          title: decision.title,
          supersedes: d.supersedesId || null,
        },
      });
    });

    revalidatePath(`/projects/${decision.projectId}`, "layout");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "确认失败" };
  }
}
