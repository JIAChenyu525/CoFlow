import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { NewProjectWizard } from "@/components/new-project-wizard";
import { Breadcrumb } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const [user, users] = await Promise.all([
    requireUser(),
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  return (
    <main className="mx-auto max-w-[1180px] px-5 pb-24 pt-7">
      <Breadcrumb items={[{ label: "项目大厅", href: "/" }, { label: "新建项目" }]} />
      <div className="mt-4">
        <h1 className="text-[24px] font-semibold tracking-tight">新建项目</h1>
        <p className="mt-1 text-[13px] text-[var(--muted)]">
          创建的不是一个群聊，而是一份机器可读的项目章程。后面的每个任务、决策与验收都挂在这份章程上。
        </p>
      </div>

      <NewProjectWizard
        users={users.map((u) => ({ id: u.id, name: u.name, color: u.color, handle: u.handle }))}
        currentUser={{ id: user.id, name: user.name, color: user.color }}
      />

      <div className="mt-6 text-center text-[12px] text-[var(--muted)]">
        已经建好了？<Link href="/" className="text-[var(--accent-ink)] underline-offset-2 hover:underline">回到项目大厅</Link>
      </div>
    </main>
  );
}
