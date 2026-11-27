import { prisma } from "@/lib/db";
import { getDevice, unauthorized } from "@/lib/device-auth";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const MAX_BATCH = 50;
/** Agent 只能写自己视角的事件，碰不到任务、决策、验收 */
const ALLOWED_PREFIX = "agent.";

type Incoming = {
  event_id?: string;
  type?: string;
  subject_type?: string;
  subject_id?: string;
  payload?: Record<string, unknown>;
};

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

  const owned = device.endpoints.some((e) => e.id === session.endpointId);
  if (!owned) return Response.json({ error: "session_not_yours" }, { status: 403 });
  if (session.status !== "ACTIVE") {
    return Response.json({ error: "session_closed" }, { status: 409 });
  }

  let body: { events?: Incoming[] } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const events = Array.isArray(body.events) ? body.events.slice(0, MAX_BATCH) : [];
  if (events.length === 0) return Response.json({ results: [] });

  const results: { event_id: string | null; status: string; reason?: string }[] = [];

  for (const e of events) {
    const eventId = typeof e.event_id === "string" ? e.event_id.slice(0, 100) : null;
    if (!eventId) {
      results.push({ event_id: null, status: "rejected", reason: "event_id_required" });
      continue;
    }
    if (!e.type || !e.type.startsWith(ALLOWED_PREFIX)) {
      results.push({ event_id: eventId, status: "rejected", reason: "type_not_allowed" });
      continue;
    }

    try {
      await prisma.projectEvent.create({
        data: {
          projectId: session.task.projectId,
          clientEventId: eventId,
          sessionId: session.id,
          type: e.type,
          actorType: "AGENT_SESSION",
          actorId: session.id,
          subjectType: e.subject_type ?? "task",
          subjectId: e.subject_id ?? session.taskId,
          payload: (e.payload ?? {}) as Prisma.InputJsonValue,
          source: "connector",
        },
      });
      results.push({ event_id: eventId, status: "accepted" });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "P2002") {
        results.push({ event_id: eventId, status: "duplicate" });
      } else {
        results.push({ event_id: eventId, status: "rejected", reason: "server_error" });
      }
    }
  }

  return Response.json({ results });
}
