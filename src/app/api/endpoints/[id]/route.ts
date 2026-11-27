import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getDevice } from "@/lib/device-auth";

export const dynamic = "force-dynamic";

/**
 * 端点授权：允许访问哪些目录、上报能力等级。
 *
 * 两条合法身份：浏览器会话（人在网页上改）或设备令牌（连接器自己上报）。
 * 两者指的都是设备主人本人；项目管理员不能替别人改本地目录（§9.3）。
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const endpoint = await prisma.agentEndpoint.findUnique({
    where: { id },
    include: { device: true },
  });
  if (!endpoint) return Response.json({ error: "not_found" }, { status: 404 });

  const user = await getSessionUser();
  const device = user ? null : await getDevice(req);

  const ownsEndpoint = user
    ? endpoint.device.userId === user.id
    : device
      ? endpoint.deviceId === device.id
      : false;

  if (!ownsEndpoint) {
    return Response.json(
      { error: user || device ? "not_found" : "unauthenticated" },
      { status: user || device ? 404 : 401 }
    );
  }

  let body: {
    allowedPaths?: unknown;
    capability?: unknown;
    capabilityNote?: unknown;
    toolVersion?: unknown;
    headlessOk?: unknown;
  } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if (Array.isArray(body.allowedPaths)) {
    const paths = body.allowedPaths
      .filter((p): p is string => typeof p === "string")
      .map((p) => p.trim())
      .filter(Boolean)
      .slice(0, 20);
    data.allowedPaths = paths;
  }

  if (typeof body.capability === "string" && ["AUTO", "SEMI", "MANUAL"].includes(body.capability)) {
    data.capability = body.capability;
  }
  if (typeof body.capabilityNote === "string" || body.capabilityNote === null) {
    data.capabilityNote = body.capabilityNote ? String(body.capabilityNote).slice(0, 200) : null;
  }
  if (typeof body.toolVersion === "string") {
    data.toolVersion = body.toolVersion.slice(0, 40);
  }
  if (typeof body.headlessOk === "boolean") {
    data.headlessOk = body.headlessOk;
  }

  if (Object.keys(data).length === 0) {
    return Response.json({ error: "nothing_to_update" }, { status: 400 });
  }

  const updated = await prisma.agentEndpoint.update({ where: { id }, data });
  return Response.json({
    ok: true,
    endpoint: { id: updated.id, allowed_paths: updated.allowedPaths, capability: updated.capability },
  });
}
