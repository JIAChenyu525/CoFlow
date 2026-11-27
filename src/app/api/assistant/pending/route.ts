import { prisma } from "@/lib/db";
import { getDevice, unauthorized } from "@/lib/device-auth";
import { buildProjectMemory } from "@/lib/assistant-memory";

export const dynamic = "force-dynamic";

/**
 * 连接器领取「属于本人」的助手请求。
 *
 * 只查 device.user 名下的请求——这是"每个人自己专属"的技术保证：
 * 别人的请求不会下发到你这台机器上。
 */
export async function GET(req: Request) {
  const device = await getDevice(req);
  if (!device) return unauthorized();

  const url = new URL(req.url);
  const waitMs = Math.min(20_000, Number(url.searchParams.get("wait") ?? 0) * 1000);
  const deadline = Date.now() + waitMs;

  while (true) {
    const pending = await prisma.assistantRequest.findMany({
      where: { userId: device.user.id, status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: 3,
      include: { project: { select: { id: true, name: true, key: true } } },
    });

    const requests = [];
    const memoryCache = new Map<string, Awaited<ReturnType<typeof buildProjectMemory>>>();
    for (const item of pending) {
      // 抢占：两个人同时轮询也只有一个能改成功
      const claimed = await prisma.assistantRequest.updateMany({
        where: { id: item.id, status: "PENDING" },
        data: { status: "RUNNING", claimedAt: new Date() },
      });
      if (claimed.count === 0) continue;

      const history = await prisma.message.findMany({
        where: { projectId: item.projectId, channel: item.channel },
        orderBy: { createdAt: "desc" },
        take: 15,
        include: { author: { select: { name: true } } },
      });

      // 同一次领取里，同一项目只构建一次记忆；所有人拿到的是同一份
      if (!memoryCache.has(item.projectId)) {
        memoryCache.set(item.projectId, await buildProjectMemory(item.projectId));
      }
      const memory = memoryCache.get(item.projectId);

      requests.push({
        id: item.id,
        projectId: item.projectId,
        projectName: item.project.name,
        projectKey: item.project.key,
        channel: item.channel,
        prompt: item.prompt,
        owner: device.user.name,
        memory: memory ? { hash: memory.hash, text: memory.text } : null,
        context: history
          .reverse()
          .map((m) => ({
            author:
              m.authorType === "AGENT" ? `${m.author.name} 的助手` : m.author.name,
            body: m.body,
            at: m.createdAt.toISOString(),
          })),
      });
    }

    if (requests.length > 0) return Response.json({ requests });
    if (Date.now() >= deadline) return Response.json({ requests: [] });
    await new Promise((r) => setTimeout(r, 3000));
  }
}
