/**
 * 周报汇总测试：数字必须能对上，叙述必须来自数字。
 * 运行：pnpm exec tsx scripts/weekly-test.ts
 */
import { summarizeWeek, type WeeklyInput } from "../src/lib/weekly";

let failed = 0;
function check(name: string, cond: boolean, extra = "") {
  console.log(`  ${cond ? "✓" : "✗"} ${name} ${cond ? "" : extra}`);
  if (!cond) failed++;
}

const DAY = 24 * 3600 * 1000;
const NOW = new Date("2026-11-12T12:00:00");
const ago = (d: number) => new Date(NOW.getTime() - d * DAY);

function input(over: Partial<WeeklyInput> = {}): WeeklyInput {
  return {
    now: NOW,
    projects: [
      { id: "p1", name: "朝夕相伴", key: "ZX" },
      { id: "p2", name: "旁支项目", key: "BB" },
    ],
    tasksCreated: [
      { id: "t1", createdAt: ago(3), projectId: "p1" },
      { id: "t2", createdAt: ago(4), projectId: "p1" },
      { id: "old", createdAt: ago(20), projectId: "p2" },
    ],
    reviews: [
      { taskId: "t1", verdict: "PASS", createdAt: ago(1), projectId: "p1", taskTitle: "接口" },
      { taskId: "t2", verdict: "RETURN", createdAt: ago(2), projectId: "p1", taskTitle: "设计" },
    ],
    taskCreatedAt: [
      { id: "t1", title: "接口", createdAt: ago(3), projectId: "p1" },
      { id: "t2", title: "设计", createdAt: ago(4), projectId: "p1" },
    ],
    artifacts: [{ id: "a1", createdAt: ago(1), projectId: "p1" }],
    decisions: [{ id: "d1", confirmedAt: ago(2), projectId: "p1" }],
    sessions: [
      { id: "s1", status: "SUBMITTED", startedAt: ago(2) },
      { id: "s2", status: "FAILED", startedAt: ago(1), failureReason: "scope_violation" },
    ],
    blocked: [
      { id: "b1", title: "推送", projectId: "p1", blockedReason: "资质", blockedNeeds: "营业执照" },
    ],
    snapshots: [
      { tokens: 800, createdAt: ago(2) },
      { tokens: 1200, createdAt: ago(1) },
    ],
    ...over,
  };
}

console.log("空数据");
const empty = summarizeWeek(
  input({
    tasksCreated: [],
    reviews: [],
    taskCreatedAt: [],
    artifacts: [],
    decisions: [],
    sessions: [],
    blocked: [],
    snapshots: [],
  })
);
check("没有活动时如实说明", empty.narrative[0].includes("没有任何项目活动"));
check("通过率为空而不是 0", empty.totals.passRate === null);

console.log("基本统计");
const r = summarizeWeek(input());
check("窗口外的任务不计入新建", r.totals.tasksCreated === 2, String(r.totals.tasksCreated));
check("完成数 = 本周 PASS 的任务数", r.totals.tasksCompleted === 1);
check("验收次数 2", r.totals.reviews === 2);
check("退回 1 次", r.totals.returned === 1);
check("通过率 50%", r.totals.passRate === 0.5, String(r.totals.passRate));
check("周期中位数 48 小时", r.totals.medianCycleHours === 48, String(r.totals.medianCycleHours));
check("平均 tokens 1000", r.totals.avgContextTokens === 1000, String(r.totals.avgContextTokens));
check("最大 tokens 1200", r.totals.maxContextTokens === 1200);

console.log("七日分桶");
check("桶数 7", r.daily.length === 7);
check(
  "完成合计等于完成总数",
  r.daily.reduce((a, b) => a + b.completed, 0) === r.totals.tasksCompleted
);
check(
  "新建合计等于新建总数",
  r.daily.reduce((a, b) => a + b.created, 0) === r.totals.tasksCreated
);

console.log("按项目");
check("只保留有活动的项目", r.byProject.length === 1 && r.byProject[0].id === "p1");
check("项目内完成数正确", r.byProject[0].completed === 1);
check("项目内退回数正确", r.byProject[0].returned === 1);

console.log("摩擦与叙述");
check("失败原因聚合", r.friction.failures[0].reason === "scope_violation");
check("阻塞项列出所需支持", r.friction.blocked[0].needs === "营业执照");
check("叙述提到完成数", r.narrative.some((l) => l.includes("完成 1 个")));
check("叙述提到会话", r.narrative.some((l) => l.includes("Agent 会话")));
check("叙述提到阻塞", r.narrative.some((l) => l.includes("阻塞")));

console.log("退回比例提示");
const high = summarizeWeek(
  input({
    reviews: [
      { taskId: "t1", verdict: "RETURN", createdAt: ago(1), projectId: "p1", taskTitle: "接口" },
      { taskId: "t2", verdict: "RETURN", createdAt: ago(2), projectId: "p1", taskTitle: "设计" },
      { taskId: "t3", verdict: "PASS", createdAt: ago(3), projectId: "p1", taskTitle: "文档" },
    ],
  })
);
check(
  "退回比例高时给出提示",
  high.narrative.some((l) => l.includes("验收标准")),
  JSON.stringify(high.narrative)
);

console.log("");
if (failed === 0) console.log("全部通过");
else {
  console.log(`${failed} 项失败`);
  process.exit(1);
}
