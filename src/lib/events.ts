import type { ActorType, Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export type AppendEventInput = {
  projectId: string;
  type: string;
  actorType?: ActorType;
  actorId: string;
  subjectType: string;
  subjectId: string;
  payload?: Record<string, unknown>;
  source?: string;
  correlationId?: string;
  visibility?: string;
};

/**
 * 事件流是不可变事实记录（§5.2）。
 * 约定：每次业务写入必须与对应事件在同一事务内提交，
 * 保证"状态变了但没留痕"或"留痕了但状态没变"都不会发生。
 */
export async function appendEvent(tx: Tx, input: AppendEventInput) {
  return tx.projectEvent.create({
    data: {
      projectId: input.projectId,
      type: input.type,
      actorType: input.actorType ?? "HUMAN",
      actorId: input.actorId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      payload: (input.payload ?? {}) as Prisma.InputJsonValue,
      source: input.source ?? "web",
      correlationId: input.correlationId,
      visibility: input.visibility ?? "project",
      schemaVersion: "1.0",
    },
  });
}

/** 事件 payload 的一句话摘要，时间线与上下文包共用，避免两处写法不一致。 */
export function summarizeEvent(type: string, payload: unknown): string {
  const p = (payload ?? {}) as Record<string, unknown>;
  switch (type) {
    case "task.status_changed":
      return `${p.from ?? "?"} → ${p.to ?? "?"}`;
    case "task.blocked":
      return String(p.blockedReason ?? "任务被阻塞");
    case "review.completed": {
      const verdict = p.verdict === "PASS" ? "通过" : p.verdict === "RETURN" ? "退回" : "补充材料";
      return `验收${verdict}${p.nextStatus ? ` → ${p.nextStatus}` : ""}`;
    }
    case "artifact.submitted":
      return String(p.title ?? "提交产物");
    case "decision.confirmed":
      return String(p.title ?? "确认决策");
    case "charter.updated":
      return `章程 v${p.version ?? "?"}${p.note ? ` · ${p.note}` : ""}`;
    case "project.created":
      return String(p.name ?? "创建项目");
    case "project.stage_changed":
      return `阶段 → ${p.stage ?? "?"}`;
    case "task.created":
      return String(p.title ?? "创建任务");
    case "task.updated":
      return "任务定义更新";
    case "message.posted":
      return "项目讨论";
    default:
      // 没有专门摘要的事件就返回空，避免"类型"既当标题又当摘要
      return "";
  }
}

/** 用于时间线展示的人类可读描述。事件 payload 是机器格式，界面文案另算。 */
export function describeEvent(type: string): string {
  const map: Record<string, string> = {
    "project.created": "创建项目",
    "charter.updated": "更新项目章程",
    "task.created": "创建任务",
    "task.updated": "修改任务",
    "task.status_changed": "变更任务状态",
    "task.blocked": "任务阻塞",
    "task.unblocked": "解除阻塞",
    "message.posted": "发送消息",
    "decision.proposed": "提出决策",
    "decision.confirmed": "确认决策",
    "artifact.submitted": "提交产物",
    "review.completed": "完成验收",
    "project.stage_changed": "变更项目阶段",
    "project.archived": "归档项目",
  };
  return map[type] ?? type;
}
