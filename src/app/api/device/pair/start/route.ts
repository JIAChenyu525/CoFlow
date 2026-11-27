import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import {
  newDeviceCode,
  newUserCode,
  PAIRING_INTERVAL_S,
  PAIRING_TTL_MS,
} from "@/lib/pairing";

export const dynamic = "force-dynamic";

function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

/**
 * 连接器发起配对。无鉴权（连接器还没有身份），靠 IP 限流兜底。
 * 返回的 device_code 是高熵密钥，user_code 才是给人念/敲的。
 */
export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = rateLimit(`pair:start:${ip}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limited", retry_after_ms: rl.retryAfterMs },
      { status: 429 }
    );
  }

  let body: { name?: string; os?: string } = {};
  try {
    body = await req.json();
  } catch {
    // 允许空 body，用默认值
  }

  const name = (body.name ?? "未命名设备").toString().slice(0, 60);
  const os = (body.os ?? "unknown").toString().slice(0, 40);
  const expiresAt = new Date(Date.now() + PAIRING_TTL_MS);

  // user_code 撞车的概率极低，但撞了就重来
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const pairing = await prisma.devicePairing.create({
        data: {
          deviceCode: newDeviceCode(),
          userCode: newUserCode(),
          name,
          os,
          expiresAt,
          interval: PAIRING_INTERVAL_S,
        },
      });

      return NextResponse.json({
        device_code: pairing.deviceCode,
        user_code: pairing.userCode,
        expires_in: Math.floor(PAIRING_TTL_MS / 1000),
        interval: pairing.interval,
        verification_url: "/agent",
      });
    } catch {
      continue;
    }
  }

  return NextResponse.json({ error: "code_generation_failed" }, { status: 500 });
}
