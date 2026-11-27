/**
 * 派发推荐（设计 §3.2 渐进自动化：先做可靠同步，再谈自动调度）
 *
 * 这一层只回答「如果现在派，派给谁更合适，为什么」。
 * 它不做决定，也不调 API——人看完理由再点。这样每一条建议都能被质疑。
 */

export type Candidate = {
  endpointId: string;
  toolType: string;
  capability: "AUTO" | "SEMI" | "MANUAL";
  online: boolean;
  activeSessions: number;
  allowedPaths: string[];
  submitted: number;
  failed: number;
  /** 与其它正在执行的会话重叠的路径数 */
  conflicts: number;
};

export type Reason = { code: string; text: string; delta: number };

export type Scored = {
  endpointId: string;
  score: number;
  reasons: Reason[];
  /** 建议上限：低于这个分数的端点默认不推荐 */
  usable: boolean;
};

const BASE = 50;
/** 离线设备不参与排序 */
const OFFLINE_PENALTY = -100;

export function scopeCovered(scope: string, allowedPaths: string[]) {
  const parts = splitScope(scope);
  if (parts.length === 0) return null; // 任务没写范围，无法判断
  if (allowedPaths.length === 0) return false;

  const paths = allowedPaths.map((p) =>
    p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase()
  );

  return parts.every((part) =>
    paths.some((p) => p === part || p.endsWith("/" + part) || p.includes("/" + part + "/"))
  );
}

export function splitScope(scope: string) {
  return String(scope ?? "")
    .split(/[,，、\s]+/)
    .map((s) =>
      s
        .trim()
        .replace(/\\/g, "/")
        .replace(/^\.\//, "")
        .replace(/\/+$/, "")
        .toLowerCase()
    )
    .filter(Boolean)
    .filter((s) => !s.includes("*")); // 通配写法不做猜测
}

export function scoreCandidate(c: Candidate, task: { scope: string }): Scored {
  const reasons: Reason[] = [];
  let score = BASE;

  const add = (code: string, text: string, delta: number) => {
    if (delta === 0) return;
    reasons.push({ code, text, delta });
    score += delta;
  };

  if (!c.online) {
    add("offline", "设备离线或端点已撤销", OFFLINE_PENALTY);
    return { endpointId: c.endpointId, score: 0, reasons, usable: false };
  }

  if (c.capability === "AUTO") add("auto", "可自动执行（AUTO）", 25);
  else if (c.capability === "SEMI") add("semi", "需要人工介入（SEMI）", 10);
  else add("manual", "只能手动回传（MANUAL）", 0);

  if (c.activeSessions > 0) {
    add("busy", `当前有 ${c.activeSessions} 个会话在执行`, -20 * c.activeSessions);
  } else {
    add("idle", "空闲", 5);
  }

  const covered = scopeCovered(task.scope, c.allowedPaths);
  if (covered === true) add("scope_ok", "授权目录覆盖任务范围", 15);
  else if (covered === false) add("scope_missing", "授权目录不覆盖任务范围", -15);

  if (c.conflicts > 0) {
    add("conflict", `声明路径与 ${c.conflicts} 个执行中会话重叠`, -30);
  }

  const total = c.submitted + c.failed;
  if (total >= 3) {
    const rate = c.submitted / total;
    const delta = Math.round((rate - 0.5) * 20); // -10 ~ +10
    add(
      "history",
      `近 30 天 ${c.submitted} 成功 / ${c.failed} 失败`,
      delta
    );
  }

  return { endpointId: c.endpointId, score, reasons, usable: score > 0 };
}

export function rankCandidates(candidates: Candidate[], task: { scope: string }) {
  return candidates
    .map((c) => scoreCandidate(c, task))
    .sort((a, b) => b.score - a.score);
}
