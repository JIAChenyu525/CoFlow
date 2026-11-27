import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "登录 · CoFlow" };

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/");

  const devMode = process.env.NODE_ENV !== "production";
  const demoUsers = devMode
    ? await prisma.user.findMany({
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, email: true, color: true },
      })
    : [];

  return (
    <main className="mx-auto flex min-h-[calc(100vh-52px)] max-w-[440px] flex-col justify-center px-5 py-10">
      <div className="mb-6">
        <div className="label">Sign in</div>
        <h1 className="mt-1.5 text-[24px] font-semibold tracking-tight">登录 CoFlow</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted)]">
          用邮箱密码或验证码登录。项目数据属于你的账号，不属于某台电脑；之后接入 Agent
          的设备凭据会绑定到这个账号上。
        </p>
      </div>

      <LoginForm
        showDevCode={devMode && !process.env.SMTP_HOST}
        demoUsers={demoUsers.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email ?? "",
          color: u.color,
        }))}
      />

      <p className="mt-6 text-center text-[11.5px] leading-relaxed text-[var(--muted)]">
        继续即表示同意：平台只保存项目事实，
        <br />
        不读取、不保存你本地工具的模型密钥。
      </p>

      <div className="mt-4 flex items-center justify-center gap-3 text-center text-[11.5px]">
        <Link href="/docs/protocol" className="text-[var(--accent-ink)] hover:underline">
          了解事件协议
        </Link>
        <span className="text-[var(--line-strong)]">|</span>
        <Link href="/privacy" className="text-[var(--accent-ink)] hover:underline">
          隐私说明
        </Link>
      </div>
    </main>
  );
}
