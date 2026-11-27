"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { appendEvent } from "@/lib/events";
import type { ProjectRole } from "@prisma/client";

const MAX_MEMBERS_PER_PROJECT = 20;
const INVITABLE_ROLES: ProjectRole[] = ["LEAD", "MEMBER", "REVIEWER", "OBSERVER"];

/** 按邮箱精确查找已注册用户；只返回展示所需的最小信息 */
export async function searchUserByEmail(raw: string) {
  const me = await requireUser();
  const email = raw.trim().toLowerCase();

  if (!email.includes("@")) {
    return { ok: false as const, error: "请输入完整邮箱地址" };
  }

  const target = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, handle: true, color: true },
  });
  if (!target) return { ok: false as const, error: "这个邮箱还没有在本站注册" };
  if (target.id === me.id) return { ok: false as const, error: "不能邀请自己" };

  return { ok: true as const, user: target };
}

/** 发送邀请：只是登记一条待确认的邀请，对方同意后才真正成为成员 */
export async function inviteToProject(input: {
  projectId: string;
  email: string;
  role?: ProjectRole;
  message?: string;
}) {
  const me = await requireUser();
  const membership = await prisma.membership.findUnique({
    where: { projectId_userId: { projectId: input.projectId, userId: me.id } },
  });
  if (!membership || !["OWNER", "LEAD"].includes(membership.role)) {
    return { ok: false as const, error: "只有发起人或负责人可以邀请成员" };
  }

  const role = input.role ?? "MEMBER";
  if (!INVITABLE_ROLES.includes(role)) {
    return { ok: false as const, error: "这个角色不能通过邀请授予" };
  }

  const email = input.email.trim().toLowerCase();
  const target = await prisma.user.findUnique({ where: { email } });
  if (!target) return { ok: false as const, error: "这个邮箱还没有在本站注册" };
  if (target.id === me.id) return { ok: false as const, error: "不能邀请自己" };

  const already = await prisma.membership.findUnique({
    where: { projectId_userId: { projectId: input.projectId, userId: target.id } },
  });
  if (already) return { ok: false as const, error: `${target.name} 已经是项目成员` };

  const count = await prisma.membership.count({ where: { projectId: input.projectId } });
  if (count >= MAX_MEMBERS_PER_PROJECT) {
    return { ok: false as const, error: "这个项目成员已满" };
  }

  const existing = await prisma.projectInvitation.findUnique({
    where: { projectId_inviteeId: { projectId: input.projectId, inviteeId: target.id } },
  });
  if (existing?.status === "PENDING") {
    return { ok: false as const, error: `已经邀请过 ${target.name}，等待对方接受` };
  }

  const invitation = await prisma.projectInvitation.upsert({
    where: { projectId_inviteeId: { projectId: input.projectId, inviteeId: target.id } },
    create: {
      projectId: input.projectId,
      inviterId: me.id,
      inviteeId: target.id,
      role,
      message: input.message?.trim() || null,
      status: "PENDING",
    },
    update: {
      inviterId: me.id,
      role,
      message: input.message?.trim() || null,
      status: "PENDING",
      respondedAt: null,
      createdAt: new Date(),
    },
  });

  await prisma.$transaction(async (tx) => {
    await appendEvent(tx, {
      projectId: input.projectId,
      type: "permission.changed",
      actorId: me.id,
      subjectType: "invitation",
      subjectId: invitation.id,
      payload: { action: "invited", inviteeId: target.id, role },
    });
  });

  revalidatePath(`/projects/${input.projectId}`, "layout");
  revalidatePath("/invitations");
  return { ok: true as const, name: target.name };
}

/** 被邀请人处理邀请：接受才创建成员关系 */
export async function respondInvitation(invitationId: string, accept: boolean) {
  const me = await requireUser();
  const invitation = await prisma.projectInvitation.findUnique({
    where: { id: invitationId },
    include: { project: { select: { name: true } } },
  });
  if (!invitation || invitation.inviteeId !== me.id) {
    return { ok: false as const, error: "找不到这条邀请" };
  }
  if (invitation.status !== "PENDING") {
    return { ok: false as const, error: "这条邀请已经处理过了" };
  }

  if (!accept) {
    await prisma.projectInvitation.update({
      where: { id: invitationId },
      data: { status: "DECLINED", respondedAt: new Date() },
    });
    revalidatePath("/invitations");
    revalidatePath("/");
    return { ok: true as const, projectId: null };
  }

  const count = await prisma.membership.count({ where: { projectId: invitation.projectId } });
  if (count >= MAX_MEMBERS_PER_PROJECT) {
    return { ok: false as const, error: "这个项目成员已满，请联系邀请人" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.projectInvitation.update({
      where: { id: invitationId },
      data: { status: "ACCEPTED", respondedAt: new Date() },
    });
    const exists = await tx.membership.findUnique({
      where: { projectId_userId: { projectId: invitation.projectId, userId: me.id } },
    });
    if (!exists) {
      await tx.membership.create({
        data: {
          projectId: invitation.projectId,
          userId: me.id,
          role: invitation.role,
        },
      });
    }
    await appendEvent(tx, {
      projectId: invitation.projectId,
      type: "permission.changed",
      actorId: me.id,
      subjectType: "membership",
      subjectId: me.id,
      payload: { action: "joined_via_invitation", role: invitation.role },
    });
  });

  revalidatePath("/");
  revalidatePath("/invitations");
  revalidatePath(`/projects/${invitation.projectId}`, "layout");
  return { ok: true as const, projectId: invitation.projectId };
}

/** 邀请人撤回邀请 */
export async function revokeInvitation(invitationId: string) {
  const me = await requireUser();
  const invitation = await prisma.projectInvitation.findUnique({
    where: { id: invitationId },
  });
  if (!invitation) return { ok: false as const, error: "找不到这条邀请" };

  const membership = await prisma.membership.findUnique({
    where: { projectId_userId: { projectId: invitation.projectId, userId: me.id } },
  });
  const canRevoke =
    invitation.inviterId === me.id || membership?.role === "OWNER";
  if (!canRevoke) return { ok: false as const, error: "没有权限撤回这条邀请" };
  if (invitation.status !== "PENDING") {
    return { ok: false as const, error: "这条邀请已经处理过了" };
  }

  await prisma.projectInvitation.update({
    where: { id: invitationId },
    data: { status: "REVOKED", respondedAt: new Date() },
  });

  revalidatePath(`/projects/${invitation.projectId}`, "layout");
  revalidatePath("/invitations");
  return { ok: true as const };
}
