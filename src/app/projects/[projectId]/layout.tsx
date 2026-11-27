import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { computeProgress } from "@/lib/task-state";
import { ROLE_META, STAGE_META } from "@/lib/constants";
import { ProjectNav, ProjectNavMobile } from "@/components/project-nav";
import { Pill, Progress } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const [project, user] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: { include: { user: true } },
        tasks: { select: { status: true, weight: true } },
      },
    }),
    requireUser(),
  ]);

  if (!project) notFound();

  const me = project.members.find((m) => m.userId === user.id);
  // 非成员直接 404：项目名、任务、决策都不应该对未授权账号可见
  if (!me) notFound();

  const progress = computeProgress(project.tasks);
  const counts = {
    active: project.tasks.filter((t) => t.status === "IN_PROGRESS").length,
    review: project.tasks.filter((t) => t.status === "IN_REVIEW").length,
    blocked: project.tasks.filter((t) => t.status === "BLOCKED").length,
  };

  return (
    <>
      {/* 窄屏：项目身份 + 横向导航 */}
      <div className="md:hidden">
        <div className="flex items-center gap-2 border-b border-[var(--line)] bg-[var(--surface)] px-4 py-2">
          <span className="mono rounded-[5px] bg-[var(--surface-3)] px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-[var(--muted)]">
            {project.key}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
            {project.name}
          </span>
          <span className="mono text-[11px] text-[var(--muted)]">{progress}%</span>
        </div>
        <ProjectNavMobile projectId={project.id} counts={counts} />
      </div>

      <div className="mx-auto flex max-w-[1600px]">
      <aside className="scroll-thin sticky top-[52px] hidden h-[calc(100vh-52px)] w-[218px] shrink-0 flex-col overflow-y-auto border-r border-[var(--line-strong)] bg-[var(--surface)] px-3 py-4 md:flex">
        <Link
          href="/"
          className="mb-4 flex items-center gap-1 px-1 text-[11.5px] text-[var(--muted)] transition hover:text-[var(--ink)]"
        >
          <span className="text-[13px] leading-none">←</span> 项目大厅
        </Link>

        <div className="px-1">
          <div className="flex items-center gap-2">
            <span className="mono rounded-[5px] bg-[var(--surface-3)] px-1.5 py-0.5 text-[10.5px] font-semibold tracking-wider text-[var(--muted)]">
              {project.key}
            </span>
            <Pill tone={project.stage === "REVIEW" ? "amber" : "accent"} dot>
              {STAGE_META[project.stage].label}
            </Pill>
          </div>
          <h1 className="mt-2 text-[15px] font-semibold leading-snug tracking-tight">
            {project.name}
          </h1>
        </div>

        <div className="mt-4 px-1">
          <div className="mb-1 flex items-center justify-between">
            <span className="label">交付进度</span>
            <span className="mono text-[11px] font-semibold">{progress}%</span>
          </div>
          <Progress value={progress} />
        </div>

        <div className="my-4 h-px bg-[var(--line)]" />

        <ProjectNav projectId={project.id} counts={counts} />

        <div className="mt-auto space-y-3 pt-4">
          <div className="flex items-center gap-2 px-1">
            <span
              className="avatar"
              style={{ background: user.color, width: 22, height: 22, fontSize: 10 }}
            >
              {user.name.slice(0, 1)}
            </span>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[11.5px] font-medium">{user.name}</div>
              <div className="text-[10.5px] text-[var(--muted)]">
                {me ? ROLE_META[me.role].label : "非项目成员（只读）"}
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
      </div>
    </>
  );
}
