import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeUserCode } from "@/lib/pairing";

export const dynamic = "force-dynamic";

/**
 * 人在网页上确认配对。必须有真实会话——配对本质上是「把一台设备授权给这个账号」。
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const rl = rateLimit(`pair:approve:${user.id}`, 15, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: { user_code?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const code = normalizeUserCode(body.user_code ?? "");
  if (!code) {
    return NextResponse.json({ error: "invalid_format" }, { status: 400 });
  }

  const pairing = await prisma.devicePairing.findUnique({ where: { userCode: code } });
  if (!pairing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (pairing.expiresAt < new Date()) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }
  if (pairing.status !== "PENDING") {
    return NextResponse.json({ error: "already_handled" }, { status: 409 });
  }

  await prisma.devicePairing.update({
    where: { id: pairing.id },
    data: { status: "APPROVED", userId: user.id, approvedAt: new Date() },
  });

  return NextResponse.json({
    ok: true,
    device_name: pairing.name,
    os: pairing.os,
    expires_in: Math.max(0, Math.floor((pairing.expiresAt.getTime() - Date.now()) / 1000)),
  });
}
