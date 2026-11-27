import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ARTIFACT_META } from "@/lib/constants";
import { Empty, formatTime } from "@/components/ui";
import { TaskStatusBadge } from "@/components/ds";

export const dynamic = "force-dynamic";

export default async function ArtifactsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  await requireUser();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      tasks: {
        where: { status: { in: ["IN_REVIEW", "DONE"] } },
        orderBy: { updatedAt: "desc" },
        include: {
          artifacts: { orderBy: { createdAt: "desc" }, include: { submittedBy: true } },
          reviews: { orderBy: { createdAt: "desc" }, include: { reviewer: true } },
          assignee: true,
        },
      },
      artifacts: {
        orderBy: { createdAt: "desc" },
        take: 80,
        include: { submittedBy: true, task: { select: { id: true, title: true } } },
      },
    },
  });
  if (!project) notFound();

  const inReview = project.tasks.filter((t) => t.status === "IN_REVIEW");
  const done = project.tasks.filter((t) => t.status === "DONE");

  return (
    <main className="px-5 py-6">
      <div className="label">Delivery</div>
      <h1 className="mt-1 text-[21px] font-semibold tracking-tight">产物与验收</h1>
      <p className="mt-1 max-w-[70ch] text-[12.5px] text-[var(--muted)]">
        验收页采用「标准 — 证据 — 结论」三栏：标准来自任务，证据来自产物，结论由具备验收权的人给出。
        自动检查可以提供证据，但不能替人下结论。
      </p>

      <section className="mt-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[14px] font-semibold">待验收 · {inReview.length}</h2>
          <span className="text-[11px] text-[var(--muted)]">完成状态不可由 Agent 自报</span>
        </div>

        <div className="mt-3 space-y-3">
          {inReview.length === 0 && (
            <Empty title="没有待验收任务" hint="任务提交验收后会出现在这里，等待有验收权的人给出结论。" />
          )}
          {inReview.map((t) => {
            const criteria = t.acceptance.split("\n").filter(Boolean);
            return (
              <div key={t.id} className="card overflow-hidden">
                <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] bg-[var(--surface-2)] px-4 py-2.5">
                  <TaskStatusBadge status="pending_accept" />
                  <Link
                    href={`/projects/${projectId}/tasks/${t.id}`}
                    className="text-[13px] font-semibold hover:text-[var(--accent-ink)]"
                  >
                    {t.title}
                  </Link>
                  <span className="ml-auto text-[11px] text-[var(--muted)]">
                    {t.assignee?.name ?? "未指派"} 提交 · {t.artifacts.length} 项产物
                  </span>
                </div>

                <div className="grid gap-0 md:grid-cols-3 md:divide-x md:divide-[var(--line)]">
                  <div className="p-4">
                    <div className="label">标准</div>
                    <ul className="mt-2 space-y-1.5">
                      {(criteria.length ? criteria : ["（任务未填写验收标准）"]).map((c, i) => (
                        <li key={i} className="flex gap-1.5 text-[12px] leading-relaxed text-[var(--ink-2)]">
                          <span className="mono text-[10px] text-[var(--faint)]">{i + 1}.</span>
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="border-t border-[var(--line)] p-4 md:border-t-0">
                    <div className="label">证据</div>
                    <div className="mt-2 space-y-1.5">
                      {t.artifacts.length === 0 && (
                        <p className="text-[11.5px] text-[var(--red)]">没有任何产物或说明</p>
                      )}
                      {t.artifacts.map((a) => (
                        <div key={a.id} className="rounded-md border border-[var(--line)] px-2 py-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="tag">{ARTIFACT_META[a.type].label}</span>
                            <span className="mono text-[9.5px] text-[var(--faint)]">{a.version}</span>
                          </div>
                          <p className="mt-0.5 text-[11.5px] font-medium">{a.title}</p>
                          <p className="mono truncate text-[10px] text-[var(--accent-ink)]">{a.location}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-[var(--line)] p-4 md:border-t-0">
                    <div className="label">结论</div>
                    <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--muted)]">
                      尚未验收。进入任务详情，对照标准逐条写下结论。
                    </p>
                    <Link
                      href={`/projects/${projectId}/tasks/${t.id}`}
                      className="btn btn-sm btn-primary mt-2"
                    >
                      去验收
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-9">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[14px] font-semibold">已完成 · {done.length}</h2>
          <span className="text-[11px] text-[var(--muted)]">均带验收记录</span>
        </div>
        <div className="mt-3 space-y-2">
          {done.length === 0 && (
            <Empty title="还没有完成的任务" hint="通过验收的任务会出现在这里，并保留验收记录与返工轮次。" />
          )}
          {done.map((t) => (
            <Link
              key={t.id}
              href={`/projects/${projectId}/tasks/${t.id}`}
              className="card card-hover flex flex-wrap items-center gap-3 px-4 py-2.5"
            >
              <TaskStatusBadge status="done" />
              <span className="text-[12.5px] font-medium">{t.title}</span>
              <span className="ml-auto flex items-center gap-3 text-[11px] text-[var(--muted)]">
                <span>{t.artifacts.length} 产物</span>
                <span>{t.reviews.length} 次验收</span>
                {t.reviews[0] && (
                  <span className="mono text-[var(--faint)]">{formatTime(t.reviews[0].createdAt)}</span>
                )}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-9">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[14px] font-semibold">产物清单 · {project.artifacts.length}</h2>
          <span className="text-[11px] text-[var(--muted)]">按提交时间倒序</span>
        </div>
        <div className="card mt-3 overflow-hidden">
          {project.artifacts.length === 0 ? (
            <div className="px-4 py-8 text-center text-[12px] text-[var(--muted)]">还没有产物</div>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--surface-2)] text-left text-[10.5px] uppercase tracking-wider text-[var(--muted)]">
                  <th className="px-4 py-2 font-semibold">类型</th>
                  <th className="px-3 py-2 font-semibold">名称</th>
                  <th className="px-3 py-2 font-semibold">位置</th>
                  <th className="px-3 py-2 font-semibold">版本</th>
                  <th className="px-3 py-2 font-semibold">来源任务</th>
                  <th className="px-3 py-2 font-semibold">提交人</th>
                  <th className="px-4 py-2 text-right font-semibold">时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {project.artifacts.map((a) => (
                  <tr key={a.id} className="row-link">
                    <td className="whitespace-nowrap px-4 py-2">
                      <span className="tag">{ARTIFACT_META[a.type].label}</span>
                    </td>
                    <td className="px-3 py-2 font-medium">{a.title}</td>
                    <td className="mono max-w-[220px] truncate px-3 py-2 text-[11px] text-[var(--accent-ink)]">
                      {a.location}
                    </td>
                    <td className="mono px-3 py-2 text-[11px] text-[var(--muted)]">{a.version}</td>
                    <td className="px-3 py-2">
                      {a.task ? (
                        <Link
                          href={`/projects/${projectId}/tasks/${a.task.id}`}
                          className="line-clamp-1 text-[11.5px] text-[var(--ink-2)] hover:text-[var(--accent-ink)]"
                        >
                          {a.task.title}
                        </Link>
                      ) : (
                        <span className="text-[11px] text-[var(--faint)]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[11.5px] text-[var(--muted)]">{a.submittedBy.name}</td>
                    <td className="mono px-4 py-2 text-right text-[10.5px] text-[var(--faint)]">
                      {formatTime(a.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  );
}
