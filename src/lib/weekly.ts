/**
 * 周报复盘（设计 §13.1 产品指标）
 *
 * 只做「过去 7 天实际发生了什么」的确定性汇总，不做推测。
 * 纯函数：输入是已取出的行，输出是报告 + 一段事实性叙述。
 */

export type DayBucket = { date: string; label: string; created: number; completed: number };

export type WeeklyInput = {
  now: Date;
  projects: { id: string; name: string; key: string }[];
  tasksCreated: { id: string; createdAt: Date; projectId: string }[];
  /** 每次验收结论，用来算通过率与完成 */
  reviews: {
    taskId: string;
    verdict: "PASS" | "RETURN" | "NEED_MORE";
    createdAt: Date;
    projectId: string;
    taskTitle: string;
  }[];
  /** 已完成任务的创建时间，用来算周期 */
  taskCreatedAt: { id: string; title: string; createdAt: Date; projectId: string }[];
  artifacts: { id: string; createdAt: Date; projectId: string }[];
  decisions: { id: string; confirmedAt: Date; projectId: string }[];
  sessions: { id: string; status: string; startedAt: Date; failureReason?: string | null }[];
  blocked: {
    id: string;
    title: string;
    projectId: string;
    blockedReason: string | null;
    blockedNeeds: string | null;
  }[];
  snapshots: { tokens: number; createdAt: Date }[];
};

