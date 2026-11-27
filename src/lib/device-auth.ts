import "server-only";
import { prisma } from "./db";
import { hashDeviceToken } from "./pairing";

/**
 * 设备令牌鉴权。
 * 与用户会话是两条独立通道：设备令牌只能做租约/上下文/事件/结果这四类事，
 * 不能改目标、不能做验收结论（§3.3 scope）。
 */
export async function getDevice(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;

  const device = await prisma.device.findUnique({
    where: { tokenHash: hashDeviceToken(token) },
    include: {
      user: { select: { id: true, name: true, preferredEndpointId: true } },
      endpoints: { where: { status: { not: "REVOKED" } } },
    },
  });

  if (!device || device.revokedAt) return null;

  await prisma.device.update({
    where: { id: device.id },
    data: { lastSeenAt: new Date() },
  });

  return device;
}

export function unauthorized() {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}
