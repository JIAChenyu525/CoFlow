import "server-only";
import { prisma } from "./db";
import { summarizeWeek } from "./weekly";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 取数交给这里，判断全部交给 weekly.ts 的纯函数。
 * 多取一天是为了避开时区/边界，真正的窗口在 summarizeWeek 里裁。
 */
export async function loadWeeklyReport(userId: string) {
  const projects = await prisma.project.findMany({
    where: { members: { some: { userId } } },
    select: { id: true, name: true, key: true },
  });
  if (projects.length === 0) {
    return summarizeWeek({
      now: new Date(),
      projects: [],
      tasksCreated: [],
      reviews: [],
      taskCreatedAt: [],
      artifacts: [],
      decisions: [],
      sessions: [],
      blocked: [],
      snapshots: [],
    });
  }

  const projectIds = projects.map((p) => p.id);
  const now = new Date();
  const from = new Date(now.getTime() - 8 * DAY_MS);

  const [tasksCreated, reviews, artifacts, decisions, sessions, blocked, snapshots, endEvents] =
    await Promise.all([
      prisma.task.findMany({
        where: { projectId: { in: projectIds }, createdAt: { gte: from } },
        select: { id: true, createdAt: true, projectId: true },
      }),
      prisma.review.findMany({
        where: { task: { projectId: { in: projectIds } }, createdAt: { gte: from } },
        include: {
          task: { select: { id: true, title: true, createdAt: true, projectId: true } },
        },
      }),
      prisma.artifact.findMany({
        where: { projectId: { in: projectIds }, createdAt: { gte: from } },
        select: { id: true, createdAt: true, projectId: true },
      }),
      prisma.decision.findMany({
        where: {
          projectId: { in: projectIds },
          status: "CONFIRMED",
          confirmedAt: { gte: from },
        },
        select: { id: true, confirmedAt: true, projectId: true },
      }),
      prisma.agentSession.findMany({
        where: { task: { projectId: { in: projectIds } }, startedAt: { gte: from } },
        select: { id: true, status: true, startedAt: true },
      }),
      prisma.task.findMany({
        where: { projectId: { in: projectIds }, status: "BLOCKED" },
        select: {
          id: true,
          title: true,
          projectId: true,
          blockedReason: true,
          blockedNeeds: true,
        },
      }),
      prisma.contextSnapshot.findMany({
        where: { task: { projectId: { in: projectIds } }, createdAt: { gte: from } },
        select: { tokens: true, createdAt: true },
      }),
      prisma.projectEvent.findMany({
        where: {
          projectId: { in: projectIds },
          type: "agent.session_ended",
          occurredAt: { gte: from },
        },
        select: { subjectId: true, payload: true },
      }),
    ]);

  // 失败原因从会话结束事件里取
  const reasonBySession = new Map<string, string>();
  for (const e of endEvents) {
    const payload = (e.payload ?? {}) as Record<string, unknown>;
    if (payload.outcome === "failed") {
      reasonBySession.set(e.subjectId, String(payload.reason ?? "未记录原因"));
    }
  }

  return summarizeWeek({
    now,
    projects,
    tasksCreated,
    reviews: reviews.map((r) => ({
      taskId: r.task.id,
      verdict: r.verdict,
      createdAt: r.createdAt,
      projectId: r.task.projectId,
      taskTitle: r.task.title,
    })),
    taskCreatedAt: dedupe(
      reviews.map((r) => ({
        id: r.task.id,
        title: r.task.title,
        createdAt: r.task.createdAt,
        projectId: r.task.projectId,
      }))
    ),
    artifacts,
    decisions: decisions.map((d) => ({
      id: d.id,
      confirmedAt: d.confirmedAt ?? d.confirmedAt ?? new Date(0),
      projectId: d.projectId,
    })),
    sessions: sessions.map((s) => ({
      id: s.id,
      status: s.status,
      startedAt: s.startedAt,
      failureReason: reasonBySession.get(s.id) ?? null,
    })),
    blocked,
    snapshots,
  });
}

function dedupe<T extends { id: string }>(rows: T[]) {
  const seen = new Map<string, T>();
  for (const r of rows) if (!seen.has(r.id)) seen.set(r.id, r);
  return [...seen.values()];
}
