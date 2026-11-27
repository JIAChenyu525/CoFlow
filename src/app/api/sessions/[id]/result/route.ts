import { prisma } from "@/lib/db";
import { getDevice, unauthorized } from "@/lib/device-auth";
import { appendEvent } from "@/lib/events";
import type { ArtifactType } from "@prisma/client";

export const dynamic = "force-dynamic";

const STALE_MS = 5 * 60 * 1000;
const KINDS: ArtifactType[] = ["COMMIT", "BUILD", "DOC", "DESIGN", "IMAGE", "DATA", "TEST_REPORT", "LINK", "NOTE"];

type ArtifactIn = { kind?: string; title?: string; location?: string; version?: string; note?: string };
type CheckIn = { name?: string; command?: string; exit_code?: number; output_tail?: string };

/**
 * 结果回传。注意三件事：
 * 1. 会话必须还活着（心跳未过期），过期租约不能交作业
 * 2. 产物由服务端落库，不信任 Agent 的口头「已完成」
 * 3. 任务只走到「待验收」，通过验收仍然只能是人
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
    include: { lease: true, task: true, endpoint: true },
  });
  if (!session) return Response.json({ error: "session_not_found" }, { status: 404 });

  if (!device.endpoints.some((e) => e.id === session.endpointId)) {
    return Response.json({ error: "session_not_yours" }, { status: 403 });
  }
  if (session.status !== "ACTIVE") {
    return Response.json({ error: "session_closed", status: session.status }, { status: 409 });
  }
  if (Date.now() - session.lastHeartbeatAt.getTime() > STALE_MS) {
    return Response.json(
      { error: "session_stale", detail: "心跳已超过 5 分钟，请重新领取任务" },
      { status: 409 }
    );
  }
  if (session.lease.status !== "ACTIVE") {
    return Response.json({ error: "lease_not_active", status: session.lease.status }, { status: 409 });
  }

  let body: {
    summary?: string;
    completed?: string[];
    incomplete?: string[];
    artifacts?: ArtifactIn[];
    checks?: CheckIn[];
    impacts?: string[];
    unresolved?: string[];
    suggested_status?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const artifacts = (body.artifacts ?? []).filter(
    (a) => a.title && a.location && KINDS.includes(a.kind as ArtifactType)
  );
  if (artifacts.length === 0) {
    return Response.json(
      { error: "no_artifacts", detail: "至少要有一项可定位的产物；没有产物请提交 NOTE 说明" },
      { status: 422 }
    );
  }

  const summary = (body.summary ?? "").slice(0, 2000);
  const checks = (body.checks ?? []).slice(0, 20);

  const result = await prisma.$transaction(async (tx) => {
    const created = [];
    for (const a of artifacts) {
      const artifact = await tx.artifact.create({
        data: {
          projectId: session.task.projectId,
          taskId: session.taskId,
          type: a.kind as ArtifactType,
          title: a.title!.slice(0, 120),
          location: a.location!.slice(0, 500),
          version: (a.version ?? "v1").slice(0, 20),
          note: (a.note ?? "").slice(0, 1000),
          submittedById: device.userId,
        },
      });
      created.push(artifact);

      await appendEvent(tx, {
        projectId: session.task.projectId,
        type: "artifact.submitted",
        actorType: "AGENT_SESSION",
        actorId: session.id,
        subjectType: "artifact",
        subjectId: artifact.id,
        payload: {
          taskId: session.taskId,
          artifactType: artifact.type,
          title: artifact.title,
          location: artifact.location,
          via: "connector",
        },
      });
    }

    // 检查结果的退出码不进入「事实」的判断，只是证据，供人参考
    const checkSummary = checks
      .map((c) => `${c.name ?? "check"}: exit ${c.exit_code ?? "?"}`)
      .join("；");

    await tx.message.create({
      data: {
        projectId: session.task.projectId,
        taskId: session.taskId,
        channel: "general",
        type: "ARTIFACT_SUBMIT",
        authorId: device.userId,
        body: [
          summary || `Agent 提交了 ${created.length} 项产物`,
          checkSummary && `检查：${checkSummary}`,
          (body.unresolved ?? []).length > 0 && `未解决：${body.unresolved!.join("；")}`,
        ]
          .filter(Boolean)
          .join("\n"),
        refType: "TASK",
        refId: session.taskId,
      },
    });

    const taskStatus = session.task.status;
    if (taskStatus === "IN_PROGRESS") {
      await tx.task.update({
        where: { id: session.taskId },
        data: { status: "IN_REVIEW", version: { increment: 1 } },
      });
      await appendEvent(tx, {
        projectId: session.task.projectId,
        type: "task.status_changed",
        actorType: "AGENT_SESSION",
        actorId: session.id,
        subjectType: "task",
        subjectId: session.taskId,
        payload: { from: "IN_PROGRESS", to: "IN_REVIEW", via: "agent.result" },
      });
    }

    await tx.agentSession.update({
      where: { id: session.id },
      data: { status: "SUBMITTED", endedAt: new Date() },
    });
    await tx.taskLease.update({
      where: { id: session.leaseId },
      data: { status: "SUBMITTED", submittedAt: new Date() },
    });

    await appendEvent(tx, {
      projectId: session.task.projectId,
      type: "agent.session_ended",
      actorType: "AGENT_SESSION",
      actorId: session.id,
      subjectType: "session",
      subjectId: session.id,
      payload: {
        outcome: "submitted",
        artifacts: created.length,
        checks: checks.length,
        suggestedStatus: body.suggested_status ?? null,
        incomplete: body.incomplete ?? [],
        impacts: body.impacts ?? [],
      },
    });

    return { created, taskStatus };
  });

  return Response.json({
    ok: true,
    artifacts: result.created.length,
    task_status: result.taskStatus === "IN_PROGRESS" ? "IN_REVIEW" : result.taskStatus,
    note: "任务已进入待验收；通过与否由人决定",
  });
}
