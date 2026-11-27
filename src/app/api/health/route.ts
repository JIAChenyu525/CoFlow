import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * 健康检查：运维用来判断服务与数据库是否可用。
 * 数据库不通时返回 503，便于反向代理或监控直接摘流量。
 */
export async function GET() {
  const started = Date.now();
  let db: "ok" | "error" = "ok";
  let detail: string | null = null;

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    db = "error";
    detail = err instanceof Error ? err.message.slice(0, 200) : "unknown";
  }

  const body = {
    ok: db === "ok",
    db,
    detail,
    version: "V1.0",
    uptime_s: Math.round(process.uptime()),
    latency_ms: Date.now() - started,
    checked_at: new Date().toISOString(),
  };

  return Response.json(body, { status: body.ok ? 200 : 503 });
}
