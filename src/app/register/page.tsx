import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { RegisterForm } from "@/components/register-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "注册 · CoFlow" };

export default async function RegisterPage() {
  const user = await getSessionUser();
  if (user) redirect("/");

  const devMode = process.env.NODE_ENV !== "production";

  return (
    <main className="mx-auto flex min-h-[calc(100vh-52px)] max-w-[440px] flex-col justify-center px-5 py-10">
      <div className="mb-6">
        <div className="label">Create account</div>
        <h1 className="mt-1.5 text-[24px] font-semibold tracking-tight">注册 CoFlow</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted)]">
          用邮箱注册，设置一个密码。之后既可以用密码登录，也可以用验证码登录。
        </p>
      </div>

      <RegisterForm showDevCode={devMode && !process.env.SMTP_HOST} />

      <div className="mt-4 flex items-center justify-center gap-3 text-[11.5px]">
        <Link href="/privacy" className="text-[var(--accent-ink)] hover:underline">
          隐私说明
        </Link>
        <span className="text-[var(--line-strong)]">|</span>
        <span className="text-[var(--muted)]">注册即表示同意上述说明</span>
      </div>
    </main>
  );
}
