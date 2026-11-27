"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

/**
 * 选一个端点作为「我的私人助手」。
 * 只是个人偏好，不影响权限：派发时仍然由人显式选择端点。
 */
export async function setPreferredEndpoint(endpointId: string | null) {
  const user = await requireUser();

  if (endpointId) {
    const endpoint = await prisma.agentEndpoint.findUnique({
      where: { id: endpointId },
      include: { device: true },
    });
    if (!endpoint || endpoint.device.userId !== user.id) {
      return { ok: false as const, error: "只能选择自己设备上的工具" };
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { preferredEndpointId: endpointId },
  });

  revalidatePath("/agent");
  revalidatePath("/", "layout");
  return { ok: true as const };
}