export type WeeklyReport = {
  range: { from: string; to: string; days: number };
  totals: {
    projectsActive: number;
    tasksCreated: number;
    tasksCompleted: number;
    reviews: number;
    returned: number;
    passRate: number | null;
    artifacts: number;
    decisions: number;
    sessionsSubmitted: number;
    sessionsFailed: number;
    sessionsActive: number;
    blockedNow: number;
    avgContextTokens: number | null;
    maxContextTokens: number | null;
    medianCycleHours: number | null;
  };
  daily: DayBucket[];
  byProject: {
    id: string;
    key: string;
    name: string;
    created: number;
    completed: number;
    returned: number;
  }[];
  friction: {
    failures: { reason: string; count: number }[];
    blocked: { title: string; needs: string }[];
  };
  narrative: string[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function summarizeWeek(input: WeeklyInput): WeeklyReport {
  const end = startOfDay(input.now);
  const start = new Date(end.getTime() - 6 * DAY_MS); // 含今天共 7 天
  const windowStart = start;

  const inWindow = (d: Date) => d >= windowStart && d <= input.now;

  const reviews = input.reviews.filter((r) => inWindow(r.createdAt));
  const created = input.tasksCreated.filter((t) => inWindow(t.createdAt));
  const artifacts = input.artifacts.filter((a) => inWindow(a.createdAt));
  const decisions = input.decisions.filter((d) => inWindow(d.confirmedAt));
  const sessions = input.sessions.filter((s) => inWindow(s.startedAt));
  const snapshots = input.snapshots.filter((s) => inWindow(s.createdAt));

  // 完成 = 该任务在本周内出现过 PASS 验收；同一任务多次 PASS 只算一次
  const passByTask = new Map<string, Date>();
  for (const r of reviews.filter((x) => x.verdict === "PASS")) {
    const prev = passByTask.get(r.taskId);
    if (!prev || r.createdAt < prev) passByTask.set(r.taskId, r.createdAt);
  }

  const returned = reviews.filter((r) => r.verdict !== "PASS").length;
  const totalVerdicts = reviews.length;
  const passRate = totalVerdicts ? (totalVerdicts - returned) / totalVerdicts : null;

  // 周期：任务创建 → 本周首次 PASS
  const cycles: number[] = [];
  for (const [taskId, passedAt] of passByTask) {
    const meta = input.taskCreatedAt.find((t) => t.id === taskId);
    if (!meta) continue;
    const hours = (passedAt.getTime() - meta.createdAt.getTime()) / 3600000;
    if (hours >= 0) cycles.push(hours);
  }

  // 七日分桶
  const daily: DayBucket[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(start.getTime() + i * DAY_MS);
    const next = new Date(day.getTime() + DAY_MS);
    const same = (d: Date) => d >= day && d < next;
    daily.push({
      date: ymd(day),
      label: `${day.getMonth() + 1}/${day.getDate()}`,
      created: created.filter((t) => same(t.createdAt)).length,
      completed: [...passByTask.values()].filter((d) => same(d)).length,
    });
  }

  // 按项目
  const byProject = input.projects
    .map((p) => {
      const completed = [...passByTask.keys()].filter((taskId) =>
        input.taskCreatedAt.some((t) => t.id === taskId && t.projectId === p.id)
      ).length;
      return {
        id: p.id,
        key: p.key,
        name: p.name,
        created: created.filter((t) => t.projectId === p.id).length,
        completed,
        returned: reviews.filter((r) => r.projectId === p.id && r.verdict !== "PASS").length,
      };
    })
    .filter((p) => p.created + p.completed + p.returned > 0);

  // 失败原因聚合
  const failureMap = new Map<string, number>();
  for (const s of sessions) {
    if (s.status !== "FAILED") continue;
    const reason = s.failureReason || "未记录原因";
    failureMap.set(reason, (failureMap.get(reason) ?? 0) + 1);
  }
  const failures = [...failureMap.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  const tokens = snapshots.map((s) => s.tokens).filter((t) => t > 0);

  const report: WeeklyReport = {
    range: { from: ymd(start), to: ymd(end), days: 7 },
    totals: {
      projectsActive: byProject.length,
      tasksCreated: created.length,
      tasksCompleted: passByTask.size,
      reviews: totalVerdicts,
      returned,
      passRate,
      artifacts: artifacts.length,
      decisions: decisions.length,
      sessionsSubmitted: sessions.filter((s) => s.status === "SUBMITTED").length,
      sessionsFailed: sessions.filter((s) => s.status === "FAILED").length,
      sessionsActive: sessions.filter((s) => s.status === "ACTIVE").length,
      blockedNow: input.blocked.length,
      avgContextTokens: tokens.length
        ? Math.round(tokens.reduce((a, b) => a + b, 0) / tokens.length)
        : null,
      maxContextTokens: tokens.length ? Math.max(...tokens) : null,
      medianCycleHours: cycles.length ? round1(median(cycles)) : null,
    },
    daily,
    byProject,
    friction: {
      failures,
      blocked: input.blocked.map((b) => ({
        title: b.title,
        needs: b.blockedNeeds || b.blockedReason || "未说明",
      })),
    },
    narrative: [],
  };

  report.narrative = narrate(report);
  return report;
}

function narrate(r: WeeklyReport): string[] {
  const t = r.totals;
  const activity =
    t.tasksCreated + t.tasksCompleted + t.reviews + t.artifacts + t.decisions + r.daily.reduce((a, b) => a + b.created, 0);

  if (activity === 0) {
    return ["这一周没有任何项目活动。要么还没开始，要么事情停在了别处。"];
  }

  const lines: string[] = [];
  lines.push(
    `本周在 ${t.projectsActive} 个项目里新建 ${t.tasksCreated} 个任务、完成 ${t.tasksCompleted} 个。`
  );

  if (t.reviews > 0) {
    const pct = Math.round((t.passRate ?? 0) * 100);
    lines.push(
      t.returned === 0
        ? `验收 ${t.reviews} 次，全部通过。`
        : `验收 ${t.reviews} 次，通过率 ${pct}%，有 ${t.returned} 次退回。`
    );
  }

  if (t.sessionsSubmitted + t.sessionsFailed + t.sessionsActive > 0) {
    lines.push(
      `Agent 会话 ${t.sessionsSubmitted + t.sessionsFailed + t.sessionsActive} 次：提交 ${t.sessionsSubmitted}、失败 ${t.sessionsFailed}、进行中 ${t.sessionsActive}。`
    );
  }

  if (t.medianCycleHours !== null) {
    lines.push(`从建任务到通过验收，周期中位数 ${formatHours(t.medianCycleHours)}。`);
  }

  if (t.avgContextTokens !== null) {
    lines.push(
      `上下文包平均 ${t.avgContextTokens} tokens（最大 ${t.maxContextTokens}）。这是每次派发的固定成本。`
    );
  }

  if (t.blockedNow > 0) {
    lines.push(`仍有 ${t.blockedNow} 个任务处于阻塞。`);
  }

  if (t.returned > 0 && t.reviews >= 3) {
    lines.push(
      t.returned / t.reviews > 0.3
        ? "退回比例偏高，值得检查验收标准是不是写得太粗，或者任务边界太大。"
        : "退回比例正常。"
    );
  }

  return lines;
}

function median(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function formatHours(h: number) {
  if (h < 1) return `${Math.round(h * 60)} 分钟`;
  if (h < 48) return `${round1(h)} 小时`;
  return `${round1(h / 24)} 天`;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
