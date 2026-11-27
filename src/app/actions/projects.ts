"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { appendEvent } from "@/lib/events";
import { getTemplate } from "@/lib/templates";
import type { ProjectRole } from "@prisma/client";

/** 公开服务的默认配额：防止单个账号无限建项目、无限拉人 */
const MAX_PROJECTS_PER_USER = 10;
const MAX_MEMBERS_PER_PROJECT = 20;

const memberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["OWNER", "LEAD", "MEMBER", "REVIEWER", "OBSERVER"]),
});

const createSchema = z.object({
  name: z.string().trim().min(2, "项目名称至少 2 个字").max(60),
  key: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,6}$/, "项目代号为 2–6 位大写字母或数字"),
  summary: z.string().trim().max(200).default(""),
  goal: z.string().trim().min(4, "请写清项目要达成什么"),
  targetUsers: z.string().trim().min(2, "请写清目标用户"),
  scope: z.string().trim().min(2, "请写清交付范围"),
  nonGoals: z.string().trim().default(""),
  constraints: z.string().trim().default(""),
  acceptance: z.string().trim().min(4, "请写清可检查的验收标准"),
  decisionMakerId: z.string().min(1),
  members: z.array(memberSchema).min(1, "至少需要一位成员"),
  milestone: z.string().trim().max(60).optional().default(""),
  templateId: z.string().optional().nullable(),
});

export type CreateProjectInput = z.input<typeof createSchema>;

export type ActionResult =
  | { ok: true; projectId: string }
  | { ok: false; error: string };

export async function createProject(input: CreateProjectInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "表单校验失败" };
  }
  const data = parsed.data;

  const ownedCount = await prisma.membership.count({
    where: { userId: user.id, role: "OWNER" },
  });
  if (ownedCount >= MAX_PROJECTS_PER_USER) {
    return { ok: false, error: `每个账号最多创建 ${MAX_PROJECTS_PER_USER} 个项目` };
  }
  if (data.members.length > MAX_MEMBERS_PER_PROJECT) {
    return { ok: false, error: `单个项目最多 ${MAX_MEMBERS_PER_PROJECT} 名成员` };
  }

  // 项目代号唯一：冲突时自动追加序号，而不是让用户猜哪个值可用
  let key = data.key;
  for (let i = 2; i < 20; i++) {
    const exists = await prisma.project.findUnique({ where: { key } });
    if (!exists) break;
    key = `${data.key.slice(0, 5)}${i}`;
  }

  // 保证当前操作者一定在成员列表里，且角色最高
  const members = [...data.members];
  if (!members.some((m) => m.userId === user.id)) {
    members.push({ userId: user.id, role: "OWNER" });
  }

  const projectId = await prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        name: data.name,
        key,
        summary: data.summary,
        stage: "DEFINE",
      },
    });

    await tx.charter.create({
      data: {
        projectId: project.id,
        version: 1,
        goal: data.goal,
        targetUsers: data.targetUsers,
        scope: data.scope,
        nonGoals: data.nonGoals,
        constraints: data.constraints,
        acceptance: data.acceptance,
        decisionMakerId: data.decisionMakerId,
        note: "初始章程",
        createdById: user.id,
      },
    });

    await tx.membership.createMany({
      data: members.map((m) => ({
        projectId: project.id,
        userId: m.userId,
        role: m.role as ProjectRole,
      })),
    });

    // 模板只预填定义：任务停在「待认领」，负责人与就绪状态仍要人推进
    const template = getTemplate(data.templateId);
    if (template) {
      const milestoneIds: string[] = [];
      for (const [i, title] of template.milestones.entries()) {
        const m = await tx.milestone.create({
          data: {
            projectId: project.id,
            title,
            sort: i,
            status: i === 0 ? "ACTIVE" : "PLANNED",
          },
        });
        milestoneIds.push(m.id);
      }

      // 不替人分工：模板任务一律停在「待认领」，
      // 由负责人分配，或成员自己点「我来做」认领。
      const taskIds: string[] = [];
      for (const t of template.tasks) {
        const initialStatus = "UNCLAIMED";
        const created = await tx.task.create({
          data: {
            projectId: project.id,
            title: t.title,
            description: t.description,
            inputs: t.inputs,
            scope: t.scope,
            nonScope: t.nonScope,
            acceptance: t.acceptance,
            priority: t.priority,
            weight: t.weight,
            status: initialStatus,
            assigneeId: null,
            milestoneId: t.milestone != null ? milestoneIds[t.milestone] : null,
          },
        });
        taskIds.push(created.id);

        await appendEvent(tx, {
          projectId: project.id,
          type: "task.created",
          actorId: user.id,
          subjectType: "task",
          subjectId: created.id,
          payload: { title: t.title, status: initialStatus, template: template.id },
        });
      }

      for (const [i, t] of template.tasks.entries()) {
        for (const dep of t.dependsOn ?? []) {
          await tx.taskDependency.create({
            data: { taskId: taskIds[i], dependsOnTaskId: taskIds[dep] },
          });
        }
      }

      await tx.message.create({
        data: {
          projectId: project.id,
          channel: "general",
          type: "SYSTEM",
          authorId: user.id,
          body: `已从模板「${template.name}」生成 ${template.tasks.length} 个任务与 ${template.milestones.length} 个里程碑。任务停在「待认领」，负责人分配或成员认领后即可推进。`,
        },
      });
    } else if (data.milestone) {
      await tx.milestone.create({
        data: { projectId: project.id, title: data.milestone, status: "ACTIVE" },
      });
    }

    await tx.message.create({
      data: {
        projectId: project.id,
        channel: "general",
        type: "SYSTEM",
        authorId: user.id,
        body: `${user.name} 创建了项目「${data.name}」，项目章程 v1 已写入事实层。`,
      },
    });

    await appendEvent(tx, {
      projectId: project.id,
      type: "project.created",
      actorId: user.id,
      subjectType: "project",
      subjectId: project.id,
      payload: { name: data.name, key, stage: "DEFINE" },
    });
    await appendEvent(tx, {
      projectId: project.id,
      type: "charter.updated",
      actorId: user.id,
      subjectType: "charter",
      subjectId: project.id,
      payload: {
        version: 1,
        goal: data.goal,
        acceptance: data.acceptance,
      },
    });

    return project.id;
  });

  revalidatePath("/");
  return { ok: true, projectId };
}

