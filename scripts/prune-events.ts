/**
 * 数据保留：清理低价值的过程事件与过期上下文快照。
 *
 * 保留：决策、产物、验收、任务状态变更、章程变更、Agent 会话起止
 * 清理：项目消息、Agent 进度类事件；未被租约或会话引用的旧快照
 *
 * 用法：
 *   pnpm db:prune                       # 预演（默认 90 天），只看不删
 *   pnpm db:prune --days=30             # 改保留天数
 *   pnpm db:prune --apply               # 真正执行
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const PRUNABLE = ["message.posted", "agent.progress"];
const PREVIEW = "\n当前是预演模式。确认无误后加 --apply 执行删除。";

function arg(name: string) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}`));
  if (!hit) return null;
  const [, value] = hit.split("=");
  return value ?? "";
}

async function main() {
  const days = Number(arg("days") ?? 90);
  const apply = process.argv.includes("--apply");

  if (!Number.isFinite(days) || days < 1) {
    console.error("--days 需要是大于 0 的整数");
    process.exit(1);
  }

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const cutoffLabel = cutoff.toISOString().slice(0, 10);

  // ── 事件 ──
  const total = await prisma.projectEvent.count();
  const events = await prisma.projectEvent.count({
    where: { type: { in: PRUNABLE }, occurredAt: { lt: cutoff } },
  });

  console.log(`事件总数 ${total}`);
  console.log(`早于 ${cutoffLabel} 的可清理事件 ${events} 条（仅消息与 Agent 进度）`);

  if (apply && events > 0) {
    const res = await prisma.projectEvent.deleteMany({
      where: { type: { in: PRUNABLE }, occurredAt: { lt: cutoff } },
    });
    console.log(`已删除 ${res.count} 条事件`);
  }

  // ── 上下文快照 ──
  const old = await prisma.contextSnapshot.findMany({
    where: { createdAt: { lt: cutoff } },
    select: { id: true },
  });
  const ids = old.map((s) => s.id);

  if (ids.length === 0) {
    console.log("没有超过保留期的上下文快照");
  } else {
    const [leaseRefs, sessionRefs] = await Promise.all([
      prisma.taskLease.findMany({
        where: { contextSnapshotId: { in: ids } },
        select: { contextSnapshotId: true },
      }),
      prisma.agentSession.findMany({
        where: { contextSnapshotId: { in: ids } },
        select: { contextSnapshotId: true },
      }),
    ]);

    const referenced = new Set([
      ...leaseRefs.map((r) => r.contextSnapshotId),
      ...sessionRefs.map((r) => r.contextSnapshotId),
    ]);
    const deletable = ids.filter((id) => !referenced.has(id));

    console.log(
      `上下文快照：超过保留期 ${ids.length} 份，其中仍被租约或会话引用 ${referenced.size} 份予以保留，可清理 ${deletable.length} 份`
    );

    if (apply && deletable.length > 0) {
      const res = await prisma.contextSnapshot.deleteMany({
        where: { id: { in: deletable } },
      });
      console.log(`已删除 ${res.count} 份上下文快照`);
    }
  }

  if (!apply) console.log(PREVIEW);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
