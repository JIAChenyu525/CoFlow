import { prisma } from "@/lib/db";
import { getDevice, unauthorized } from "@/lib/device-auth";

export const dynamic = "force-dynamic";

/** 助手执行失败：记录下来，频道里给出可读的失败原因 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const device = await getDevice(req);
  if (!device) return unauthorized();

  const { id } = await params;
  const request = await prisma.assistantRequest.findUnique({ where: { id } });
  if (!request || request.userId !== device.user.id) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  let payload: { error?: string } = {};
  try {
    payload = await req.json();
  } catch {
    // 允许空 body
  }
  const reason = (payload.error ?? "助手执行失败").slice(0, 500);

  await prisma.assistantRequest.update({
    where: { id: request.id },
    data: { status: "FAILED", error: reason, finishedAt: new Date() },
  });

  return Response.json({ ok: true });
}
