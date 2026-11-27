/**
 * 项目风险（设计 §6.9 交付健康度 / §12.3 阶段四：风险提醒、依赖通知）
 *
 * 全部是确定性规则：给同一批数据，永远得到同样的告警。
 * 不做「AI 判断哪里有问题」——那种提醒一次两次新鲜，第三次就没人看了。
 */

export type RiskLevel = "high" | "medium" | "low";

export type Risk = {
  id: string;
  level: RiskLevel;
  kind:
    | "overdue"
    | "blocked_stale"
    | "review_waiting"
    | "progress_stale"
    | "clarify_stuck"
    | "dependency_ready";
  title: string;
  detail: string;
  taskId: string;
};

export type RiskTask = {
  id: string;
  title: string;
  status: string;
  dueDate: Date | null;
  updatedAt: Date;
  createdAt: Date;
  blockedNeeds: string | null;
  dependencies: { taskId: string; status: string; title: string }[];
};

const DAY = 24 * 60 * 60 * 1000;

export function computeRisks(tasks: RiskTask[], now = new Date()): Risk[] {
  const out: Risk[] = [];

  for (const t of tasks) {
    if (t.status === "DONE" || t.status === "CANCELLED") continue;

    // 1. 逾期
    if (t.dueDate && t.dueDate < now) {
      const days = Math.floor((now.getTime() - t.dueDate.getTime()) / DAY);
      out.push({
        id: `${t.id}:overdue`,
        level: days >= 2 ? "high" : "medium",
        kind: "overdue",
        title: t.title,
        detail: days === 0 ? "今天到期" : `已逾期 ${days} 天`,
        taskId: t.id,
      });
      continue;
    }

    // 2. 阻塞太久
    if (t.status === "BLOCKED") {
      const days = Math.floor((now.getTime() - t.updatedAt.getTime()) / DAY);
      if (days >= 3) {
        out.push({
          id: `${t.id}:blocked`,
          level: "high",
          kind: "blocked_stale",
          title: t.title,
          detail: t.blockedNeeds
            ? `阻塞 ${days} 天，等待：${t.blockedNeeds}`
            : `阻塞 ${days} 天，没有写明所需支持`,
          taskId: t.id,
        });
      }
      continue;
    }

    // 3. 待验收堆积
    if (t.status === "IN_REVIEW") {
      const days = Math.floor((now.getTime() - t.updatedAt.getTime()) / DAY);
      if (days >= 2) {
        out.push({
          id: `${t.id}:review`,
          level: days >= 5 ? "high" : "medium",
          kind: "review_waiting",
          title: t.title,
          detail: `等待验收 ${days} 天`,
          taskId: t.id,
        });
      }
      continue;
    }

    // 4. 进行中但长时间无更新
    if (t.status === "IN_PROGRESS") {
      const days = Math.floor((now.getTime() - t.updatedAt.getTime()) / DAY);
      if (days >= 5) {
        out.push({
          id: `${t.id}:stale`,
          level: "medium",
          kind: "progress_stale",
          title: t.title,
          detail: `${days} 天没有更新，可能卡住了`,
          taskId: t.id,
        });
      }
      continue;
    }

    // 5. 待澄清太久
    if (t.status === "CLARIFY") {
      const days = Math.floor((now.getTime() - t.createdAt.getTime()) / DAY);
      if (days >= 3) {
        out.push({
          id: `${t.id}:clarify`,
          level: "low",
          kind: "clarify_stuck",
          title: t.title,
          detail: `停在待澄清 ${days} 天，缺输入或验收标准`,
          taskId: t.id,
        });
      }
      continue;
    }

    // 6. 依赖已满足、可以推进（正向提醒）
    if ((t.status === "UNCLAIMED" || t.status === "READY") && t.dependencies.length > 0) {
      const allDone = t.dependencies.every((d) => d.status === "DONE");
      if (allDone) {
        out.push({
          id: `${t.id}:dep`,
          level: "low",
          kind: "dependency_ready",
          title: t.title,
          detail: `前置 ${t.dependencies.length} 项都已完成，可以开始了`,
          taskId: t.id,
        });
      }
    }
  }

  const order: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2 };
  return out.sort(
    (a, b) => order[a.level] - order[b.level] || a.taskId.localeCompare(b.taskId)
  );
}

export function summarizeRisks(risks: Risk[]) {
  return {
    total: risks.length,
    high: risks.filter((r) => r.level === "high").length,
    medium: risks.filter((r) => r.level === "medium").length,
    low: risks.filter((r) => r.level === "low").length,
  };
}
