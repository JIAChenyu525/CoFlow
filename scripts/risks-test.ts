/**
 * 风险规则测试：确定性、分级、优先级排序。
 * 运行：pnpm exec tsx scripts/risks-test.ts
 */
import { computeRisks, summarizeRisks, type RiskTask } from "../src/lib/risks";

let failed = 0;
function check(name: string, cond: boolean, extra = "") {
  console.log(`  ${cond ? "✓" : "✗"} ${name}${cond ? "" : " " + extra}`);
  if (!cond) failed++;
}

const DAY = 24 * 3600 * 1000;
const NOW = new Date("2026-11-12T12:00:00");
const ago = (d: number) => new Date(NOW.getTime() - d * DAY);
const ahead = (d: number) => new Date(NOW.getTime() + d * DAY);

function task(over: Partial<RiskTask> = {}): RiskTask {
  return {
    id: "t1",
    title: "任务",
    status: "IN_PROGRESS",
    dueDate: ahead(3),
    updatedAt: ago(1),
    createdAt: ago(5),
    blockedNeeds: null,
    dependencies: [],
    ...over,
  };
}

console.log("逾期");
const overdue = computeRisks([task({ dueDate: ago(3) })], NOW);
check("逾期会报", overdue.length === 1 && overdue[0].kind === "overdue");
check("逾期 3 天算高风险", overdue[0].level === "high");
const dueToday = computeRisks([task({ dueDate: ago(0.2) })], NOW);
check("刚逾期算中风险", dueToday[0]?.level === "medium", JSON.stringify(dueToday));

console.log("阻塞");
const blocked = computeRisks(
  [task({ status: "BLOCKED", updatedAt: ago(4), blockedNeeds: "营业执照" })],
  NOW
);
check("阻塞超 3 天会报", blocked.length === 1 && blocked[0].kind === "blocked_stale");
check("说明里带出所需支持", blocked[0].detail.includes("营业执照"));
const blockedNew = computeRisks([task({ status: "BLOCKED", updatedAt: ago(1) })], NOW);
check("刚阻塞不报", blockedNew.length === 0);

console.log("验收与停滞");
const review = computeRisks([task({ status: "IN_REVIEW", updatedAt: ago(6) })], NOW);
check("待验收超 5 天算高", review[0]?.level === "high");
const stale = computeRisks([task({ status: "IN_PROGRESS", updatedAt: ago(6) })], NOW);
check("进行中 6 天没更新会报", stale[0]?.kind === "progress_stale");
const fresh = computeRisks([task({ status: "IN_PROGRESS", updatedAt: ago(1) })], NOW);
check("正常进行中不报", fresh.length === 0);

console.log("待澄清");
const clarify = computeRisks([task({ status: "CLARIFY", createdAt: ago(5) })], NOW);
check("待澄清超 3 天会报", clarify[0]?.kind === "clarify_stuck");
check("待澄清是低优先级", clarify[0]?.level === "low");

console.log("依赖通知");
const depReady = computeRisks(
  [
    task({
      status: "READY",
      dependencies: [{ taskId: "d1", title: "上游", status: "DONE" }],
    }),
  ],
  NOW
);
check("依赖全部完成会提醒", depReady[0]?.kind === "dependency_ready");
const depPending = computeRisks(
  [
    task({
      status: "READY",
      dependencies: [{ taskId: "d1", title: "上游", status: "IN_PROGRESS" }],
    }),
  ],
  NOW
);
check("依赖没完成不提醒", depPending.length === 0);

console.log("已结束的任务");
check("已完成不报风险", computeRisks([task({ status: "DONE", dueDate: ago(9) })], NOW).length === 0);
check("已取消不报风险", computeRisks([task({ status: "CANCELLED" })], NOW).length === 0);

console.log("排序与汇总");
const mixed = computeRisks(
  [
    task({ id: "low1", status: "CLARIFY", createdAt: ago(9) }),
    task({ id: "high1", dueDate: ago(5) }),
    task({ id: "med1", status: "IN_REVIEW", updatedAt: ago(3) }),
  ],
  NOW
);
check("高风险排最前", mixed[0].level === "high");
check("低风险排最后", mixed[mixed.length - 1].level === "low");
const sum = summarizeRisks(mixed);
check("汇总数量正确", sum.total === 3 && sum.high === 1 && sum.medium === 1 && sum.low === 1);

console.log("确定性");
const a = computeRisks([task({ dueDate: ago(2) })], NOW);
const b = computeRisks([task({ dueDate: ago(2) })], NOW);
check("同样输入同样输出", JSON.stringify(a) === JSON.stringify(b));

console.log("");
if (failed === 0) console.log("全部通过");
else {
  console.log(`${failed} 项失败`);
  process.exit(1);
}
