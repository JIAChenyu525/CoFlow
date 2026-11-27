import { prisma } from "@/lib/db";
import { getDevice, unauthorized } from "@/lib/device-auth";
import { appendEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

/**
 * 会话失败收尾。
 * 越界写入、工具崩溃、超时都走这里：租约作废、会话标记 FAILED，
 * 任务留在「进行中」等人工处理——不回退、不自动重试（设计 §13）。
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const device = await getDevice(req);
  if (!device) return unauthorized();

  const { id } = await params;
  const session = await prisma.agentSession.findUnique({
    where: { id },
    include: { task: { select: { projectId: true } } },
  });
  if (!session) return Response.json({ error: "session_not_found" }, { status: 404 });
  if (!device.endpoints.some((e) => e.id === session.endpointId)) {
    return Response.json({ error: "session_not_yours" }, { status: 403 });
  }
  if (session.status !== "ACTIVE") {
    return Response.json({ error: "session_closed", status: session.status }, { status: 409 });
  }

  let body: { reason?: string; details?: unknown } = {};
  try {
    body = await req.json();
  } catch {}

  const reason = (body.reason ?? "unknown").toString().slice(0, 200);

  await prisma.$transaction(async (tx) => {
    await tx.agentSession.update({
      where: { id },
      data: { status: "FAILED", endedAt: new Date() },
    });
    await tx.taskLease.update({
      where: { id: session.leaseId },
      data: { status: "REVOKED" },
    });
    await appendEvent(tx, {
      projectId: session.task.projectId,
      type: "agent.session_ended",
      actorType: "AGENT_SESSION",
      actorId: id,
      subjectType: "session",
      subjectId: id,
      payload: { outcome: "failed", reason, details: body.details ?? null },
    });
  });

  return Response.json({ ok: true, note: "任务仍在进行中，需要人工处理" });
}
