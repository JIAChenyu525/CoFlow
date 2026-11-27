import type { TaskStatus } from "@prisma/client";

/**
 * 任务状态机（设计方案 §6.2）
 *
 *   待澄清 → 待认领 → 已就绪 → 进行中 → 待验收 → 已完成
 *   旁路：已阻塞 / 已暂停 / 已取消
 *
 * 状态转换不是 UI 约定，而是事实层的写入规则：任何服务端入口都必须经过这里。
 */
export const TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  CLARIFY: ["UNCLAIMED", "CANCELLED"],
  UNCLAIMED: ["READY", "CLARIFY", "CANCELLED"],
  READY: ["IN_PROGRESS", "UNCLAIMED", "CANCELLED"],
  IN_PROGRESS: ["IN_REVIEW", "BLOCKED", "PAUSED", "READY", "CANCELLED"],
  IN_REVIEW: ["DONE", "IN_PROGRESS", "BLOCKED", "CANCELLED"],
  DONE: ["IN_PROGRESS"], // 返工：创建新 revision，保留原验收记录
  BLOCKED: ["IN_PROGRESS", "READY", "CLARIFY", "PAUSED", "CANCELLED"],
  PAUSED: ["IN_PROGRESS", "READY", "BLOCKED", "CANCELLED"],
  CANCELLED: ["UNCLAIMED"],
};

export type TaskContext = {
  hasAssignee: boolean;
  hasAcceptance: boolean;
  hasInputs: boolean;
  artifactCount: number;
  note?: string;
  canReview: boolean;
  canRework: boolean;
};

const MISSING: Record<string, string> = {
  CLARIFY_UNCLAIMED: "补齐任务输入与验收标准后才能进入待认领",
  UNCLAIMED_READY: "必须先指定负责人，任务才能进入已就绪",
  IN_PROGRESS_IN_REVIEW: "提交验收前至少需要一项产物，或填写无产物说明",
  IN_REVIEW_DONE: "只有具备验收权的人（负责人 / 评审 / 发起人）才能通过验收",
  IN_REVIEW_IN_PROGRESS: "退回是验收动作，只有具备验收权的人可以执行",
  DONE_IN_PROGRESS: "返工需要负责人或评审确认，并会生成新的 revision",
};

/** 返回 null 表示允许，返回字符串表示拒绝原因。 */
export function checkTransition(
  from: TaskStatus,
  to: TaskStatus,
  ctx: TaskContext
): string | null {
  if (from === to) return "任务已处于该状态";
  if (!TRANSITIONS[from].includes(to)) {
    return `不允许从「${from}」直接变为「${to}」`;
  }

  if (from === "CLARIFY" && to === "UNCLAIMED") {
    if (!ctx.hasInputs || !ctx.hasAcceptance) {
      return MISSING.CLARIFY_UNCLAIMED;
    }
  }
  if (from === "UNCLAIMED" && to === "READY" && !ctx.hasAssignee) {
    return MISSING.UNCLAIMED_READY;
  }
  if (from === "IN_PROGRESS" && to === "IN_REVIEW") {
    if (ctx.artifactCount === 0 && !ctx.note?.trim()) {
      return MISSING.IN_PROGRESS_IN_REVIEW;
    }
  }
  if (from === "IN_REVIEW" && to === "DONE" && !ctx.canReview) {
    return MISSING.IN_REVIEW_DONE;
  }
  if (from === "IN_REVIEW" && to === "IN_PROGRESS" && !ctx.canReview) {
    return MISSING.IN_REVIEW_IN_PROGRESS;
  }
  if (from === "DONE" && to === "IN_PROGRESS" && !ctx.canRework) {
    return MISSING.DONE_IN_PROGRESS;
  }
  return null;
}

/** 当前状态可执行的动作，供 UI 只渲染合法按钮。 */
export function availableTransitions(status: TaskStatus, ctx: TaskContext) {
  return TRANSITIONS[status]
    .map((to) => ({ to, blockedReason: checkTransition(status, to, ctx) }))
    .filter((t) => t.blockedReason === null);
}

/**
 * 进度只由验收状态决定，Agent 自报进度不能改写完成率（§6.9）。
 */
export function computeProgress(
  tasks: { status: TaskStatus; weight: number }[]
) {
  const active = tasks.filter((t) => t.status !== "CANCELLED");
  const total = active.reduce((s, t) => s + t.weight, 0);
  if (!total) return 0;
  const done = active
    .filter((t) => t.status === "DONE")
    .reduce((s, t) => s + t.weight, 0);
  return Math.round((done / total) * 100);
}
