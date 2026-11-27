import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { describeEvent, summarizeEvent } from "@/lib/events";
import { DECISION_META } from "@/lib/constants";
import { Empty, Pill, formatDate, formatTime } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TimelinePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  await requireUser();

  const [project, events, users] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      include: {
        decisions: {
          orderBy: [{ status: "asc" }, { createdAt: "desc" }],
          include: { decidedBy: true, supersedes: { select: { id: true, title: true } } },
        },
      },
    }),
    prisma.projectEvent.findMany({
      where: { projectId },
      orderBy: { occurredAt: "desc" },
      take: 120,
    }),
    prisma.user.findMany(),
  ]);

  if (!project) notFound();

  const actorName = (e: { actorType: string; actorId: string }) => {
    if (e.actorType === "AGENT_SESSION") return "Agent 会话";
    if (e.actorType === "SYSTEM") return "系统";
    return users.find((u) => u.id === e.actorId)?.name ?? "—";
  };

  return (
    <main className="px-5 py-6">
      <div className="label">Decisions & Timeline</div>
      <h1 className="mt-1 text-[21px] font-semibold tracking-tight">决策与时间线</h1>
      <p className="mt-1 max-w-[70ch] text-[12.5px] text-[var(--muted)]">
        事件流回答「历史上发生了什么」，决策记录回答「为什么这样做」。只有已确认的决策会进入
        Agent 上下文。
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-[14px] font-semibold">决策 · {project.decisions.length}</h2>
            <span className="text-[11px] text-[var(--muted)]">被替代的决策保留历史关系</span>
          </div>

          <div className="mt-3 space-y-3">
            {project.decisions.length === 0 && (
              <Empty
                title="还没有决策记录"
                hint="在工作台对讨论结论点「形成决策」，填写结论与理由；确认后才进入事实层。"
              />
            )}
            {project.decisions.map((d) => {
              const meta = DECISION_META[d.status];
              return (
                <article
                  key={d.id}
                  className={`card p-4 ${d.status === "SUPERSEDED" ? "opacity-60" : ""}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={meta.tone} dot>
                      {meta.label}
                    </Pill>
                    <h3 className="text-[13.5px] font-semibold">{d.title}</h3>
                    <span className="mono ml-auto text-[10px] text-[var(--faint)]">
                      D{d.id.slice(-6)} · v{d.version}
                    </span>
                  </div>

                  <div className="mt-2.5 space-y-2 text-[12px] leading-relaxed">
                    <DecRow k="结论" v={d.conclusion} strong />
                    <DecRow k="理由" v={d.rationale} />
                    {d.alternatives && <DecRow k="备选方案" v={d.alternatives} />}
                    {d.impact && <DecRow k="影响范围" v={d.impact} />}
                    {d.supersedes && (
                      <DecRow k="替代" v={`取代「${d.supersedes.title}」`} />
                    )}
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--line)] pt-2 text-[10.5px] text-[var(--muted)]">
                    <span>决策人 {d.decidedBy?.name ?? "—"}</span>
                    <span>{d.confirmedAt ? `确认于 ${formatDate(d.confirmedAt)}` : `提案于 ${formatDate(d.createdAt)}`}</span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-[14px] font-semibold">事件流</h2>
            <span className="mono text-[10.5px] text-[var(--muted)]">最近 {events.length} 条</span>
          </div>

          <div className="mt-3">
            {events.length === 0 ? (
              <Empty title="暂无事件" />
            ) : (
              <ol className="relative ml-1 border-l border-[var(--line)] pl-4">
                {events.map((e) => (
                  <li key={e.id} className="relative pb-3.5">
                    <span
                      className="absolute -left-[21px] top-1.5 h-[7px] w-[7px] rounded-full border-2 border-[var(--paper)]"
                      style={{
                        background: e.type.startsWith("decision")
                          ? "var(--green)"
                          : e.type.startsWith("artifact")
                            ? "var(--blue)"
                            : e.type.startsWith("task.status")
                              ? "var(--accent)"
                              : e.type.startsWith("task.blocked")
                                ? "var(--red)"
                                : "var(--line-strong)",
                      }}
                    />
                    <div className="flex items-baseline gap-2">
                      <span className="text-[11.5px] font-medium">{describeEvent(e.type)}</span>
                      <span className="mono ml-auto text-[9.5px] text-[var(--faint)]">
                        {formatTime(e.occurredAt)}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] leading-relaxed text-[var(--muted)]">
                      {actorName(e)}
                      {(() => {
                        const s = summarizeEvent(e.type, e.payload);
                        return s ? ` · ${s}` : "";
                      })()}
                    </div>
                    <div className="mono mt-0.5 text-[9px] text-[var(--faint)]">{e.type}</div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function DecRow({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex gap-3">
      <span className="w-14 shrink-0 text-[11px] text-[var(--muted)]">{k}</span>
      <span className={strong ? "text-[var(--ink)]" : "text-[var(--ink-2)]"}>{v}</span>
    </div>
  );
}

