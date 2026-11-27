import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ROLE_META } from "@/lib/constants";
import { InvitationActions } from "@/components/invitation-actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "收到的邀请 · CoFlow" };

export default async function InvitationsPage() {
  const user = await requireUser();

  const invitations = await prisma.projectInvitation.findMany({
    where: { inviteeId: user.id, status: "PENDING" },
    include: {
      project: { select: { id: true, name: true, key: true } },
      inviter: { select: { name: true, handle: true, color: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="cf-scope mx-auto max-w-[820px] px-6 py-6">
      <div className="border-b border-[var(--cf-border-strong)] pb-3.5">
        <div className="font-mono-tabular text-[10.5px] font-semibold tracking-widest text-[var(--cf-primary)]">
          INVITATIONS
        </div>
        <h1 className="mt-0.5 text-[20px] font-bold text-[var(--cf-text-primary)]">收到的邀请</h1>
        <p className="mt-1 text-[12.5px] text-[var(--cf-text-secondary)]">
          只有你接受后，才会加入对方的项目。拒绝不会通知对方内容，只是不再显示。
        </p>
      </div>

      {invitations.length === 0 ? (
        <div className="mt-8 border border-dashed border-[var(--cf-border-strong)] px-6 py-12 text-center">
          <p className="text-[13px] font-semibold text-[var(--cf-text-primary)]">没有待处理的邀请</p>
          <p className="mt-1 text-[12px] text-[var(--cf-text-tertiary)]">
            别人邀请你加入项目时，会出现在这里。
          </p>
          <Link
            href="/"
            className="mt-3 inline-flex h-[30px] items-center text-[12.5px] text-[var(--cf-primary)] hover:underline"
          >
            返回项目大厅
          </Link>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {invitations.map((inv) => (
            <div
              key={inv.id}
              style={{ backgroundColor: "var(--cf-surface-card)", borderColor: "var(--cf-border-strong)" }}
              className="flex flex-wrap items-center gap-3 border px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mono bg-[var(--cf-primary)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--cf-surface-card)]">
                    {inv.project.key}
                  </span>
                  <span className="text-[13.5px] font-semibold text-[var(--cf-text-primary)]">
                    {inv.project.name}
                  </span>
                </div>
                <p className="mt-1 text-[11.5px] text-[var(--cf-text-tertiary)]">
                  {inv.inviter.name}（@{inv.inviter.handle}）邀请你作为
                  {ROLE_META[inv.role].label}
                  {inv.message ? ` · 留言：${inv.message}` : ""}
                </p>
              </div>
              <InvitationActions invitationId={inv.id} />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
