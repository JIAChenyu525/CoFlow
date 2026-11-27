import { prisma } from "@/lib/db";
import { getDevice, unauthorized } from "@/lib/device-auth";
import type { Capability } from "@prisma/client";

export const dynamic = "force-dynamic";

type ToolProfile = {
  toolType?: string;
  toolVersion?: string;
  capability?: string;
  headlessOk?: boolean;
  capabilityNote?: string | null;
};

/**
 * 重新扫描本机工具：把检测结果同步到已配对的设备上。
 *
 * 不重新配对、不换设备令牌，只按 toolType upsert 端点。
 * 这样用户多装了一个工具，跑一次 `coflow scan` 网页上就能看到并选择。
 */
export async function POST(req: Request) {
  const device = await getDevice(req);
  if (!device) return unauthorized();

  let body: { tools?: ToolProfile[] } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const incoming = (body.tools ?? []).filter((t) => t?.toolType);
  if (incoming.length === 0) {
    return Response.json({ ok: true, endpoints: [], note: "没有可登记的工具" });
  }

  const results: { toolType: string; id: string; created: boolean }[] = [];

  for (const tool of incoming) {
    const toolType = String(tool.toolType).slice(0, 60);
    const capability = (
      ["AUTO", "SEMI", "MANUAL"].includes(tool.capability ?? "") ? tool.capability : "MANUAL"
    ) as Capability;

    const existing = await prisma.agentEndpoint.findFirst({
      where: { deviceId: device.id, toolType, status: { not: "REVOKED" } },
    });

    if (existing) {
      await prisma.agentEndpoint.update({
        where: { id: existing.id },
        data: {
          toolVersion: (tool.toolVersion ?? "unknown").slice(0, 40),
          capability,
          headlessOk: !!tool.headlessOk,
          capabilityNote: tool.capabilityNote ? String(tool.capabilityNote).slice(0, 200) : null,
          status: "ONLINE",
          lastSeenAt: new Date(),
        },
      });
      results.push({ toolType, id: existing.id, created: false });
    } else {
      const created = await prisma.agentEndpoint.create({
        data: {
          deviceId: device.id,
          toolType,
          toolVersion: (tool.toolVersion ?? "unknown").slice(0, 40),
          capability,
          headlessOk: !!tool.headlessOk,
          capabilityNote: tool.capabilityNote ? String(tool.capabilityNote).slice(0, 200) : null,
          status: "ONLINE",
          lastSeenAt: new Date(),
        },
      });
      results.push({ toolType, id: created.id, created: true });
    }
  }

  return Response.json({ ok: true, endpoints: results });
}
