import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { loadContext } from "@/lib/context-data";
import { appendEvent } from "@/lib/events";
import { rateLimit } from "@/lib/rate-limit";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const LEASE_TTL_MS = 15 * 60 * 1000;

/**
 * 人在网页上把任务派给某个端点。
 * 这一步是人显式动作——没有任何后台自动派发（设计 §3.2）。
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const rl = rateLimit(`lease:${user.id}`, 30, 60_000);
  if (!rl.ok) {
    return Response.json({ error: "rate_limited", retry_after_ms: rl.retryAfterMs }, { status: 429 });
  }

  const { id: taskId } = await params;
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return Response.json({ error: "task_not_found" }, { status: 404 });

  const membership = await prisma.membership.findUnique({
    where: { projectId_userId: { projectId: task.projectId, userId: user.id } },
  });
  if (!membership || membership.role === "OBSERVER") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  if (task.status !== "READY") {
    return Response.json(
      { error: "task_not_ready", detail: `任务当前是 ${task.status}，先移到「已就绪」再派发` },
      { status: 409 }
    );
  }

  let body: { endpointId?: string } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.endpointId) {
    return Response.json({ error: "endpoint_required" }, { status: 400 });
  }

  const endpoint = await prisma.agentEndpoint.findUnique({
    where: { id: body.endpointId },
    include: { device: true },
  });
  if (!endpoint || endpoint.status === "REVOKED" || endpoint.device.revokedAt) {
    return Response.json({ error: "endpoint_unavailable" }, { status: 404 });
  }

  // Agent 权限不得超过所属成员：端点的主人必须是这个项目的成员
  const ownerMembership = await prisma.membership.findUnique({
    where: { projectId_userId: { projectId: task.projectId, userId: endpoint.device.userId } },
  });
  if (!ownerMembership) {
    return Response.json({ error: "agent_owner_not_member" }, { status: 403 });
  }

  const existing = await prisma.taskLease.findFirst({
    where: { taskId, status: { in: ["OFFERED", "ACCEPTED", "ACTIVE"] } },
  });
  if (existing) {
    return Response.json({ error: "lease_conflict", lease_id: existing.id }, { status: 409 });
  }

  const loaded = await loadContext(taskId, { endpointId: endpoint.id });
  if (!loaded) return Response.json({ error: "context_build_failed" }, { status: 500 });
  if (loaded.overBudget) {
    return Response.json({ error: "context_over_budget" }, { status: 409 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const snapshot = await tx.contextSnapshot.create({
      data: {
        taskId,
        endpointId: endpoint.id,
        hash: loaded.hash,
        version: (await tx.contextSnapshot.count({ where: { taskId } })) + 1,
        tokens: loaded.tokens,
        packageJson: loaded.pkg as unknown as Prisma.InputJsonValue,
      },
    });

    // 首次派发即完成项目授权
    if (!endpoint.projectId) {
      await tx.agentEndpoint.update({
        where: { id: endpoint.id },
        data: { projectId: task.projectId },
      });
    }

    const lease = await tx.taskLease.create({
      data: {
        taskId,
        endpointId: endpoint.id,
        contextSnapshotId: snapshot.id,
        status: "OFFERED",
        expiresAt: new Date(Date.now() + LEASE_TTL_MS),
      },
    });

    await appendEvent(tx, {
      projectId: task.projectId,
      type: "agent.lease_offered",
      actorId: user.id,
      subjectType: "task",
      subjectId: taskId,
      payload: {
        leaseId: lease.id,
        endpointId: endpoint.id,
        tool: endpoint.toolType,
        contextHash: loaded.hash,
        tokens: loaded.tokens,
      },
    });

    return { lease, snapshot };
  });

  return Response.json({
    ok: true,
    lease_id: result.lease.id,
    context_hash: loaded.hash,
    tokens: loaded.tokens,
    expires_at: result.lease.expiresAt,
  });
}
