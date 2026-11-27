"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { appendEvent } from "@/lib/events";

/**
 * 在频道里请「我自己的助手」回答。
 *
 * 请求绑定到发起人：只有他自己的连接器能领走，
 * 用的是他自己电脑上的工具。平台只排队与转发，不接触任何模型密钥。
 */
export async function askMyAssistant(input: {
  projectId: string;
  prompt: string;
  channel?: string;
}) {
  const user = await requireUser();
  const prompt = input.prompt.trim();
  if (!prompt) return { ok: false as const, error: "先说点什么，助手才有上下文" };
  if (prompt.length > 2000) return { ok: false as const, error: "一次别超过 2000 字" };

  const membership = await prisma.membership.findUnique({
    where: { projectId_userId: { projectId: input.projectId, userId: user.id } },
  });
  if (!membership || membership.role === "OBSERVER") {
    return { ok: false as const, error: "当前身份不能呼叫助手" };
  }

  const limit = rateLimit(`assist:${user.id}`, 6, 60 * 1000);
  if (!limit.ok) return { ok: false as const, error: "助手请求太频繁，等一分钟再试" };

  const endpoint = await prisma.agentEndpoint.findFirst({
    where: {
      device: { userId: user.id, revokedAt: null },
      status: { not: "REVOKED" },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!endpoint) {
    return {
      ok: false as const,
      error: "你还没有连接 AI 工具。先在「Agent 连接」里完成配对，再让助手替你回答。",
    };
  }

  const request = await prisma.assistantRequest.create({
    data: {
      projectId: input.projectId,
      userId: user.id,
      channel: input.channel ?? "general",
      prompt,
    },
  });

  await prisma.$transaction(async (tx) => {
    await appendEvent(tx, {
      projectId: input.projectId,
      type: "assistant.requested",
      actorId: user.id,
      subjectType: "assistant_request",
      subjectId: request.id,
      payload: { endpointId: endpoint.id, tool: endpoint.toolType, channel: request.channel },
    });
  });

  revalidatePath(`/projects/${input.projectId}`, "layout");
  return { ok: true as const, requestId: request.id, tool: endpoint.toolType };
}
