import { prisma } from "@/lib/db";
import { getDevice, unauthorized } from "@/lib/device-auth";

export const dynamic = "force-dynamic";

/**
 * 心跳只更新会话行，不写事件流——它是状态不是事实。
 * 20 秒一条事件会淹没真正的事实记录。
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const device = await getDevice(req);
  if (!device) return unauthorized();

  const { id } = await params;
  const session = await prisma.agentSession.findUnique({ where: { id } });
  if (!session) return Response.json({ error: "session_not_found" }, { status: 404 });

  const owned = device.endpoints.some((e) => e.id === session.endpointId);
  if (!owned) return Response.json({ error: "session_not_yours" }, { status: 403 });
  if (session.status !== "ACTIVE") {
    return Response.json({ error: "session_closed", status: session.status }, { status: 409 });
  }

  const now = new Date();
  await prisma.agentSession.update({
    where: { id },
    data: { lastHeartbeatAt: now },
  });

  return Response.json({
    ok: true,
    server_time: now.toISOString(),
    stale_after_seconds: 90,
  });
}
