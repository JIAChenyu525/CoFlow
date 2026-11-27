import "server-only";
import { prisma } from "./db";
import { buildPackage, renderPrompt, type BuildInput } from "./context";
import { summarizeEvent } from "./events";

/**
 * 从数据库装配上下文包的输入，再交给纯函数 builder。
 * 查询本身不做裁剪——裁剪规则全部集中在 context.ts，便于单独验证。
 */
export async function loadContext(
  taskId: string,
  options: { endpointId?: string | null; budgetTokens?: number } = {}
) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      project: { select: { id: true, key: true, name: true, stage: true } },
      milestone: { select: { title: true } },
      assignee: { select: { id: true, name: true } },
      dependencies: {
        include: { dependsOn: { select: { id: true, title: true, status: true } } },
      },
    },
  });
  if (!task) return null;

  const projectId = task.projectId;

  const [charter, decisions, blockers, events, endpoint, membership] = await Promise.all([
    prisma.charter.findFirst({
      where: { projectId },
      orderBy: { version: "desc" },
    }),
    prisma.decision.findMany({
      where: { projectId, status: "CONFIRMED" },
      orderBy: { confirmedAt: "desc" },
      take: 30,
    }),
    prisma.task.findMany({
      where: { projectId, status: "BLOCKED" },
      take: 10,
      select: { id: true, title: true, blockedReason: true, blockedNeeds: true },
    }),
    prisma.projectEvent.findMany({
      where: { projectId, type: { in: [
        "task.status_changed",
        "task.blocked",
        "artifact.submitted",
        "review.completed",
        "decision.confirmed",
        "charter.updated",
      ] } },
      orderBy: { occurredAt: "desc" },
      take: 8,
    }),
    options.endpointId
      ? prisma.agentEndpoint.findUnique({ where: { id: options.endpointId } })
      : Promise.resolve(null),
    task.assigneeId
      ? prisma.membership.findUnique({
          where: { projectId_userId: { projectId, userId: task.assigneeId } },
        })
      : Promise.resolve(null),
  ]);

  const input: BuildInput = {
    project: task.project,
    task: {
      id: task.id,
      title: task.title,
      description: task.description,
      inputs: task.inputs,
      scope: task.scope,
      nonScope: task.nonScope,
      acceptance: task.acceptance,
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate,
      milestone: task.milestone,
      dependencies: task.dependencies.map((d) => d.dependsOn),
    },
    charter: charter
      ? {
          version: charter.version,
          goal: charter.goal,
          targetUsers: charter.targetUsers,
          scope: charter.scope,
          nonGoals: charter.nonGoals,
          constraints: charter.constraints,
          acceptance: charter.acceptance,
        }
      : null,
    decisions: decisions.map((d) => ({
      id: d.id,
      title: d.title,
      conclusion: d.conclusion,
      impact: d.impact,
      confirmedAt: d.confirmedAt,
      taskId: d.taskId,
    })),
    blockers: blockers.map((b) => ({
      id: b.id,
      title: b.title,
      reason: b.blockedReason ?? "",
      needs: b.blockedNeeds ?? "",
    })),
    recentChanges: events.map((e) => ({
      type: e.type,
      summary: summarizeEvent(e.type, e.payload),
      at: e.occurredAt,
    })),
    endpoint: endpoint
      ? {
          id: endpoint.id,
          toolType: endpoint.toolType,
          capability: endpoint.capability,
          allowedPaths: Array.isArray(endpoint.allowedPaths)
            ? (endpoint.allowedPaths as string[])
            : [],
        }
      : null,
    member: task.assignee
      ? { name: task.assignee.name, role: membership?.role ?? "MEMBER" }
      : null,
    budgetTokens: options.budgetTokens,
  };

  const built = buildPackage(input);

  return {
    ...built,
    task,
    prompt: renderPrompt(built.pkg, task.id),
    input,
  };
}
