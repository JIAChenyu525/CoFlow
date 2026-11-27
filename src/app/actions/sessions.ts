"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentSession, requireUser, SESSION_COOKIE } from "@/lib/auth";

/** 撤销自己账号下的某一条会话 */
export async function revokeSession(sessionId: string) {
  const user = await requireUser();
  const target = await prisma.session.findUnique({ where: { id: sessionId } });

  if (!target || target.userId !== user.id) {
    return { ok: false as const, error: "会话不存在" };
  }

  const current = await getCurrentSession();
  const isCurrent = current?.id === target.id;

  await prisma.session.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });

  if (isCurrent) {
    // 撤销的就是当前这条：清掉 Cookie 并回登录页
    const jar = await cookies();
    jar.delete(SESSION_COOKIE);
    redirect("/login");
  }

  revalidatePath("/account");
  return { ok: true as const };
}

/** 退出除当前设备外的所有会话 */
export async function revokeOtherSessions() {
  const current = await getCurrentSession();
  if (!current) return { ok: false as const, error: "当前会话已失效" };

  const res = await prisma.session.updateMany({
    where: { userId: current.userId, revokedAt: null, NOT: { id: current.id } },
    data: { revokedAt: new Date() },
  });

  revalidatePath("/account");
  return { ok: true as const, revoked: res.count };
}
