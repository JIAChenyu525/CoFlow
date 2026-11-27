import "server-only";
import crypto from "node:crypto";
import { prisma } from "./db";

/**
 * 全队共享的同一份项目记忆。
 *
 * Agents 的工具各是各的（跑在各自电脑上），但它们读到的必须是一模一样的事实：
 * 章程、里程碑、任务、已确认决策、产物、最近讨论。
 * 这里把这份事实渲染成文本并算出哈希，任何人的助手拿到的都是同一个 hash。
 */
export type ProjectMemory = {
  hash: string;
  text: string;
  counts: { tasks: number; decisions: number; artifacts: number; messages: number };
};

const STATUS_LABEL: Record<string, string> = {
  CLARIFY: "待澄清",
  UNCLAIMED: "待认领",
  READY: "已就绪",
  IN_PROGRESS: "进行中",
  IN_REVIEW: "待验收",
  DONE: "已完成",
  BLOCKED: "已阻塞",
  PAUSED: "已暂停",
  CANCELLED: "已取消",
};

export async function buildProjectMemory(projectId: string): Promise<ProjectMemory | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      charters: { orderBy: { version: "desc" }, take: 1 },
      milestones: { orderBy: { sort: "asc" } },
      tasks: {
        orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
        take: 40,
        include: { assignee: { select: { name: true } } },
      },
      decisions: {
        where: { status: "CONFIRMED" },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { decidedBy: { select: { name: true } } },
      },
      artifacts: {
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { submittedBy: { select: { name: true } } },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { author: { select: { name: true } } },
      },
    },
  });
  if (!project) return null;

  const charter = project.charters[0];
  const lines: string[] = [];

  lines.push(`# 项目：${project.name}（${project.key}）`);
  if (project.summary) lines.push(project.summary);
  lines.push(`当前阶段：${project.stage}`);

  if (charter) {
    lines.push(`\n## 章程 v${charter.version}`);
    lines.push(`目标：${charter.goal || "（未填写）"}`);
    lines.push(`目标用户：${charter.targetUsers || "（未填写）"}`);
    lines.push(`交付范围：${charter.scope || "（未填写）"}`);
    if (charter.nonGoals) lines.push(`非目标：${charter.nonGoals}`);
    if (charter.constraints) lines.push(`硬性约束：${charter.constraints}`);
    lines.push(`验收口径：${charter.acceptance || "（未填写）"}`);
  } else {
    lines.push("\n## 章程：尚未填写");
  }

  if (project.milestones.length) {
    lines.push("\n## 里程碑");
    for (const m of project.milestones) {
      lines.push(`- ${m.title}（${m.status}）`);
    }
  }

  if (project.tasks.length) {
    lines.push("\n## 任务");
    for (const t of project.tasks) {
      const acceptance = t.acceptance.replace(/\s+/g, " ").slice(0, 80);
      lines.push(
        `- [${STATUS_LABEL[t.status] ?? t.status}] ${t.title}` +
          ` · 负责人：${t.assignee?.name ?? "未分配"}` +
          (acceptance ? ` · 验收：${acceptance}` : " · 验收：未填写")
      );
    }
  }

  if (project.decisions.length) {
    lines.push("\n## 已确认决策");
    for (const d of project.decisions) {
      lines.push(`- ${d.title}：${d.conclusion}（${d.decidedBy?.name ?? "—"}）`);
    }
  }

  if (project.artifacts.length) {
    lines.push("\n## 最近产物");
    for (const a of project.artifacts) {
      lines.push(`- [${a.type}] ${a.title} · ${a.location}（${a.submittedBy.name}）`);
    }
  }

  if (project.messages.length) {
    lines.push("\n## 最近讨论");
    for (const m of [...project.messages].reverse()) {
      const who = m.authorType === "AGENT" ? `${m.author.name} 的助手` : m.author.name;
      lines.push(`- ${who}：${m.body.replace(/\s+/g, " ").slice(0, 200)}`);
    }
  }

  const text = lines.join("\n");
  const hash = crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);

  return {
    hash,
    text,
    counts: {
      tasks: project.tasks.length,
      decisions: project.decisions.length,
      artifacts: project.artifacts.length,
      messages: project.messages.length,
    },
  };
}
