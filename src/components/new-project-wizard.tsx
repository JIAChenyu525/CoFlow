"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createProject } from "@/app/actions/projects";
import { ROLE_META } from "@/lib/constants";
import { getTemplate, TEMPLATES } from "@/lib/templates";
import type { ProjectRole } from "@prisma/client";

type UserLite = { id: string; name: string; color: string; handle: string };

const STEPS = [
  { key: "basic", title: "基本信息", hint: "项目叫什么，给谁看" },
  { key: "goal", title: "目标与范围", hint: "北极星、交付边界、硬约束" },
  { key: "accept", title: "验收标准", hint: "什么叫做完了" },
  { key: "team", title: "成员与角色", hint: "谁负责，谁验收" },
  { key: "agent", title: "Agent 接入", hint: "阶段二能力，先做决定" },
];

const ROLES: ProjectRole[] = ["OWNER", "LEAD", "MEMBER", "REVIEWER", "OBSERVER"];

export function NewProjectWizard({
  users,
  currentUser,
}: {
  users: UserLite[];
  currentUser: { id: string; name: string; color: string };
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const [templateId, setTemplateId] = useState("blank");
  const template = getTemplate(templateId);

  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [summary, setSummary] = useState("");
  const [goal, setGoal] = useState("");
  const [targetUsers, setTargetUsers] = useState("");
  const [scope, setScope] = useState("");
  const [nonGoals, setNonGoals] = useState("");
  const [constraints, setConstraints] = useState("");
  const [acceptance, setAcceptance] = useState("");
  const [milestone, setMilestone] = useState("");
  const [roles, setRoles] = useState<Record<string, ProjectRole>>(() => {
    const init: Record<string, ProjectRole> = { [currentUser.id]: "OWNER" };
    return init;
  });

  const others = users.filter((u) => u.id !== currentUser.id);
  const selectedCount = Object.keys(roles).length;

  const stepValid = useMemo(() => {
    if (step === 0) return name.trim().length >= 2 && /^[A-Za-z0-9]{2,6}$/.test(key.trim());
    if (step === 1) return goal.trim().length >= 4 && targetUsers.trim().length >= 2 && scope.trim().length >= 2;
    if (step === 2) return acceptance.trim().length >= 4;
    if (step === 3) return selectedCount >= 1;
    return true;
  }, [step, name, key, goal, targetUsers, scope, acceptance, selectedCount]);

  /** 选模板只是预填，之后随便改；选「空白」不会清空已填内容 */
  function applyTemplate(id: string) {
    setTemplateId(id);
    const t = getTemplate(id);
    if (!t) return;
    setSummary(t.tagline);
    setGoal(t.charter.goal);
    setTargetUsers(t.charter.targetUsers);
    setScope(t.charter.scope);
    setNonGoals(t.charter.nonGoals);
    setConstraints(t.charter.constraints);
    setAcceptance(t.charter.acceptance);
    setMilestone("");
  }

  function toggleMember(id: string) {
    setRoles((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = "MEMBER";
      return next;
    });
  }

  function submit() {
    setError(null);
    start(async () => {
      const res = await createProject({
        name,
        key: key.toUpperCase(),
        summary,
        goal,
        targetUsers,
        scope,
        nonGoals,
        constraints,
        acceptance,
        decisionMakerId: currentUser.id,
        milestone,
        templateId: templateId === "blank" ? null : templateId,
        members: Object.entries(roles).map(([userId, role]) => ({ userId, role })),
      });
      if (res.ok) {
        router.push(`/projects/${res.projectId}`);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="mt-6 grid gap-6 md:grid-cols-[210px_1fr]">
      {/* 步骤轨 */}
      <ol className="flex gap-2 overflow-x-auto md:flex-col md:gap-0 md:overflow-visible">
        {STEPS.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <li key={s.key} className="flex-1 md:flex-none">
              <button
                type="button"
                onClick={() => i <= step && setStep(i)}
                className={`flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left transition ${
                  active ? "bg-[var(--surface)]" : "hover:bg-[var(--surface-2)]"
                }`}
              >
                <span
                  className={`mono mt-0.5 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border text-[10.5px] font-semibold ${
                    active
                      ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                      : done
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                        : "border-[var(--line-strong)] text-[var(--muted)]"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </span>
                <span className="hidden min-w-0 md:block">
                  <span
                    className={`block text-[12.5px] font-semibold ${
                      active ? "text-[var(--ink)]" : "text-[var(--ink-2)]"
                    }`}
                  >
                    {s.title}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-[var(--muted)]">
                    {s.hint}
                  </span>
                </span>
                <span className="text-[12px] font-medium md:hidden">{s.title}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* 表单面板 */}
      <div className="card p-6">
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-[12.5px] font-semibold">从模板开始</span>
                <span className="text-[11px] text-[var(--muted)]">
                  只预填章程与任务清单，之后随便改
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setTemplateId("blank")}
                  className={`rounded-lg border px-3 py-2 text-left transition ${
                    templateId === "blank"
                      ? "border-[var(--accent)] bg-[var(--accent-soft)]/40"
                      : "border-[var(--line)] hover:border-[var(--line-strong)]"
                  }`}
                >
                  <div className="text-[12.5px] font-semibold">空白项目</div>
                  <div className="mt-0.5 text-[11px] leading-relaxed text-[var(--muted)]">
                    自己写章程和任务
                  </div>
                </button>
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => applyTemplate(t.id)}
                    className={`rounded-lg border px-3 py-2 text-left transition ${
                      templateId === t.id
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]/40"
                        : "border-[var(--line)] hover:border-[var(--line-strong)]"
                    }`}
                  >
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[12.5px] font-semibold">{t.name}</span>
                      <span className="tag">{t.tasks.length} 任务</span>
                    </div>
                    <div className="mt-0.5 text-[11px] leading-relaxed text-[var(--muted)]">
                      {t.tagline}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <Field label="项目名称" required hint="用可交付的产物命名，别写“优化一下”">
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：双人打卡应用「朝夕相伴」"
                autoFocus
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-[150px_1fr]">
              <Field label="项目代号" required>
                <input
                  className="input mono uppercase"
                  value={key}
                  maxLength={6}
                  onChange={(e) => setKey(e.target.value.replace(/[^A-Za-z0-9]/g, ""))}
                  placeholder="如 ZX"
                />
              </Field>
              <Field label="一句话说明" hint="团队简介，可后改">
                <input
                  className="input"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="给需要共同记录生活的双人用户"
                />
              </Field>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <Field label="项目目标" required hint="希望达成的结果，不是动作列表">
              <textarea
                className="textarea"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="完成可供双人实际使用的打卡应用首个版本，核心流程包括连续打卡提醒、睡前图片上传和照片共享。"
                autoFocus
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="目标用户" required hint="为谁解决什么问题">
                <textarea
                  className="textarea"
                  style={{ minHeight: 64 }}
                  value={targetUsers}
                  onChange={(e) => setTargetUsers(e.target.value)}
                  placeholder="需要共同记录生活的双人用户"
                />
              </Field>
              <Field label="交付范围" required hint="本阶段必须包含什么">
                <textarea
                  className="textarea"
                  style={{ minHeight: 64 }}
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  placeholder="打卡、提醒、图片上传、共享"
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="非目标" hint="明确不做什么，防止范围漂移">
                <textarea
                  className="textarea"
                  style={{ minHeight: 64 }}
                  value={nonGoals}
                  onChange={(e) => setNonGoals(e.target.value)}
                  placeholder="社区、公开动态、复杂商城"
                />
              </Field>
              <Field label="硬性约束" hint="技术、设计、时间或合规约束">
                <textarea
                  className="textarea"
                  style={{ minHeight: 64 }}
                  value={constraints}
                  onChange={(e) => setConstraints(e.target.value)}
                  placeholder="适配小米与 iPhone、视觉采用可爱粉色主题、界面不使用 emoji"
                />
              </Field>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <Field
              label="验收标准"
              required
              hint="逐条可检查。任务完成时，证据要能对上这些条目"
            >
              <textarea
                className="textarea"
                style={{ minHeight: 110 }}
                value={acceptance}
                onChange={(e) => setAcceptance(e.target.value)}
                placeholder={
                  "1. 双端安装后能完成一次完整打卡\n2. 睡前图片上传成功且对方可见\n3. 连续打卡提醒在约定时间触发"
                }
                autoFocus
              />
            </Field>
            {template ? (
              <div className="rounded-md border border-[var(--accent)]/25 bg-[var(--accent-soft)]/30 px-3 py-2 text-[11.5px] leading-relaxed text-[var(--ink-2)]">
                模板「{template.name}」会生成 {template.milestones.length} 个里程碑（
                {template.milestones.join(" / ")}）和 {template.tasks.length} 个任务，无需再填首个里程碑。
              </div>
            ) : (
              <Field label="首个里程碑" hint="可选，创建后可在任务页调整">
                <input
                  className="input"
                  value={milestone}
                  onChange={(e) => setMilestone(e.target.value)}
                  placeholder="M1 · 核心流程可跑通"
                />
              </Field>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg bg-[var(--accent-soft)] px-3 py-2 text-[12px] text-[var(--accent-ink)]">
              <span className="mono font-semibold">OWNER</span>
              {currentUser.name} 将作为项目发起人，拥有目标决策权与最终验收权。
            </div>

            <div className="space-y-1">
              <div className="label mb-1">邀请成员</div>
              {others.map((u) => {
                const selected = !!roles[u.id];
                return (
                  <div
                    key={u.id}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition ${
                      selected
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]/40"
                        : "border-[var(--line)] hover:bg-[var(--surface-2)]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleMember(u.id)}
                      className="h-3.5 w-3.5 accent-[var(--accent)]"
                    />
                    <span
                      className="avatar"
                      style={{ background: u.color }}
                    >
                      {u.name.slice(0, 1)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium">{u.name}</span>
                      <span className="mono block text-[11px] text-[var(--muted)]">@{u.handle}</span>
                    </span>
                    {selected && (
                      <select
                        className="select h-[28px] w-[150px] py-0 text-[12px]"
                        value={roles[u.id]}
                        onChange={(e) =>
                          setRoles((prev) => ({ ...prev, [u.id]: e.target.value as ProjectRole }))
                        }
                      >
                        {ROLES.filter((r) => r !== "OWNER").map((r) => (
                          <option key={r} value={r}>
                            {ROLE_META[r].label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-[11.5px] leading-relaxed text-[var(--muted)]">
              观察员只能查看；评审只能做验收结论；负责人可以拆解、派发与改阶段。角色决定的是事实层的写入权限，不是头衔。
            </p>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-4">
              <div className="flex items-center gap-2">
                <span className="pill pill--slate">阶段二</span>
                <span className="text-[13px] font-semibold">零密钥 Agent 接入</span>
              </div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--ink-2)]">
                成员安装本地 Connector 后，平台只识别本机工具类型与能力，不读取、不保存任何模型
                API Key。工具授权仍归原工具（例如 Claude Code + DeepSeek 由它自己管登录与配置），
                CoFlow 只管项目授权：这个端点能进哪个项目、读哪些任务、写哪些目录、回传哪些事件。
              </p>
              <p className="mt-2 text-[12px] leading-relaxed text-[var(--muted)]">
                当前版本只做事实闭环，还没有连接器。项目建好后，成员仍可用“人工回传”把产物与结果提交上来。
              </p>
            </div>

            <div className="space-y-2">
              <div className="label">本次创建将写入</div>
              {[
                ["项目", `${name || "（未命名）"} · ${key || "代号"}`],
                ["章程", "v1 · 目标 / 范围 / 非目标 / 约束 / 验收标准"],
                ["成员", `${selectedCount} 人`],
                [
                  "模板",
                  template
                    ? `${template.name} · ${template.tasks.length} 任务 + ${template.milestones.length} 里程碑`
                    : "空白 · 无预置任务",
                ],
                [
                  "事件",
                  template
                    ? `project.created · charter.updated · task.created × ${template.tasks.length}`
                    : "project.created · charter.updated",
                ],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3 border-b border-[var(--line)] pb-1.5 text-[12.5px]">
                  <span className="text-[var(--muted)]">{k}</span>
                  <span className="text-right font-medium">{v}</span>
                </div>
              ))}
            </div>

            {error && (
              <div className="rounded-lg bg-[var(--red-soft)] px-3 py-2 text-[12px] text-[var(--red)]">
                {error}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-[var(--line)] pt-4">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || pending}
          >
            上一步
          </button>
          <div className="flex items-center gap-2">
            <span className="mono text-[11px] text-[var(--muted)]">
              {step + 1} / {STEPS.length}
            </span>
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={!stepValid}
                onClick={() => setStep((s) => s + 1)}
              >
                下一步
              </button>
            ) : (
              <button type="button" className="btn btn-primary" disabled={pending} onClick={submit}>
                {pending ? "正在写入事实层…" : "创建项目"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="field block">
      <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
        <span className="text-[12.5px] font-semibold">{label}</span>
        {required && <span className="text-[11px] text-[var(--red)]">必填</span>}
        {hint && (
          <span className="ml-auto text-right text-[11px] leading-snug text-[var(--muted)]">
            {hint}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}
