import { prisma } from "@/lib/db";
import { getDevice, unauthorized } from "@/lib/device-auth";

export const dynamic = "force-dynamic";

/**
 * 连接器领取待处理的租约（长轮询）。
 *
 * 设计文档写的是 WSS 推送。这里先用长轮询，原因：Next 的 Route Handler 起不了
 * WebSocket 服务，真要 WSS 得换自定义 server，代价不成比例。
 * 长轮询对「断线重连 + 幂等」这两条退出标准没有影响，接口形状也保持可迁移。
 */
export async function GET(req: Request) {
  const device = await getDevice(req);
  if (!device) return unauthorized();
  if (device.endpoints.length === 0) {
    return Response.json({ leases: [], hint: "该设备还没有注册工具端点" });
  }

  const url = new URL(req.url);
  const waitMs = Math.min(25_000, Number(url.searchParams.get("wait") ?? 0) * 1000);
  const endpointIds = device.endpoints.map((e) => e.id);
  const deadline = Date.now() + waitMs;

  // 顺手把过期还没人领的租约标记掉
  await prisma.taskLease.updateMany({
    where: { endpointId: { in: endpointIds }, status: "OFFERED", expiresAt: { lt: new Date() } },
    data: { status: "EXPIRED" },
  });

  while (true) {
    const leases = await prisma.taskLease.findMany({
      where: {
        endpointId: { in: endpointIds },
        status: "OFFERED",
        expiresAt: { gt: new Date() },
      },
      include: {
        task: { select: { id: true, title: true, status: true, priority: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 5,
    });

    if (leases.length > 0 || Date.now() >= deadline) {
      return Response.json({
        leases: leases.map((l) => ({
          lease_id: l.id,
          task_id: l.task.id,
          title: l.task.title,
          priority: l.task.priority,
          expires_at: l.expiresAt,
          context_hash: undefined, // 接受后才给上下文，减少空转
        })),
      });
    }

    await new Promise((r) => setTimeout(r, 2000));
  }
}
