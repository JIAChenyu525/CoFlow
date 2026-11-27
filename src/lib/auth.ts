import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ProjectRole } from "@prisma/client";
import { prisma } from "./db";
import { ADMIN_ROLES, REVIEW_ROLES } from "./constants";

export const SESSION_COOKIE = "coflow_session";
/** 会话有效期：30 天，期间每次访问会顺延 lastSeenAt */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function hashToken(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function newToken() {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * 身份的唯一来源是会话表，不是 Cookie 里的用户 ID。
 * Cookie 只放不透明 token，库里存哈希——泄库不等于泄会话。
 */
export async function getCurrentSession() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: true },
  });
  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt < new Date()) return null;

  return session;
}

export async function getSessionUser() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: true },
  });
  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt < new Date()) return null;

  // 节流更新，避免每个请求都写库
  if (Date.now() - session.lastSeenAt.getTime() > 10 * 60 * 1000) {
    await prisma.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    });
  }

  return session.user;
}

export async function getCurrentUser() {
  return getSessionUser();
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function getMembership(projectId: string, userId: string) {
  return prisma.membership.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
}

export function canWrite(role: ProjectRole | undefined) {
  return !!role && role !== "OBSERVER";
}

export function canReview(role: ProjectRole | undefined) {
  return !!role && REVIEW_ROLES.includes(role);
}

export function canAdmin(role: ProjectRole | undefined) {
  return !!role && ADMIN_ROLES.includes(role);
}

/** Agent 权限不得超过所属成员（§9.3），阶段一先落成角色判定。 */
export async function requireMembership(projectId: string, min: "write" | "review" | "admin") {
  const user = await requireUser();
  const membership = await getMembership(projectId, user.id);
  const ok =
    min === "write" ? canWrite(membership?.role)
    : min === "review" ? canReview(membership?.role)
    : canAdmin(membership?.role);
  if (!ok) throw new Error("当前身份没有执行该操作的权限");
  return { user, membership: membership! };
}
