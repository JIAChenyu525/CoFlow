import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentSession, requireUser } from "@/lib/auth";
import { RevokeOthersButton, RevokeSessionButton } from "@/components/session-actions";
import { PasswordForm } from "@/components/password-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "账号与安全 · CoFlow" };

/** 把 User-Agent 变成人看得懂的描述，认不出就如实显示未知 */
function describeAgent(ua: string | null) {
  if (!ua) return "未知设备";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : "浏览器";
  const os = /Windows NT 10/.test(ua)
    ? "Windows"
    : /Mac OS X/.test(ua)
      ? "macOS"
      : /Android/.test(ua)
        ? "Android"
        : /iPhone|iPad/.test(ua)
          ? "iOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "未知系统";
  return `${browser} · ${os}`;
}

export default async function AccountPage() {
  const user = await requireUser();
  const current = await getCurrentSession();

  const sessions = await prisma.session.findMany({
    where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
    take: 30,
  });

  const others = sessions.filter((s) => s.id !== current?.id).length;
  const devices = await prisma.device.findMany({
    where: { userId: user.id, revokedAt: null },
    orderBy: { createdAt: "desc" },
    include: { endpoints: { where: { status: { not: "REVOKED" } } } },
  });

  return (
    <main className="cf-scope mx-auto max-w-[960px] px-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--cf-border-strong)] pb-3.5">
        <div>
          <div className="font-mono-tabular text-[10.5px] font-semibold tracking-widest text-[var(--cf-primary)]">
            ACCOUNT & SECURITY
          </div>
          <h1 className="mt-0.5 text-[20px] font-bold text-[var(--cf-text-primary)]">
            账号与安全
          </h1>
          <p className="mt-1 text-[12.5px] text-[var(--cf-text-secondary)]">
            这里列出当前账号的登录会话与已接入设备。发现不认识的，直接撤销。
          </p>
        </div>
        <div className="text-right text-[12px] text-[var(--cf-text-tertiary)]">
          <div className="font-semibold text-[var(--cf-text-primary)]">{user.name}</div>
          <div className="font-mono-tabular">@{user.handle}</div>
        </div>
      </div>

      <section className="mt-5">
        <h2 className="text-[13.5px] font-semibold text-[var(--cf-text-primary)]">登录方式</h2>
        <p className="mt-0.5 text-[11.5px] text-[var(--cf-text-tertiary)]">
          邮箱密码和验证码都能登录。{user.passwordHash ? "当前已设置密码。" : "当前只能验证码登录。"}
        </p>
        <PasswordForm hasPassword={!!user.passwordHash} />
      </section>

      <section className="mt-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[13.5px] font-semibold text-[var(--cf-text-primary)]">
            登录会话 · {sessions.length}
          </h2>
          <RevokeOthersButton count={others} />
        </div>

        <div
          style={{ backgroundColor: "var(--cf-surface-card)", borderColor: "var(--cf-border-strong)" }}
          className="mt-2 divide-y divide-[var(--cf-border-subtle)] border"
        >
          {sessions.length === 0 && (
            <div className="px-4 py-6 text-center text-[12px] text-[var(--cf-text-tertiary)]">
              当前没有有效会话
            </div>
          )}

          {sessions.map((s) => {
            const isCurrent = s.id === current?.id;
            return (
              <div key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <span
                  className="h-[7px] w-[7px] shrink-0 rounded-full"
                  style={{
                    background: isCurrent ? "var(--cf-success)" : "var(--cf-border-strong)",
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[12.5px] font-medium text-[var(--cf-text-primary)]">
                      {describeAgent(s.userAgent)}
                    </span>
                    {isCurrent && (
                      <span
                        style={{
                          backgroundColor: "var(--cf-success-bg)",
                          color: "var(--cf-success)",
                          borderColor: "var(--cf-success-border)",
                        }}
                        className="border px-1.5 text-[10px] font-semibold"
                      >
                        当前设备
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 font-mono-tabular text-[10.5px] text-[var(--cf-text-tertiary)]">
                    {s.ip ?? "未知 IP"} · 登录于 {s.createdAt.toLocaleString("zh-CN")} · 最近活跃{" "}
                    {s.lastSeenAt.toLocaleString("zh-CN")}
                  </div>
                </div>
                <RevokeSessionButton sessionId={s.id} isCurrent={isCurrent} />
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-7">
        <div className="flex items-center justify-between">
          <h2 className="text-[13.5px] font-semibold text-[var(--cf-text-primary)]">
            已接入设备 · {devices.length}
          </h2>
          <Link href="/agent" className="text-[11.5px] text-[var(--cf-primary)] hover:underline">
            管理 Agent 连接
          </Link>
        </div>

        <div
          style={{ backgroundColor: "var(--cf-surface-card)", borderColor: "var(--cf-border-strong)" }}
          className="mt-2 divide-y divide-[var(--cf-border-subtle)] border"
        >
          {devices.length === 0 && (
            <div className="px-4 py-6 text-center text-[12px] text-[var(--cf-text-tertiary)]">
              还没有接入任何设备
            </div>
          )}
          {devices.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-medium text-[var(--cf-text-primary)]">
                  {d.name}
                </div>
                <div className="mt-0.5 font-mono-tabular text-[10.5px] text-[var(--cf-text-tertiary)]">
                  {d.os} · 配对于 {d.createdAt.toLocaleDateString("zh-CN")} ·{" "}
                  {d.endpoints.length} 个端点
                </div>
              </div>
              <span className="text-[11px] text-[var(--cf-text-tertiary)]">
                {d.lastSeenAt ? `最近在线 ${d.lastSeenAt.toLocaleString("zh-CN")}` : "从未连接"}
              </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
