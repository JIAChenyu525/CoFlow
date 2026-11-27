"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { removeMember, setMemberRole, setProjectStage, updateCharter } from "@/app/actions/projects";
import { inviteToProject, revokeInvitation, searchUserByEmail } from "@/app/actions/invitations";
import { ROLE_META, STAGE_META } from "@/lib/constants";
import type { ProjectRole, ProjectStage } from "@prisma/client";

export function CharterEditor({
  projectId,
  current,
  canEdit,
}: {
  projectId: string;
  current: {
    goal: string;
    targetUsers: string;
    scope: string;
    nonGoals: string;
    constraints: string;
    acceptance: string;
    version: number;
  };
  canEdit: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ ...current, note: "" });

  function save() {
    setError(null);
    start(async () => {
      const res = await updateCharter({
        projectId,
        goal: form.goal,
        targetUsers: form.targetUsers,
        scope: form.scope,
        nonGoals: form.nonGoals,
        constraints: form.constraints,
        acceptance: form.acceptance,
        note: form.note,
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else setError(res.error);
    });
  }

  if (!canEdit) {
    return <span className="text-[10.5px] text-[var(--muted)]">只有发起人或负责人可以修订章程</span>;
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-sm mt-4" onClick={() => setOpen(true)}>
        修订章程
      </button>
    );
  }

  return (
    <div className="mt-4 space-y-3 rounded-[10px] border border-[var(--accent)]/30 bg-[var(--surface-2)] p-4">
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-semibold">修订项目章程</span>
        <span className="mono text-[10.5px] text-[var(--amber)]">
          将生成 v{current.version + 1}，旧版本保留
        </span>
      </div>

      <Area label="项目目标" value={form.goal} onChange={(v) => setForm({ ...form, goal: v })} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Area label="目标用户" value={form.targetUsers} onChange={(v) => setForm({ ...form, targetUsers: v })} />
        <Area label="交付范围" value={form.scope} onChange={(v) => setForm({ ...form, scope: v })} />
        <Area label="非目标" value={form.nonGoals} onChange={(v) => setForm({ ...form, nonGoals: v })} />
        <Area label="硬性约束" value={form.constraints} onChange={(v) => setForm({ ...form, constraints: v })} />
      </div>
      <Area label="验收标准" value={form.acceptance} onChange={(v) => setForm({ ...form, acceptance: v })} />
      <Area
        label="本次变更说明（必填）"
        value={form.note}
        onChange={(v) => setForm({ ...form, note: v })}
      />

      {error && <p className="text-[11.5px] text-[var(--red)]">{error}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" className="btn" onClick={() => setOpen(false)}>
          取消
        </button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={pending || !form.note.trim()}>
          {pending ? "写入中…" : `保存为 v${current.version + 1}`}
        </button>
      </div>
      <p className="text-[10.5px] leading-relaxed text-[var(--muted)]">
        章程变更后，进行中的任务需要重新确认上下文；Agent 拉取上下文时会看到新版本号。
      </p>
    </div>
  );
}

export function StageControl({
  projectId,
  stage,
  canEdit,
}: {
  projectId: string;
  stage: ProjectStage;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState<ProjectStage>(stage);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!canEdit) return <span className="text-[11px] text-[var(--muted)]">—</span>;

  return (
    <div className="flex flex-col gap-1.5">
      <select
        className="select h-7 py-0 text-[11.5px]"
        value={value}
        onChange={(e) => setValue(e.target.value as ProjectStage)}
      >
        {(Object.keys(STAGE_META) as ProjectStage[]).map((s) => (
          <option key={s} value={s}>
            {STAGE_META[s].label}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="btn btn-xs w-full"
        disabled={pending || value === stage}
        onClick={() =>
          start(async () => {
            const res = await setProjectStage(projectId, value);
            if (res.ok) router.refresh();
            else setError(res.error);
          })
        }
      >
        {pending ? "应用中…" : "应用阶段"}
      </button>
      {error && <span className="text-[10px] text-[var(--red)]">{error}</span>}
    </div>
  );
}

export function MemberRoleSelect({
  projectId,
  userId,
  role,
  canEdit,
  isSelf,
}: {
  projectId: string;
  userId: string;
  role: ProjectRole;
  canEdit: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!canEdit) {
    return <span className="text-[11px] text-[var(--muted)]">{ROLE_META[role].label}</span>;
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        className="select h-7 w-[104px] py-0 text-[11.5px]"
        defaultValue={role}
        disabled={pending || isSelf}
        onChange={(e) =>
          start(async () => {
            const res = await setMemberRole(projectId, userId, e.target.value);
            if (res.ok) router.refresh();
            else setError(res.error);
          })
        }
      >
        {(["OWNER", "LEAD", "MEMBER", "REVIEWER", "OBSERVER"] as ProjectRole[]).map((r) => (
          <option key={r} value={r}>
            {ROLE_META[r].label}
          </option>
        ))}
      </select>
      {error && <span className="text-[10px] text-[var(--red)]">{error}</span>}
    </div>
  );
}

function Area({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="field">
      <span className="text-[11.5px] font-medium">{label}</span>
      <textarea
        className="textarea min-h-[56px] text-[12.5px]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/** 邀请成员：先按邮箱搜人，再发邀请；对方同意后才加入 */
export function MemberInvite({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [found, setFound] = useState<{ id: string; name: string; handle: string; color: string } | null>(null);
  const [role, setRole] = useState<ProjectRole>("MEMBER");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function search() {
    setError(null);
    setDone(null);
    setFound(null);
    start(async () => {
      const res = await searchUserByEmail(email);
      if (res.ok) setFound(res.user);
      else setError(res.error);
    });
  }

  function send() {
    if (!found) return;
    setError(null);
    start(async () => {
      const res = await inviteToProject({ projectId, email, role });
      if (res.ok) {
        setDone(`已向 ${res.name} 发出邀请，对方接受后才会成为成员`);
        setFound(null);
        setEmail("");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="mt-2 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input h-[28px] min-w-[200px] flex-1 py-0 text-[12px]"
          value={email}
          placeholder="对方注册用的邮箱"
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
            setDone(null);
            setFound(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && email.trim()) search();
          }}
        />
        <button
          type="button"
          disabled={pending || !email.trim()}
          onClick={search}
          className="btn btn-sm"
        >
          {pending && !found ? "查找中…" : "查找"}
        </button>
      </div>

      {found && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2">
          <span className="avatar" style={{ background: found.color, width: 22, height: 22, fontSize: 10 }}>
            {found.name.slice(0, 1)}
          </span>
          <span className="text-[12px] font-medium">{found.name}</span>
          <span className="mono text-[10.5px] text-[var(--muted)]">@{found.handle}</span>

          <select
            className="select ml-auto h-[26px] w-[92px] py-0 text-[11.5px]"
            value={role}
            onChange={(e) => setRole(e.target.value as ProjectRole)}
          >
            {(["LEAD", "MEMBER", "REVIEWER", "OBSERVER"] as ProjectRole[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_META[r].label}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-xs btn-primary" disabled={pending} onClick={send}>
            {pending ? "发送中…" : "发送邀请"}
          </button>
        </div>
      )}

      {error && <p className="mt-1 text-[10.5px] text-[var(--cf-danger)]">{error}</p>}
      {done && <p className="mt-1 text-[10.5px] text-[var(--cf-success)]">{done}</p>}
      <p className="mt-1 text-[10px] leading-relaxed text-[var(--muted)]">
        对方需要先注册过本站。发出邀请后，要等对方在「收到的邀请」里接受，才会加入项目。
        想直接给一群人发链接，用下面的「分享链接加入」。
      </p>
    </div>
  );
}

/** 已发出、等待对方处理的邀请 */
export function PendingInvites({
  items,
}: {
  items: { id: string; role: ProjectRole; invitee: { name: string; handle: string; color: string } }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (items.length === 0) return null;

  return (
    <div className="mt-2 space-y-1.5">
      <div className="text-[11px] font-medium text-[var(--muted)]">等待对方接受 · {items.length}</div>
      {items.map((inv) => (
        <div
          key={inv.id}
          className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-[var(--line)] px-2.5 py-1.5"
        >
          <span className="avatar" style={{ background: inv.invitee.color, width: 20, height: 20, fontSize: 9 }}>
            {inv.invitee.name.slice(0, 1)}
          </span>
          <span className="text-[11.5px] font-medium">{inv.invitee.name}</span>
          <span className="mono text-[10px] text-[var(--muted)]">@{inv.invitee.handle}</span>
          <span className="text-[10.5px] text-[var(--cf-text-tertiary)]">
            将作为{ROLE_META[inv.role].label}
          </span>
          <button
            type="button"
            className="ml-auto text-[10.5px] text-[var(--cf-danger)] hover:underline"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await revokeInvitation(inv.id);
                if (res.ok) router.refresh();
                else setError(res.error);
              })
            }
          >
            撤回
          </button>
        </div>
      ))}
      {error && <p className="text-[10.5px] text-[var(--cf-danger)]">{error}</p>}
    </div>
  );
}

/** 移除成员（只有发起人可见，且不能移除自己） */
export function RemoveMemberButton({
  projectId,
  userId,
  name,
}: {
  projectId: string;
  userId: string;
  name: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-[11px] text-[var(--cf-text-muted)] hover:text-[var(--cf-danger)]"
      >
        移除
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await removeMember(projectId, userId);
            if (res.ok) router.refresh();
            else setError(res.error);
          })
        }
        className="text-[11px] font-semibold text-[var(--cf-danger)]"
      >
        {pending ? "…" : `确认移除 ${name}`}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="text-[11px] text-[var(--cf-muted)]">
        取消
      </button>
      {error && <span className="text-[10px] text-[var(--cf-danger)]">{error}</span>}
    </span>
  );
}
