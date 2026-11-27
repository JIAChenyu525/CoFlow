import { getDevice, unauthorized } from "@/lib/device-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const device = await getDevice(req);
  if (!device) return unauthorized();

  return Response.json({
    device: {
      id: device.id,
      name: device.name,
      os: device.os,
      last_seen_at: device.lastSeenAt,
    },
    user: device.user,
    // 用户在网页上选定的"我的助手"；连接器据此决定用哪个工具回答
    preferred_endpoint_id: device.user.preferredEndpointId ?? null,
    endpoints: device.endpoints.map((e) => ({
      id: e.id,
      tool: e.toolType,
      version: e.toolVersion,
      capability: e.capability,
      capability_note: e.capabilityNote,
      headless_ok: e.headlessOk,
      status: e.status,
      allowed_paths: e.allowedPaths,
    })),
  });
}