const charterSchema = z.object({
  projectId: z.string().min(1),
  goal: z.string().trim().min(4),
  targetUsers: z.string().trim().min(2),
  scope: z.string().trim().min(2),
  nonGoals: z.string().trim().default(""),
  constraints: z.string().trim().default(""),
  acceptance: z.string().trim().min(4),
  note: z.string().trim().min(2, "请填写这一版为什么改"),
});

/** 目标变更生成新版本，旧版本不可静默覆盖（§6.1） */
export async function updateCharter(input: z.input<typeof charterSchema>) {
  const user = await requireUser();
  const parsed = charterSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "校验失败" };
  }
  const d = parsed.data;

  const membership = await prisma.membership.findUnique({
    where: { projectId_userId: { projectId: d.projectId, userId: user.id } },
  });
  if (!membership || !["OWNER", "LEAD"].includes(membership.role)) {
    return { ok: false as const, error: "只有发起人或负责人可以修改项目章程" };
  }

  const latest = await prisma.charter.findFirst({
    where: { projectId: d.projectId },
    orderBy: { version: "desc" },
  });
  if (!latest) return { ok: false as const, error: "项目章程不存在" };

  const nextVersion = latest.version + 1;

  await prisma.$transaction(async (tx) => {
    await tx.charter.create({
      data: {
        projectId: d.projectId,
        version: nextVersion,
        goal: d.goal,
        targetUsers: d.targetUsers,
        scope: d.scope,
        nonGoals: d.nonGoals,
        constraints: d.constraints,
        acceptance: d.acceptance,
        decisionMakerId: latest.decisionMakerId,
        note: d.note,
        createdById: user.id,
      },
    });
    await tx.message.create({
      data: {
        projectId: d.projectId,
        channel: "general",
        type: "SYSTEM",
        authorId: user.id,
        body: `项目章程升级到 v${nextVersion}：${d.note}。正在执行的任务需要重新确认上下文。`,
      },
    });
    await appendEvent(tx, {
      projectId: d.projectId,
      type: "charter.updated",
      actorId: user.id,
      subjectType: "charter",
      subjectId: d.projectId,
      payload: {
        version: nextVersion,
        previousVersion: latest.version,
        note: d.note,
        goal: d.goal,
      },
    });

    // 目标变化后，未完成任务的上下文失效，标记需要重新确认
    await tx.task.updateMany({
      where: {
        projectId: d.projectId,
        status: { notIn: ["DONE", "CANCELLED"] },
      },
      data: { updatedAt: new Date() },
    });
  });

  revalidatePath(`/projects/${d.projectId}`, "layout");
  return { ok: true as const, version: nextVersion };
}

