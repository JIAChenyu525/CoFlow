import { prisma } from "@/lib/db";
import { getDevice, unauthorized } from "@/lib/device-auth";
import { appendEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

/** 连接器把助手的回答写回频道：以「某人的助手」身份发言 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const device = await getDevice(req);
  if (!device) return unauthorized();

  const { id } = await params;
  const request = await prisma.assistantRequest.findUnique({ where: { id } });
  if (!request || request.userId !== device.user.id) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  if (request.status === "DONE") {
    return Response.json({ ok: true, duplicated: true });
  }

  let payload: { body?: string } = {};
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const body = (payload.body ?? "").trim().slice(0, 8000);
  if (!body) return Response.json({ error: "empty_body" }, { status: 400 });

  const message = await prisma.$transaction(async (tx) => {
    const msg = await tx.message.create({
      data: {
        projectId: request.projectId,
        channel: request.channel,
        type: "AGENT_REPORT",
        body,
        authorId: request.userId,
        authorType: "AGENT",
        agentOwnerId: request.userId,
      },
    });
    await tx.assistantRequest.update({
      where: { id: request.id },
      data: { status: "DONE", reply: body, finishedAt: new Date() },
    });
    await appendEvent(tx, {
      projectId: request.projectId,
      type: "message.posted",
      actorType: "AGENT_SESSION",
      actorId: request.userId,
      subjectType: "message",
      subjectId: msg.id,
      payload: { channel: request.channel, assistant: true, requestId: request.id },
    });
    return msg;
  });

  return Response.json({ ok: true, messageId: message.id });
}
