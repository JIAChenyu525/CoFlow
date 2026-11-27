import { prisma } from "@/lib/db";
import { getDevice, unauthorized } from "@/lib/device-auth";
import { appendEvent } from "@/lib/events";
import { findConflicts, modeFor, type Claim } from "@/lib/locks";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** 租约已被别的连接器抢先接受 */
class LeaseRaceError extends Error {}

/** 连接器接受租约：建立会话，任务从「已就绪」进入「进行中」。 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const device = await getDevice(req);
  if (!device) return unauthorized();

  const rl = rateLimit(`accept:${device.id}`, 60, 60_000);
  if (!rl.ok) {
    return Response.json({ error: "rate_limited", retry_after_ms: rl.retryAfterMs }, { status: 429 });
  }

  const { id } = await params;
  const lease = await prisma.taskLease.findUnique({
    where: { id },
    include: { task: true },
  });
  if (!lease) return Response.json({ error: "lease_not_found" }, { status: 404 });

  const owned = device.endpoints.some((e) => e.id === lease.endpointId);
  if (!owned) return Response.json({ error: "lease_not_yours" }, { status: 403 });

  if (lease.status === "EXPIRED" || lease.expiresAt < new Date()) {
    if (lease.status !== "EXPIRED") {
      await prisma.taskLease.update({ where: { id }, data: { status: "EXPIRED" } });
    }
    return Response.json({ error: "lease_expired" }, { status: 409 });
  }
  if (lease.status !== "OFFERED") {
    return Response.json({ error: "lease_not_offered", status: lease.status }, { status: 409 });
  }

  const snapshot = await prisma.contextSnapshot.findUnique({
    where: { id: lease.contextSnapshotId },
  });
  if (!snapshot) return Response.json({ error: "context_missing" }, { status: 500 });

  let body: { declaredPaths?: string[] } = {};
  try {
    body = await req.json();
  } catch {
    // 允许空 body
  }
  const declared = Array.isArray(body.declaredPaths) ? body.declaredPaths.slice(0, 50) : [];

  // 工作声明冲突检查：同一项目下其它正在执行的会话
  const activeSessions = await prisma.agentSession.findMany({
    where: { task: { projectId: lease.task.projectId }, status: "ACTIVE" },
    include: { lease: true, task: { select: { title: true } } },
  });

  const claims: Claim[] = activeSessions.map((s) => ({
    id: s.id,
    label: s.task.title,
    paths: Array.isArray(s.lease.declaredPaths) ? (s.lease.declaredPaths as string[]) : [],
  }));

  const mode = modeFor(declared);
  const conflicts = findConflicts(declared, claims);

  // 独占资源重叠：直接拒绝，不进入执行
  if (mode === "exclusive" && conflicts.length > 0) {
    return Response.json(
      {
        error: "path_locked",
        mode,
        conflicts,
        detail: "声明了独占资源，且与正在执行的会话重叠",
      },
      { status: 409 }
    );
  }

  let session;
  try {
    session = await prisma.$transaction(async (tx) => {
    // 并发保护：两个连接器可能同时接受同一租约。
    // 用条件更新抢占，抢不到的直接失败，而不是各自建一个会话。
    const claimed = await tx.taskLease.updateMany({
      where: { id, status: "OFFERED" },
      data: { status: "ACTIVE", acceptedAt: new Date(), declaredPaths: declared },
    });
    if (claimed.count === 0) {
      throw new LeaseRaceError();
    }

    const s = await tx.agentSession.create({
      data: {
        leaseId: lease.id,
        endpointId: lease.endpointId,
        taskId: lease.taskId,
        contextSnapshotId: snapshot.id,
        contextHash: snapshot.hash,
        status: "ACTIVE",
      },
    });

    // 任务在这里才真正进入进行中——租约下发不等于开工
    if (lease.task.status === "READY") {
      await tx.task.update({
        where: { id: lease.taskId },
        data: { status: "IN_PROGRESS", version: { increment: 1 } },
      });
      await appendEvent(tx, {
        projectId: lease.task.projectId,
        type: "task.status_changed",
        actorType: "AGENT_SESSION",
        actorId: s.id,
        subjectType: "task",
        subjectId: lease.taskId,
        payload: { from: "READY", to: "IN_PROGRESS", via: "agent.session_started" },
      });
    }

    await appendEvent(tx, {
      projectId: lease.task.projectId,
      type: "agent.session_started",
      actorType: "AGENT_SESSION",
      actorId: s.id,
      subjectType: "session",
      subjectId: s.id,
      payload: {
        leaseId: lease.id,
        endpointId: lease.endpointId,
        contextHash: snapshot.hash,
        declaredPaths: declared,
        lockMode: mode,
        conflicts: conflicts.length,
      },
    });

    return s;
    });
  } catch (err) {
    if (err instanceof LeaseRaceError) {
      return Response.json({ error: "lease_already_taken" }, { status: 409 });
    }
    throw err;
  }

  return Response.json({
    ok: true,
    session_id: session.id,
    task_id: lease.taskId,
    context_hash: snapshot.hash,
    context: snapshot.packageJson,
    lock_mode: mode,
    conflicts,
  });
}
