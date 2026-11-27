import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { prisma } from "@/lib/db";
import { UserSwitcher } from "./user-switcher";
import { TopNav } from "./top-nav";

export async function AppHeader() {
  const devMode = process.env.NODE_ENV !== "production";
  let user: Awaited<ReturnType<typeof getSessionUser>> = null;
  let users: { id: string; name: string; color: string; handle: string }[] = [];

  try {
    user = await getSessionUser();
    if (devMode) {
      users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
    }
  } catch {
    // 数据库未就绪时，顶栏降级但不拖垮整站
    return (
      <header
        style={{
          backgroundColor: "var(--cf-surface-card)",
          borderColor: "var(--cf-border-strong)",
        }}
        className="border-b"
      >
        <div className="mx-auto flex h-[52px] max-w-[1600px] items-center gap-3 px-5">
          <span className="flex h-[26px] w-[26px] items-center justify-center bg-[var(--cf-surface-tertiary)]" />
          <span className="text-[15px] font-bold">CoFlow</span>
          <span
            style={{ backgroundColor: "var(--cf-warning-bg)", color: "var(--cf-warning)" }}
            className="ml-auto px-2 py-1 text-[11px]"
          >
            数据库未连接 · 请先执行 pnpm db:push && pnpm db:seed
          </span>
        </div>
      </header>
    );
  }

  return (
    <header
      style={{
        backgroundColor: "var(--cf-surface-card)",
        borderColor: "var(--cf-border-strong)",
      }}
      className="sticky top-0 z-40 border-b"
    >
      <div className="mx-auto flex h-[52px] max-w-[1600px] items-center gap-4 px-5">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="flex h-[26px] w-[26px] items-center justify-center bg-[var(--cf-primary)] text-[var(--cf-surface-card)]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M5 7.5h5.5a3 3 0 0 1 3 3v3a3 3 0 0 0 3 3H19"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx="5" cy="7.5" r="2.1" fill="currentColor" />
              <circle cx="19" cy="16.5" r="2.1" fill="currentColor" />
            </svg>
          </span>
          <span className="flex items-baseline gap-2">
            <span className="text-[15px] font-bold tracking-tight text-[var(--cf-text-primary)]">
              CoFlow
            </span>
            <span className="hidden font-mono-tabular text-[10.5px] tracking-[0.14em] text-[var(--cf-text-tertiary)] sm:inline">
              项目事实层
            </span>
          </span>
        </Link>

        <div className="ml-4 flex self-stretch">
          <TopNav />
        </div>

        <div className="ml-auto flex items-center gap-3">
          {user ? (
            <>
              {devMode && users.length > 0 && (
                <UserSwitcher
                  currentId={user.id}
                  users={users.map((u) => ({
                    id: u.id,
                    name: u.name,
                    color: u.color,
                    handle: u.handle,
                  }))}
                />
              )}
              <span className="hidden items-center gap-1.5 sm:flex">
                <span
                  className="flex h-[20px] w-[20px] items-center justify-center text-[9px] font-bold text-white"
                  style={{ background: user.color }}
                >
                  {user.name.slice(0, 1)}
                </span>
                <span className="text-[12px] font-medium text-[var(--cf-text-primary)]">
                  {user.name}
                </span>
              </span>
              <Link
                href="/account"
                className="text-[11.5px] text-[var(--cf-text-tertiary)] transition-colors hover:text-[var(--cf-primary)]"
              >
                账号
              </Link>
              <form action={logout}>
                <button
                  type="submit"
                  className="h-[24px] px-2 text-[11.5px] text-[var(--cf-text-tertiary)] transition-colors hover:text-[var(--cf-primary)]"
                >
                  退出
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              style={{ backgroundColor: "var(--cf-primary)", color: "var(--cf-surface-card)" }}
              className="flex h-[28px] items-center px-3 text-[12px] font-semibold"
            >
              登录
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
