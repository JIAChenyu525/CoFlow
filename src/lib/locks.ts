/**
 * 工作声明与冲突判定（设计 §6.7）
 *
 * 三种模式：
 *   独占锁 —— 高风险资源（迁移脚本、配置文件、依赖清单），重叠直接拒绝
 *   软锁   —— 一般代码模块，允许并行但提示重叠
 *   自由   —— 没有声明任何路径，或只读分析
 *
 * 这里只做「判定」，落库与通知在调用方。
 */

export type LockMode = "exclusive" | "soft" | "free";

/** 命中这些片段的路径按独占处理 */
const HIGH_RISK = [
  "migration",
  "migrations",
  "schema.prisma",
  "package.json",
  "pnpm-lock",
  "package-lock",
  ".env",
  "dockerfile",
  "docker-compose",
];

export function normalizePath(p: string) {
  return p
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

export function modeFor(paths: string[]): LockMode {
  if (paths.length === 0) return "free";
  const n = paths.map(normalizePath);
  return n.some((p) => HIGH_RISK.some((h) => p.includes(h))) ? "exclusive" : "soft";
}

/** 两条声明是否重叠：相同，或一方是另一方的父目录 */
export function pathsOverlap(a: string, b: string) {
  const x = normalizePath(a);
  const y = normalizePath(b);
  if (!x || !y) return false;
  if (x === y) return true;
  return x.startsWith(y + "/") || y.startsWith(x + "/");
}

export type Claim = { id: string; label: string; paths: string[] };

export type Conflict = {
  with: string; // 冲突对象的 id
  label: string; // 人类可读：任务标题 / 会话
  paths: string[]; // 实际重叠的路径
};

/**
 * 计算新声明与已有声明的冲突。
 * 只比对同一项目下的其它 ACTIVE 会话。
 */
export function findConflicts(declared: string[], others: Claim[]): Conflict[] {
  const out: Conflict[] = [];
  for (const o of others) {
    const hits = declared.filter((d) => o.paths.some((p) => pathsOverlap(d, p)));
    if (hits.length > 0) {
      out.push({ with: o.id, label: o.label, paths: hits });
    }
  }
  return out;
}

/** 连接器的本地提示文案：独占直接拒绝，软锁提示后继续 */
export function describeConflicts(mode: LockMode, conflicts: Conflict[]) {
  if (conflicts.length === 0) return null;
  const lines = conflicts.map(
    (c) => `  · 与「${c.label}」重叠：${c.paths.join(", ")}`
  );
  if (mode === "exclusive") {
    return ["检测到独占资源冲突，已拒绝领取：", ...lines].join("\n");
  }
  return ["存在路径重叠（软锁），建议与对方确认后再改：", ...lines].join("\n");
}
