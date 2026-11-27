import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * 撤销设备。只断协作通道，不影响原工具在本机继续使用（设计 §6.6）。
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await params;
  const device = await prisma.device.findUnique({ where: { id } });
  if (!device || device.userId !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.device.update({
      where: { id },
      data: { revokedAt: new Date() },
    }),
    prisma.agentEndpoint.updateMany({
      where: { deviceId: id },
      data: { status: "REVOKED" },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
