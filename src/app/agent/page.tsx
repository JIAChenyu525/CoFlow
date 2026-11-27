import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { EndpointPaths, PairingForm, RevokeDeviceButton } from "@/components/agent-panels";
import { PreferredEndpointButton } from "@/components/preferred-endpoint-button";
import { Empty, Pill, formatTime } from "@/components/ui";
import type { Capability } from "@prisma/client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agent 连接 · CoFlow" };

const CAP_META: Record<Capability, { label: string; tone: string; hint: string }> = {
  AUTO: { label: "自动接入", tone: "green", hint: "领取任务、执行、回传全自动" },
  SEMI: { label: "半自动", tone: "amber", hint: "平台出任务包，人执行，Connector 采集证据" },
  MANUAL: { label: "手动", tone: "slate", hint: "人工上传产物与结果" },
};

export default async function AgentPage({
  searchParams,
}: {
  searchParams: Promise<{ pair?: string }>;
}) {
  const user = await requireUser();
  const { pair } = await searchParams;

  const devices = await prisma.device.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { endpoints: { include: { project: { select: { name: true, key: true } } } } },
  });

  const active = devices.filter((d) => !d.revokedAt);
  const revoked = devices.filter((d) => d.revokedAt);
  const detected = active.flatMap((d) =>
    d.endpoints.map((e) => ({ endpoint: e, device: d }))
  );

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;

  return (
    <main className="mx-auto max-w-[1180px] px-5 pb-20 pt-8">
      <div className="label">Agents</div>
      <h1 className="mt-1.5 text-[24px] font-semibold tracking-tight">Agent 连接</h1>
      <p className="mt-1 max-w-[70ch] text-[13px] leading-relaxed text-[var(--muted)]">
        平台管理的是组织身份与项目授权，不接管你的模型账号。连接器只识别本机装了什么工具、能不能被调用，
        <span className="text-[var(--ink-2)]">不读取、不上传任何模型密钥</span>。
      </p>

      {detected.length > 0 && (
        <section className="mt-6 rounded-[10px] border border-[var(--line-strong)] bg-[var(--surface-2)] p-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-[14px] font-semibold">
                我电脑上的 AI 工具 · {detected.length}
              </h2>
              <p className="mt-0.5 text-[11.5px] text-[var(--muted)]">
                点一下选为你的私人助手。它跑在你自己电脑上，别人用不了；但大家读的是同一份项目记忆。
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {detected.map(({ endpoint: e, device: d }) => {
              const meta = CAP_META[e.capability];
              const preferred = user.preferredEndpointId === e.id;
              return (
                <div
                  key={e.id}
                  style={{
                    borderColor: preferred ? "var(--accent)" : "var(--line)",
                    backgroundColor: "var(--surface)",
                  }}
                  className="flex flex-wrap items-center gap-2 border px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="mono text-[12.5px] font-semibold">{e.toolType}</span>
                      <span className="mono text-[10px] text-[var(--faint)]">{e.toolVersion}</span>
                      <Pill tone={meta.tone} dot>
                        {meta.label}
                      </Pill>
                    </div>
                    <div className="mt-0.5 text-[10.5px] text-[var(--muted)]">
                      {d.name} · {e.status === "ONLINE" ? "在线" : e.status}
                    </div>
                  </div>
                  <PreferredEndpointButton endpointId={e.id} preferred={preferred} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-[1.15fr_1fr]">
        <section className="card p-5">
          <h2 className="text-[14px] font-semibold">
            {detected.length > 0 ? "连接另一台设备" : "连接一台设备"}
          </h2>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--muted)]">
            在目标电脑上运行连接器，它会显示一个配对码。把配对码填在这里，那台电脑才能代表你领任务。
          </p>

          <ol className="mt-3 space-y-1.5 text-[12px] leading-relaxed text-[var(--ink-2)]">
            {[
              "在目标电脑执行下面的连接器登录命令",
              "终端会显示形如 ABCD-2345 的配对码",
              "把它填到下面，15 分钟内有效",
            ].map((t, i) => (
              <li key={i} className="flex gap-2">
                <span className="mono mt-[1px] flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full bg-[var(--surface-3)] text-[9.5px] font-semibold text-[var(--muted)]">
                  {i + 1}
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ol>

          <div className="mt-2 rounded border border-[var(--line)] bg-[var(--surface-2)] px-2.5 py-2">
            <div className="font-mono-tabular break-all text-[11px] text-[var(--ink-2)]">
              node &lt;连接器目录&gt;/bin/coflow.mjs login --base {origin}
            </div>
            <div className="mt-1 text-[10.5px] text-[var(--muted)]">
              连接器尚未发布到 npm。发布之后可以直接用 <span className="mono">npx coflow-connector login</span>。
            </div>
          </div>

          <div className="mt-4">
            <PairingForm initialCode={pair ?? ""} />
          </div>
        </section>

        <section className="card-quiet p-5">
          <h2 className="text-[13.5px] font-semibold">两层授权，别混在一起</h2>
          <div className="mt-3 space-y-2.5 text-[11.5px] leading-relaxed">
            <div>
              <div className="font-semibold text-[var(--ink)]">工具授权 · 归原工具</div>
              <p className="mt-0.5 text-[var(--muted)]">
                例如 Claude Code 已配置 DeepSeek 并能正常跑，CoFlow 只调用 Claude Code。
                它登录没登录、用哪个模型，平台不碰。
              </p>
            </div>
            <div>
              <div className="font-semibold text-[var(--ink)]">项目授权 · 归 CoFlow</div>
              <p className="mt-0.5 text-[var(--muted)]">
                这个端点能进哪个项目、读哪些任务、写哪些目录、回传哪些事件。撤销设备只断这条通道，
                不影响原工具继续在本机使用。
              </p>
            </div>
          </div>
        </section>
      </div>

      <section className="mt-9">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[14px] font-semibold">我的设备 · {active.length}</h2>
          <span className="text-[11px] text-[var(--muted)]">每个端点都需要单独授权目录</span>
        </div>

        <div className="mt-3 space-y-3">
          {active.length === 0 && (
            <Empty
              title="还没有连接任何设备"
              hint="没有设备也能用完整流程——产物可以用人工回传。接入 Agent 只是让它能自己领任务。"
            />
          )}

          {active.map((d) => (
            <div key={d.id} className="card overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] bg-[var(--surface-2)] px-4 py-2.5">
                <span className="text-[13px] font-semibold">{d.name}</span>
                <span className="tag">{d.os}</span>
                <Pill tone="green" dot>
                  {d.endpoints.some((e) => e.status === "ONLINE") ? "在线" : "已连接"}
                </Pill>
                <span className="mono ml-auto text-[10.5px] text-[var(--faint)]">
                  配对于 {formatTime(d.createdAt)}
                </span>
                <RevokeDeviceButton deviceId={d.id} name={d.name} />
              </div>

              {d.endpoints.length === 0 ? (
                <div className="px-4 py-4 text-[11.5px] leading-relaxed text-[var(--muted)]">
                  这台设备还没有注册工具端点。连接器完成能力探测后会自动登记。
                </div>
              ) : (
                <div className="divide-y divide-[var(--line)]">
                  {d.endpoints.map((e) => {
                    const meta = CAP_META[e.capability];
                    return (
                      <div key={e.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                        <span className="mono text-[12px] font-semibold">{e.toolType}</span>
                        <span className="mono text-[10.5px] text-[var(--faint)]">
                          {e.toolVersion}
                        </span>
                        <Pill tone={meta.tone} dot>
                          {meta.label}
                        </Pill>
                        <span className="hidden text-[11px] text-[var(--muted)] sm:inline">
                          {meta.hint}
                        </span>
                        <EndpointPaths
                          endpointId={e.id}
                          paths={Array.isArray(e.allowedPaths) ? (e.allowedPaths as string[]) : []}
                        />
                        <PreferredEndpointButton
                          endpointId={e.id}
                          preferred={user.preferredEndpointId === e.id}
                        />
                        <span className="ml-auto flex items-center gap-2 text-[10.5px] text-[var(--muted)]">
                          {e.project ? (
                            <span className="tag">
                              {e.project.key} · {e.project.name}
                            </span>
                          ) : (
                            <span className="text-[var(--faint)]">未绑定项目</span>
                          )}
                          <span className="mono text-[var(--faint)]">
                            {e.lastSeenAt ? formatTime(e.lastSeenAt) : "—"}
                          </span>
                        </span>
                        {e.capability !== "AUTO" && e.capabilityNote && (
                          <p className="w-full rounded-md bg-[var(--amber-soft)]/60 px-2 py-1 text-[10.5px] leading-relaxed text-[var(--amber)]">
                            {e.capabilityNote}
                            <span className="text-[var(--muted)]">
                              {" "}
                              · 只能半自动或手动执行，不能 <code className="mono">coflow run</code>
                            </span>
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {revoked.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[13px] font-semibold text-[var(--muted)]">
            已撤销 · {revoked.length}
          </h2>
          <div className="mt-2 space-y-1.5">
            {revoked.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-1.5 text-[11.5px] text-[var(--muted)]"
              >
                <span>{d.name}</span>
                <span className="mono text-[10px] text-[var(--faint)]">
                  撤销于 {formatTime(d.revokedAt!)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
