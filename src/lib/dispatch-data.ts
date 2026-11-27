import "server-only";
import { prisma } from "./db";
import { rankCandidates } from "./dispatch";
import { pathsOverlap } from "./locks";

/**
 * 派发页需要的全部数据：候选端点、当前租约、排序与理由。
 * 放在 server 模块里，页面只负责渲染。
 */
export async function loadDispatchData(
  projectId: string,
  task: { id: string; scope: string }
) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const memberIds = (
    await prisma.membership.findMany({
      where: { projectId },
      select: { userId: true },
    })
  ).map((m) => m.userId);

  const [endpoints, activeLease, submittedRows, failedRows, activeRows, activeClaims] =
    await Promise.all([
      prisma.agentEndpoint.findMany({
        where: {
          device: { userId: { in: memberIds }, revokedAt: null },
          status: { not: "REVOKED" },
        },
        include: { device: { include: { user: { select: { name: true } } } } },
      }),
      prisma.taskLease.findFirst({
        where: { taskId: task.id, status: { in: ["OFFERED", "ACCEPTED", "ACTIVE"] } },
        include: { endpoint: { select: { toolType: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.agentSession.groupBy({
        by: ["endpointId"],
        where: { status: "SUBMITTED", startedAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.agentSession.groupBy({
        by: ["endpointId"],
        where: { status: "FAILED", startedAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.agentSession.groupBy({
        by: ["endpointId"],
        where: { status: "ACTIVE" },
        _count: { _all: true },
      }),
      prisma.agentSession.findMany({
        where: { status: "ACTIVE", task: { projectId } },
        include: { lease: { select: { declaredPaths: true } } },
      }),
    ]);

  const countOf = (
    rows: { endpointId: string; _count: { _all: number } }[],
    id: string
  ) => rows.find((r) => r.endpointId === id)?._count._all ?? 0;

  const ranked = rankCandidates(
    endpoints.map((e) => {
      const allowed = Array.isArray(e.allowedPaths) ? (e.allowedPaths as string[]) : [];
      const conflicts = activeClaims.filter((s) => {
        const paths = Array.isArray(s.lease.declaredPaths)
          ? (s.lease.declaredPaths as string[])
          : [];
        return paths.some((p) => allowed.some((a) => pathsOverlap(p, a)));
      }).length;

      return {
        endpointId: e.id,
        toolType: e.toolType,
        capability: e.capability,
        online: e.status === "ONLINE" && !e.device.revokedAt,
        activeSessions: countOf(activeRows, e.id),
        allowedPaths: allowed,
        submitted: countOf(submittedRows, e.id),
        failed: countOf(failedRows, e.id),
        conflicts,
      };
    }),
    { scope: task.scope }
  );

  const dispatchOptions = ranked
    .map((r) => {
      const e = endpoints.find((x) => x.id === r.endpointId);
      if (!e) return null;
      return {
        id: e.id,
        tool: e.toolType,
        version: e.toolVersion,
        capability: e.capability,
        owner: e.device.user.name,
        note: e.capabilityNote,
        score: r.score,
        usable: r.usable,
        reasons: r.reasons,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return { endpoints, activeLease, dispatchOptions };
}
