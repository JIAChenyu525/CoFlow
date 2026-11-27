import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { hashDeviceToken, newDeviceToken } from "@/lib/pairing";
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
 * 连接器轮询换取设备令牌。
 * 只有用户在网页上确认（APPROVED）之后才会签发，且只签发一次。
 */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`pair:token:${ip}`, 120, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: { device_code?: string; tool?: ToolProfile; tools?: ToolProfile[] } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const deviceCode = body.device_code;
  if (!deviceCode) {
    return NextResponse.json({ error: "device_code_required" }, { status: 400 });
  }

  const pairing = await prisma.devicePairing.findUnique({ where: { deviceCode } });
  if (!pairing) {
    return NextResponse.json({ error: "invalid_device_code" }, { status: 400 });
  }

  if (pairing.expiresAt < new Date()) {
    if (pairing.status !== "EXPIRED") {
      await prisma.devicePairing.update({
        where: { id: pairing.id },
        data: { status: "EXPIRED" },
      });
    }
    return NextResponse.json({ error: "expired_token" }, { status: 410 });
  }

  if (pairing.status === "PENDING") {
    return NextResponse.json({ error: "authorization_pending" }, { status: 400 });
  }

  if (pairing.status === "CONSUMED") {
    return NextResponse.json({ error: "already_used" }, { status: 400 });
  }

  if (!pairing.userId) {
    return NextResponse.json({ error: "not_approved" }, { status: 400 });
  }

  const raw = newDeviceToken();

  const result = await prisma.$transaction(async (tx) => {
    const device = await tx.device.create({
      data: {
        userId: pairing.userId!,
        name: pairing.name,
        os: pairing.os,
        tokenHash: hashDeviceToken(raw),
        lastSeenAt: new Date(),
      },
    });

    // 一台设备上检测到几个工具就登记几个端点，由用户在网页上挑一个当助手
    const incoming =
      Array.isArray(body.tools) && body.tools.length > 0
        ? body.tools
        : body.tool?.toolType
          ? [body.tool]
          : [];

    const seen = new Set<string>();
    const endpoints = [];
    for (const tool of incoming) {
      if (!tool?.toolType) continue;
      const toolType = tool.toolType.slice(0, 60);
      if (seen.has(toolType)) continue;
      seen.add(toolType);

      const capability = (
        ["AUTO", "SEMI", "MANUAL"].includes(tool.capability ?? "")
          ? tool.capability
          : "MANUAL"
      ) as Capability;

      endpoints.push(
        await tx.agentEndpoint.create({
          data: {
            deviceId: device.id,
            toolType,
            toolVersion: (tool.toolVersion ?? "unknown").slice(0, 40),
            capability,
            headlessOk: !!tool.headlessOk,
            capabilityNote: tool.capabilityNote
              ? String(tool.capabilityNote).slice(0, 200)
              : null,
            status: "ONLINE",
            lastSeenAt: new Date(),
          },
        })
      );
    }

    await tx.devicePairing.update({
      where: { id: pairing.id },
      data: { status: "CONSUMED", consumedAt: new Date() },
    });

    const user = await tx.user.findUnique({
      where: { id: pairing.userId! },
      select: { id: true, name: true },
    });

    return { device, endpoints, user };
  });

  return NextResponse.json({
    device_token: raw, // 只返回这一次
    device_id: result.device.id,
    endpoint_id: result.endpoints[0]?.id ?? null,
    endpoint_ids: result.endpoints.map((e) => e.id),
    user: result.user,
    scopes: ["lease.accept", "context.read", "event.write", "result.submit"],
  });
}
