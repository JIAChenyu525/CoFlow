import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { JoinButton } from "@/components/join-button";

export const dynamic = "force-dynamic";

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await requireUser();

  const inviteCode = decodeURIComponent(code).trim().toUpperCase();
  const project = await prisma.project.findUnique({
    where: { inviteCode },
    include: { members: { select: { id: true } } },
  });

  if (!project) notFound();

  const already = await prisma.membership.findUnique({
    where: { projectId_userId: { projectId: project.id, userId: user.id } },
  });
  if (already) redirect(`/projects/${project.id}`);

  return (
    <main className="cf-scope mx-auto flex min-h-[calc(100dvh-52px)] max-w-[520px] flex-col justify-center px-6 py-10">
      <div
        style={{ backgroundColor: "var(--cf-surface-card)", borderColor: "var(--cf-border-strong)" }}
        className="border p-6"
      >
        <div className="font-mono-tabular text-[10.5px] font-semibold tracking-widest text-[var(--cf-primary)]">
          INVITATION
        </div>
        <h1 className="mt-1 text-[20px] font-bold text-[var(--cf-text-primary)]">
          邀请你加入「{project.name}」
        </h1>
        <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--cf-text-secondary)]">
          加入后你是普通成员：可以建任务、提交产物、参与讨论；
          改角色、删项目这些由项目发起人负责。
        </p>

        <div className="mt-3 flex flex-wrap gap-3 text-[11.5px] text-[var(--cf-text-tertiary)]">
          <span>项目代号 {project.key}</span>
          <span>已有 {project.members.length} 名成员</span>
        </div>

        <div className="mt-5">
          <JoinButton code={inviteCode} projectName={project.name} />
        </div>

        <Link
          href="/"
          className="mt-4 inline-flex text-[12px] text-[var(--cf-text-tertiary)] hover:text-[var(--cf-primary)]"
        >
          ← 先回项目大厅
        </Link>
      </div>
    </main>
  );
}
