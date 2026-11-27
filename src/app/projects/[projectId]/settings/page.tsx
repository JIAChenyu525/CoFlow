import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ROLE_META } from "@/lib/constants";
import { Avatar, formatDate } from "@/components/ui";
import { ProjectDangerZone } from "@/components/project-danger-zone";
import { InvitePanel } from "@/components/invite-panel";
import {
  CharterEditor,
  MemberInvite,
  MemberRoleSelect,
  PendingInvites,
  RemoveMemberButton,
  StageControl,
} from "@/components/project-settings-panels";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireUser();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      charters: { orderBy: { version: "desc" } },
      members: { include: { user: true } },
      invitations: {
        where: { status: "PENDING" },
        include: { invitee: { select: { name: true, handle: true, color: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!project) notFound();

  const me = project.members.find((m) => m.userId === user.id);
  const canAdmin = me?.role === "OWNER" || me?.role === "LEAD";
  const charter = project.charters[0];

  return (
    <main className="max-w-[1180px] px-5 py-6">
      <div className="label">Settings</div>
      <h1 className="mt-1 text-[21px] font-semibold tracking-tight">项目设置</h1>

      <Section title="项目信息" hint="名称与阶段会出现在项目卡与上下文中">
        <div className="grid gap-3 sm:grid-cols-3">
          <KV k="项目名称" v={project.name} />
          <KV k="项目代号" v={<span className="mono">{project.key}</span>} />
          <div>
            <div className="label">当前阶段</div>
            <div className="mt-1">
              <StageControl projectId={project.id} stage={project.stage} canEdit={canAdmin} />
            </div>
          </div>
        </div>
        <div className="mt-3">
          <KV k="项目说明" v={project.summary || "—"} />
        </div>
      </Section>

      <Section
        title={`项目章程 · 当前 v${charter?.version ?? "—"}`}
        hint="目标变更必须生成新版本，旧版本不可被静默覆盖"
      >
        {charter ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="项目目标" value={charter.goal} full />
            <Field label="目标用户" value={charter.targetUsers} />
            <Field label="交付范围" value={charter.scope} />
            <Field label="非目标" value={charter.nonGoals} />
            <Field label="硬性约束" value={charter.constraints} />
            <Field label="验收标准" value={charter.acceptance} full />
          </div>
        ) : (
          <p className="text-[12px] text-[var(--muted)]">尚未生成章程</p>
        )}

        <div className="mt-5">
          <div className="label">版本历史</div>
          <div className="mt-2 space-y-1.5">
            {project.charters.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-lg border border-[var(--line)] px-3 py-2"
              >
                <span className="mono tag">v{c.version}</span>
                <span className="min-w-0 flex-1 truncate text-[11.5px] text-[var(--ink-2)]">
                  {c.note || "（无变更说明）"}
                </span>
                <span className="mono text-[10px] text-[var(--faint)]">
                  {formatDate(c.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {charter && (
          <CharterEditor
            projectId={project.id}
            canEdit={canAdmin}
            current={{
              goal: charter.goal,
              targetUsers: charter.targetUsers,
              scope: charter.scope,
              nonGoals: charter.nonGoals,
              constraints: charter.constraints,
              acceptance: charter.acceptance,
              version: charter.version,
            }}
          />
        )}
      </Section>

      <Section
        title={`成员与角色 · ${project.members.length}`}
        hint="角色决定事实层的写入权限，不是头衔"
      >
        <div className="space-y-1.5">
          {project.members.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 rounded-lg border border-[var(--line)] px-3 py-2"
            >
              <Avatar name={m.user.name} color={m.user.color} size={24} />
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-medium">
                  {m.user.name}
                  {m.userId === user.id && (
                    <span className="ml-1.5 text-[10px] text-[var(--muted)]">（你）</span>
                  )}
                </div>
                <div className="mono text-[10px] text-[var(--faint)]">@{m.user.handle}</div>
              </div>
              <span className="hidden text-[10.5px] text-[var(--muted)] sm:block">
                {ROLE_META[m.role].hint}
              </span>
              <MemberRoleSelect
                projectId={project.id}
                userId={m.userId}
                role={m.role}
                canEdit={me?.role === "OWNER"}
                isSelf={m.userId === user.id}
              />
              {me?.role === "OWNER" && m.userId !== user.id && (
                <RemoveMemberButton
                  projectId={project.id}
                  userId={m.userId}
                  name={m.user.name}
                />
              )}
            </div>
          ))}
        </div>

        {(me?.role === "OWNER" || me?.role === "LEAD") && (
          <>
            <MemberInvite projectId={project.id} />
            <PendingInvites
              items={project.invitations.map((inv) => ({
                id: inv.id,
                role: inv.role,
                invitee: inv.invitee,
              }))}
            />
          </>
        )}
      </Section>

      <Section title="分享链接加入" hint="适合发给一群人：拿到链接的人点一下就加入">
        {me?.role === "OWNER" ? (
          <InvitePanel projectId={project.id} inviteCode={project.inviteCode ?? null} />
        ) : (
          <p className="text-[12px] text-[var(--muted)]">只有项目发起人可以开启邀请加入。</p>
        )}
      </Section>

      {me?.role === "OWNER" && (
        <section className="mt-7">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-[13.5px] font-semibold text-[var(--cf-danger)]">危险操作</h2>
              <p className="mt-0.5 text-[11px] text-[var(--cf-text-muted)]">
                只有项目发起人可以执行，删除后无法恢复
              </p>
            </div>
          </div>
          <div className="mt-3">
            <ProjectDangerZone
              projectId={project.id}
              projectName={project.name}
              projectKey={project.key}
            />
          </div>
        </section>
      )}

      <Section title="数据与保留策略" hint="阶段一采用固定策略，后续按项目可配">
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            ["事件流", "全量保留，不可修改"],
            ["详细 Agent 日志", "尚未接入，默认短保留"],
            ["关键决策与验收", "长期保留"],
            ["敏感本地路径", "不进入事件与归档"],
            ["模型 API Key", "平台不读取、不保存"],
            ["删除策略", "云端与本地分开授权"],
          ].map(([k, v]) => (
            <div key={k} className="card-quiet flex items-center justify-between px-3 py-2">
              <span className="text-[11.5px] text-[var(--ink-2)]">{k}</span>
              <span className="text-[10.5px] text-[var(--muted)]">{v}</span>
            </div>
          ))}
        </div>
      </Section>
    </main>
  );
}

function Section({
  title,
  hint,
  right,
  children,
}: {
  title: string;
  hint?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-7">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-[13.5px] font-semibold">{title}</h2>
          {hint && <p className="mt-0.5 text-[11px] text-[var(--muted)]">{hint}</p>}
        </div>
        {right}
      </div>
      <div className="card mt-3 p-4">{children}</div>
    </section>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <div className="label">{k}</div>
      <div className="mt-1 text-[12.5px] font-medium">{v}</div>
    </div>
  );
}

function Field({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <div className="label">{label}</div>
      <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-[var(--ink-2)]">
        {value || "—"}
      </p>
    </div>
  );
}
