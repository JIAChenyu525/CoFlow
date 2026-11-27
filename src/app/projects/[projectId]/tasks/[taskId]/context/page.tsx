import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { loadContext } from "@/lib/context-data";
import { Breadcrumb, Empty, Pill, formatTime } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import { SaveSnapshotButton } from "@/components/context-panels";

export const dynamic = "force-dynamic";

export default async function ContextPage({
  params,
}: {
  params: Promise<{ projectId: string; taskId: string }>;
}) {
  const { projectId, taskId } = await params;
  const user = await requireUser();

  const membership = await prisma.membership.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  });
  if (!membership) notFound();

  const loaded = await loadContext(taskId);
  if (!loaded) notFound();

  const { pkg, hash, tokens, truncated, overBudget, prompt, task } = loaded;

  const snapshots = await prisma.contextSnapshot.findMany({
    where: { taskId },
    orderBy: { version: "desc" },
    take: 6,
  });

  const pct = Math.min(100, Math.round((tokens / pkg.budget.max_tokens) * 100));

  return (
    <main className="px-5 py-5">
      <Breadcrumb
        items={[
          { label: "项目大厅", href: "/" },
          { label: task.project.name, href: `/projects/${projectId}` },
          { label: "任务与分工", href: `/projects/${projectId}/tasks` },
          { label: task.title, href: `/projects/${projectId}/tasks/${taskId}` },
          { label: "上下文包" },
        ]}
      />

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label">Context package</div>
          <h1 className="mt-1 text-[21px] font-semibold tracking-tight">上下文包预览</h1>
          <p className="mt-1 max-w-[72ch] text-[12.5px] leading-relaxed text-[var(--muted)]">
            Agent 拿到的不是聊天记录，而是这份按任务裁剪过的包。L0/L1 不可裁；超预算先砍过程，
            再砍旧决策，砍了什么会记在下面。
          </p>
        </div>
        <div className="text-right">
          <div className="label">内容哈希</div>
          <div className="mono mt-1 text-[11px] text-[var(--ink-2)]">{hash.slice(0, 23)}…</div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-3">
          {/* L0 */}
          <LayerCard
            code="L0"
            title="稳定层 · 项目章程"
            tone="accent"
            note={pkg.charter ? `v${pkg.charter.version}` : "无"}
            pinned
          >
            {pkg.charter ? (
              <div className="space-y-2">
                <Field k="项目目标" v={pkg.charter.goal} />
                <Field k="交付范围" v={pkg.charter.scope} />
                <Field k="非目标" v={pkg.charter.non_goals} />
                <Field k="硬性约束" v={pkg.charter.constraints} />
                <Field k="验收口径" v={pkg.charter.acceptance} />
              </div>
            ) : (
              <p className="text-[12px] text-[var(--red)]">项目没有章程——Agent 将缺少方向约束</p>
            )}
          </LayerCard>

          {/* L1 */}
          <LayerCard code="L1" title="任务层 · 当前任务" tone="blue" note={pkg.task.status} pinned>
            <div className="space-y-2">
              <Field k="标题" v={pkg.task.title} strong />
              <Field k="说明" v={pkg.task.description} />
              <Field k="输入材料" v={pkg.task.inputs} />
              <div className="grid gap-2 sm:grid-cols-2">
                <Field k="工作范围" v={pkg.task.scope} />
                <Field k="非工作范围" v={pkg.task.non_scope} />
              </div>
              <Field k="验收标准" v={pkg.task.acceptance} highlight />
              {pkg.task.dependencies.length > 0 && (
                <div>
                  <div className="label">前置依赖</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {pkg.task.dependencies.map((d) => (
                      <span key={d.id} className="tag">
                        {d.title} · {d.status}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </LayerCard>

          {/* L2 */}
          <LayerCard
            code="L2"
            title="动态层 · 决策 / 阻塞 / 最近变更"
            tone="amber"
            note={`${pkg.decisions.length + pkg.blockers.length + pkg.recent_changes.length} 项`}
          >
            <div className="space-y-3">
              <div>
                <div className="label">已确认决策 · {pkg.decisions.length}</div>
                {pkg.decisions.length === 0 ? (
                  <p className="mt-1 text-[11.5px] text-[var(--faint)]">没有已确认决策</p>
                ) : (
                  <div className="mt-1.5 space-y-1.5">
                    {pkg.decisions.map((d) => (
                      <div key={d.id} className="rounded-md border border-[var(--line)] px-2.5 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11.5px] font-semibold">{d.title}</span>
                          {d.source === "task" && <span className="tag">与本任务相关</span>}
                        </div>
                        <p className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--ink-2)]">
                          {d.conclusion}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="label">未解决阻塞 · {pkg.blockers.length}</div>
                {pkg.blockers.length === 0 ? (
                  <p className="mt-1 text-[11.5px] text-[var(--faint)]">当前没有阻塞</p>
                ) : (
                  <div className="mt-1.5 space-y-1.5">
                    {pkg.blockers.map((b) => (
                      <div
                        key={b.task_id}
                        className="rounded-md border border-[var(--red)]/25 bg-[var(--red-soft)]/40 px-2.5 py-1.5"
                      >
                        <div className="text-[11.5px] font-semibold">{b.title}</div>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--ink-2)]">
                          {b.reason}
                        </p>
                        {b.needs && (
                          <p className="mt-0.5 text-[10.5px] text-[var(--muted)]">需要：{b.needs}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="label">最近变更 · {pkg.recent_changes.length}</div>
                {pkg.recent_changes.length === 0 ? (
                  <p className="mt-1 text-[11.5px] text-[var(--faint)]">暂无</p>
                ) : (
                  <ul className="mt-1.5 space-y-0.5">
                    {pkg.recent_changes.map((c, i) => (
                      <li key={i} className="flex items-baseline gap-2 text-[11px]">
                        <span className="mono shrink-0 text-[10px] text-[var(--faint)]">
                          {c.at.slice(5, 10)}
                        </span>
                        <span className="text-[var(--ink-2)]">{c.summary}</span>
                        <span className="mono ml-auto text-[9.5px] text-[var(--faint)]">
                          {c.type}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </LayerCard>

          {/* L3 */}
          <LayerCard code="L3" title="证据层 · 工作区与合同" tone="slate" note="按需拉取">
            <div className="space-y-2">
              <div>
                <div className="label">允许修改</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {pkg.workspace.allowed_paths.length > 0 ? (
                    pkg.workspace.allowed_paths.map((p) => (
                      <span key={p} className="tag">
                        {p}
                      </span>
                    ))
                  ) : (
                    <span className="text-[11.5px] text-[var(--amber)]">
                      未授权任何目录——Agent 只能读，不能写
                    </span>
                  )}
                </div>
              </div>
              <div>
                <div className="label">禁止访问</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {pkg.workspace.denied_paths.map((p) => (
                    <span key={p} className="tag">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Field k="提交格式" v={pkg.conventions.commit_format} />
                <Field k="必须回传" v={pkg.output_contract.must_return.join(", ")} />
              </div>
              <p className="rounded-md bg-[var(--surface-2)] px-2.5 py-1.5 text-[10.5px] leading-relaxed text-[var(--muted)]">
                证据层只给引用不给正文。产物内容由 Connector 按需拉取，避免把整个仓库塞进提示词。
              </p>
            </div>
          </LayerCard>
        </div>

        {/* 右栏 */}
        <aside className="space-y-3">
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <span className="label">预算</span>
              <span className="mono text-[11px] font-semibold">
                {tokens.toLocaleString()} / {pkg.budget.max_tokens.toLocaleString()}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-3)]">
              <div
                className="h-full rounded-full transition-[width]"
                style={{
                  width: `${pct}%`,
                  background: overBudget
                    ? "var(--red)"
                    : pct > 80
                      ? "var(--amber)"
                      : "var(--accent)",
                }}
              />
            </div>
            <p className="mt-2 text-[10.5px] leading-relaxed text-[var(--muted)]">
              中文按字、英文按 4 字符估算，不是精确 tokenizer。
            </p>

            {overBudget && (
              <p className="mt-2 rounded-md bg-[var(--red-soft)] px-2 py-1.5 text-[10.5px] text-[var(--red)]">
                L0/L1 已超过预算，裁剪解决不了——需要精简任务定义。
              </p>
            )}

            {truncated.length > 0 && (
              <div className="mt-3">
                <div className="label">裁剪记录</div>
                <div className="mt-1.5 space-y-1">
                  {truncated.map((t, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[10.5px]">
                      <Pill tone="amber">{t.layer}</Pill>
                      <span className="text-[var(--ink-2)]">
                        丢弃 {t.dropped} × {t.count}
                      </span>
                      <span className="ml-auto text-[var(--faint)]">
                        {t.reason === "budget" ? "预算" : "上限"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="card p-4">
            <div className="label">快照</div>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">
              快照记录「这个 Agent 那一刻看到了什么」，只增不改。
            </p>
            <div className="mt-2">
              <SaveSnapshotButton taskId={taskId} />
            </div>

            <div className="mt-3 space-y-1">
              {snapshots.length === 0 ? (
                <Empty title="还没有快照" />
              ) : (
                snapshots.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 rounded-md border border-[var(--line)] px-2 py-1"
                  >
                    <span className="mono tag">v{s.version}</span>
                    <span className="mono text-[9.5px] text-[var(--faint)]">
                      {s.hash.slice(7, 15)}
                    </span>
                    <span className="mono ml-auto text-[9.5px] text-[var(--faint)]">
                      {s.tokens} tok · {formatTime(s.createdAt)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card-quiet p-4">
            <div className="label">注入隔离</div>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--ink-2)]">
              项目文本在提示里全部包进 <code className="mono text-[10px]">&lt;data&gt;</code>，
              并在开头声明它们是资料而非指令。消息里出现“忽略之前的规则”也不会被当成授权。
            </p>
          </div>

          <Link
            href={`/projects/${projectId}/tasks/${taskId}`}
            className="btn btn-sm w-full"
          >
            ← 回到任务
          </Link>
        </aside>
      </div>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[14px] font-semibold">渲染后的提示词</h2>
            <p className="mt-0.5 text-[11px] text-[var(--muted)]">
              这就是 Connector 会交给 Agent 的原文
            </p>
          </div>
          <CopyButton text={prompt} label="复制全文" />
        </div>
        <pre className="scroll-thin mt-2 max-h-[520px] overflow-auto rounded-[10px] border border-[var(--line)] bg-[#1b1f24] p-4 text-[11.5px] leading-relaxed text-[#d7e3e0]">
          <code>{prompt}</code>
        </pre>
      </section>
    </main>
  );
}

function LayerCard({
  code,
  title,
  tone,
  note,
  pinned,
  children,
}: {
  code: string;
  title: string;
  tone: string;
  note?: string;
  pinned?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--line)] bg-[var(--surface-2)] px-4 py-2">
        <Pill tone={tone}>{code}</Pill>
        <span className="text-[12.5px] font-semibold">{title}</span>
        {pinned && <span className="tag">不可裁剪</span>}
        <span className="mono ml-auto text-[10.5px] text-[var(--muted)]">{note}</span>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Field({
  k,
  v,
  strong,
  highlight,
}: {
  k: string;
  v: string;
  strong?: boolean;
  highlight?: boolean;
}) {
  if (!v) return null;
  return (
    <div>
      <div className="label">{k}</div>
      <p
        className={`mt-0.5 whitespace-pre-wrap text-[12px] leading-relaxed ${
          highlight
            ? "rounded-md bg-[var(--accent-soft)]/50 px-2 py-1 text-[var(--ink)]"
            : strong
              ? "font-medium text-[var(--ink)]"
              : "text-[var(--ink-2)]"
        }`}
      >
        {v}
      </p>
    </div>
  );
}