export async function setProjectStage(projectId: string, stage: string) {
  const user = await requireUser();
  const membership = await prisma.membership.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  });
  if (!membership || !["OWNER", "LEAD"].includes(membership.role)) {
    return { ok: false as const, error: "没有权限" };
  }
  const allowed = ["DEFINE", "BUILD", "INTEGRATE", "REVIEW", "ARCHIVED"];
  if (!allowed.includes(stage)) return { ok: false as const, error: "非法阶段" };

  await prisma.$transaction(async (tx) => {
    await tx.project.update({ where: { id: projectId }, data: { stage: stage as never } });
    await appendEvent(tx, {
      projectId,
      type: "project.stage_changed",
      actorId: user.id,
      subjectType: "project",
      subjectId: projectId,
      payload: { stage },
    });
  });
  revalidatePath(`/projects/${projectId}`, "layout");
  return { ok: true as const };
}

export async function setMemberRole(projectId: string, userId: string, role: string) {
  const user = await requireUser();
  const me = await prisma.membership.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  });
  if (!me || me.role !== "OWNER") return { ok: false as const, error: "只有项目发起人可以调整角色" };
  if (!["OWNER", "LEAD", "MEMBER", "REVIEWER", "OBSERVER"].includes(role)) {
    return { ok: false as const, error: "非法角色" };
  }
  if (userId === user.id && role !== "OWNER") {
    return { ok: false as const, error: "项目必须保留一位发起人" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.membership.update({
      where: { projectId_userId: { projectId, userId } },
      data: { role: role as ProjectRole },
    });
    await appendEvent(tx, {
      projectId,
      type: "permission.changed",
      actorId: user.id,
      subjectType: "membership",
      subjectId: userId,
      payload: { role },
    });
  });
  revalidatePath(`/projects/${projectId}`, "layout");
  return { ok: true as const };
}


/** 删除项目：只有发起人能做，级联删除项目下的任务、事件、产物等数据 */
export async function deleteProject(projectId: string) {
  const user = await requireUser();
  const membership = await prisma.membership.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  });
  if (!membership || membership.role !== "OWNER") {
    return { ok: false as const, error: "只有项目发起人可以删除项目" };
  }

  await prisma.project.delete({ where: { id: projectId } });
  revalidatePath("/");
  return { ok: true as const };
}

/** 移除成员：只有发起人能做，且不能移除自己 */
export async function removeMember(projectId: string, userId: string) {
  const user = await requireUser();
  if (userId === user.id) {
    return { ok: false as const, error: "不能把自己移出项目" };
  }
  const me = await prisma.membership.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  });
  if (!me || me.role !== "OWNER") {
    return { ok: false as const, error: "只有项目发起人可以移除成员" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.membership.delete({
      where: { projectId_userId: { projectId, userId } },
    });
    await appendEvent(tx, {
      projectId,
      type: "permission.changed",
      actorId: user.id,
      subjectType: "membership",
      subjectId: userId,
      payload: { action: "removed" },
    });
  });

  revalidatePath(`/projects/${projectId}`, "layout");
  return { ok: true as const };
}

