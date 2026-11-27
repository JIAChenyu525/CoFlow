import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { buildSteps, progressOf } from "@/lib/onboarding";
import { CopyButton } from "@/components/copy-button";
import { Progress } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "15 分钟上手 · CoFlow" };

export default async function StartPage() {
  const user = await requireUser();

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    select: { projectId: true },
  });
  const projectIds = memberships.map((m) => m.projectId);

  const [devices, endpointsWithPaths, preparedTasks, sessions, completedTasks, deliveredSessions] =
    await Promise.all([
      prisma.device.count({ where: { userId: user.id, revokedAt: null } }),
      prisma.agentEndpoint.count({
        where: {
          device: { userId: user.id, revokedAt: null },
          status: { not: "REVOKED" },
          NOT: { allowedPaths: { equals: [] } },
        },
      }),
      prisma.task.count({
        where: {
          projectId: { in: projectIds },
          status: { in: ["READY", "IN_PROGRESS", "IN_REVIEW", "DONE"] },
        },
      }),
      prisma.agentSession.count({
        where: { task: { projectId: { in: projectIds } } },
      }),
      // 只算「与你相关」的完成：你负责或你验收
      prisma.task.count({
        where: {
          projectId: { in: projectIds },
          status: "DONE",
          OR: [{ assigneeId: user.id }, { reviewerId: user.id }],
        },
      }),
      prisma.agentSession.count({
        where: { endpoint: { device: { userId: user.id } }, status: "SUBMITTED" },
      }),
    ]);

  const steps = buildSteps({
    projects: projectIds.length,
    devices,
    endpointsWithPaths,
    preparedTasks,
    sessions,
    completedTasks,
    deliveredSessions,
  });
  const progress = progressOf(steps);
  const allDone = progress.done === progress.total;

  return (
    <main className="mx-auto max-w-[1180px] px-5 pb-20 pt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label">Getting started</div>
          <h1 className="mt-1.5 text-[24px] font-semibold tracking-tight">15 分钟跑通第一个闭环</h1>
          <p className="mt-1 max-w-[62ch] text-[13px] leading-relaxed text-[var(--muted)]">
            五步。每步的完成状态来自系统真实数据，不是教程里的打勾。
          </p>
        </div>
        <div className="text-right">
          <div className="mono text-[20px] font-semibold">
            {progress.done}
            <span className="text-[13px] text-[var(--muted)]"> / {progress.total}</span>
          </div>
          <div className="text-[11px] text-[var(--muted)]">已完成</div>
        </div>
      </div>

      <div className="mt-4">
        <Progress value={progress.percent} height={5} />
      </div>

      {allDone && (
        <div className="mt-5 rounded-[10px] border border-[var(--green)]/30 bg-[var(--green-soft)]/50 px-4 py-3">
          <div className="text-[13px] font-semibold text-[var(--green)]">闭环已经跑通</div>
          <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--ink-2)]">
            目标 → 任务 → 上下文 → 执行 → 证据 → 验收，这条链路已经完整走了一遍。
            接下来真正要看的是：它有没有减少你们的返工。
          </p>
          <Link href="/" className="btn btn-sm btn-primary mt-2">
            回到项目大厅
          </Link>
        </div>
      )}

      {progress.next && (
        <div className="mt-5 flex items-center gap-2 rounded-[10px] border border-[var(--accent)]/30 bg-[var(--accent-soft)]/40 px-4 py-2.5">
          <span className="pill pill--accent">下一步</span>
          <span className="text-[12.5px] font-medium">{progress.next.title}</span>
          <span className="text-[11.5px] text-[var(--muted)]">约 {progress.next.minutes} 分钟</span>
          {progress.next.href && (
            <Link href={progress.next.href} className="btn btn-xs btn-primary ml-auto">
              {progress.next.action}
            </Link>
          )}
        </div>
      )}

      <ol className="mt-5 space-y-2.5">
        {steps.map((s, i) => (
          <li
            key={s.id}
            className={`card flex gap-3 p-4 ${s.done ? "opacity-70" : ""}`}
          >
            <span
              className={`mono mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                s.done
                  ? "border-[var(--green)] bg-[var(--green-soft)] text-[var(--green)]"
                  : "border-[var(--line-strong)] text-[var(--muted)]"
              }`}
            >
              {s.done ? "✓" : i + 1}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-[13.5px] font-semibold ${s.done ? "line-through decoration-[var(--line-strong)]" : ""}`}>
                  {s.title}
                </span>
                <span className="tag">{s.minutes} 分钟</span>
                {s.done && <span className="text-[10.5px] text-[var(--green)]">已完成</span>}
              </div>

              <p className="mt-1 text-[12px] leading-relaxed text-[var(--ink-2)]">{s.desc}</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--muted)]">
                为什么：{s.why}
              </p>

              {s.command && (
                <div className="mt-2 flex items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-2 py-1.5">
                  <code className="mono flex-1 truncate text-[11px] text-[var(--ink-2)]">{s.command}</code>
                  <CopyButton text={s.command} />
                </div>
              )}

              {s.note && <p className="mt-1.5 text-[10.5px] text-[var(--faint)]">{s.note}</p>}

              {!s.done && s.href && (
                <Link href={s.href} className="btn btn-sm mt-2">
                  {s.action}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>

      <section className="mt-8 card-quiet p-4">
        <div className="label">如果卡住了</div>
        <div className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-[var(--ink-2)]">
          <p>
            · 连接器连不上：先跑 <code className="mono text-[11px]">coflow doctor</code>
            ，它会告诉你缺什么能力。
          </p>
          <p>
            · 任务移不到「已就绪」：说明输入材料或验收标准还空着，补上再试。
          </p>
          <p>
            · 派发按钮不出现：任务必须先是「已就绪」，且项目里要有可用端点。
          </p>
        </div>
      </section>
    </main>
  );
}