/**
 * 快速建项目：只要求填名字。
 * 代号自动生成、章程字段取模板默认值、成员只有自己，
 * 目的就是让第一次用的人三十秒内看到一个能点的项目。
 */
export async function quickCreateProject(input: {
  name: string;
  templateId?: string | null;
  goal?: string;
}) {
  const user = await requireUser();
  const name = input.name.trim();
  if (name.length < 2) return { ok: false as const, error: "项目名称至少 2 个字" };

  const template = getTemplate(input.templateId);

  const clean = (t?: string | null) => {
    if (!t) return "";
    return t
      .replace(/<项目名>/g, name)
      .replace(/<[^>]*>/g, "")
      .replace(/[:：]\s*$/, "")
      .trim();
  };

  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const randomKey = () =>
    "P" + Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");

  let key = randomKey();
  for (let i = 0; i < 20; i++) {
    if (!(await prisma.project.findUnique({ where: { key } }))) break;
    key = randomKey();
  }

  return createProject({
    name,
    key,
    summary: template?.tagline ?? "",
    goal: clean(input.goal?.trim() || template?.charter.goal) || `${name}的首个可用版本`,
    targetUsers: clean(template?.charter.targetUsers) || "待补充",
    scope: clean(template?.charter.scope) || "待补充",
    nonGoals: clean(template?.charter.nonGoals),
    constraints: clean(template?.charter.constraints),
    acceptance: clean(template?.charter.acceptance) || "待补充",
    decisionMakerId: user.id,
    members: [{ userId: user.id, role: "OWNER" as const }],
    templateId: input.templateId ?? null,
    milestone: "",
  });
}

/** 开启加入：生成一个邀请码，别人凭码加入 */
export async function enableInvite(projectId: string) {
  const user = await requireUser();
  const me = await prisma.membership.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  });
  if (!me || me.role !== "OWNER") {
    return { ok: false as const, error: "只有项目发起人可以开启加入" };
  }

  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const code = Array.from(
    { length: 8 },
    () => alphabet[Math.floor(Math.random() * alphabet.length)]
  ).join("");

  await prisma.project.update({ where: { id: projectId }, data: { inviteCode: code } });
  revalidatePath(`/projects/${projectId}`, "layout");
  return { ok: true as const, code };
}

/** 关闭加入：邀请码立即失效 */
export async function disableInvite(projectId: string) {
  const user = await requireUser();
  const me = await prisma.membership.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  });
  if (!me || me.role !== "OWNER") {
    return { ok: false as const, error: "只有项目发起人可以关闭加入" };
  }

  await prisma.project.update({ where: { id: projectId }, data: { inviteCode: null } });
  revalidatePath(`/projects/${projectId}`, "layout");
  return { ok: true as const };
}

/** 凭邀请码加入项目 */
export async function joinByInvite(rawCode: string) {
  const user = await requireUser();
  const code = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length < 6) return { ok: false as const, error: "邀请码格式不对" };

  const project = await prisma.project.findUnique({ where: { inviteCode: code } });
  if (!project) return { ok: false as const, error: "邀请码无效或已关闭" };

  const exists = await prisma.membership.findUnique({
    where: { projectId_userId: { projectId: project.id, userId: user.id } },
  });
  if (exists) return { ok: true as const, projectId: project.id, already: true };

  const count = await prisma.membership.count({ where: { projectId: project.id } });
  if (count >= MAX_MEMBERS_PER_PROJECT) {
    return { ok: false as const, error: "这个项目成员已满" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.membership.create({
      data: { projectId: project.id, userId: user.id, role: "MEMBER" as ProjectRole },
    });
    await appendEvent(tx, {
      projectId: project.id,
      type: "permission.changed",
      actorId: user.id,
      subjectType: "membership",
      subjectId: user.id,
      payload: { role: "MEMBER", action: "joined" },
    });
  });

  revalidatePath("/");
  revalidatePath(`/projects/${project.id}`, "layout");
  return { ok: true as const, projectId: project.id, already: false };
}
