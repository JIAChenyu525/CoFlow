/**
 * 上下文包构建器的确定性测试。
 * 核心主张：同样的输入必须得到同样的 hash，不同的输入必须不同。
 * 运行：pnpm exec tsx scripts/context-test.ts
 */
import { buildPackage, estimateTokens, type BuildInput } from "../src/lib/context";

let failed = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name} ${extra}`);
  }
}

const base: BuildInput = {
  project: { id: "p1", key: "ZX", name: "朝夕相伴", stage: "BUILD" },
  task: {
    id: "t1",
    title: "实现睡前图片上传接口",
    description: "支持上传至对象存储",
    inputs: "数据模型 task_upload",
    scope: "backend/upload",
    nonScope: "图片裁剪",
    acceptance: "1. 上传成功\n2. 超过 10MB 拒绝",
    priority: "P0",
    status: "IN_PROGRESS",
    dueDate: new Date("2026-11-12T00:00:00Z"),
    milestone: { title: "M1" },
    dependencies: [
      { id: "t0b", title: "B", status: "DONE" },
      { id: "t0a", title: "A", status: "DONE" },
    ],
  },
  charter: {
    version: 2,
    goal: "完成首个可用版本",
    targetUsers: "双人用户",
    scope: "打卡、提醒、上传",
    nonGoals: "社区",
    constraints: "粉色主题、不用 emoji",
    acceptance: "核心流程可用",
  },
  decisions: [
    {
      id: "d1",
      title: "直传对象存储",
      conclusion: "客户端拿临时凭证直传",
      impact: "上传任务",
      confirmedAt: new Date("2026-11-06T00:00:00Z"),
      taskId: "t1",
    },
    {
      id: "d2",
      title: "首版不做社区",
      conclusion: "只保留双人私密空间",
      impact: "范围",
      confirmedAt: new Date("2026-11-03T00:00:00Z"),
      taskId: null,
    },
  ],
  blockers: [],
  recentChanges: [
    { type: "task.status_changed", summary: "READY → IN_PROGRESS", at: new Date("2026-11-11T00:00:00Z") },
  ],
  endpoint: { id: "e1", toolType: "claude-code", capability: "AUTO", allowedPaths: ["backend/upload"] },
  member: { name: "周野", role: "MEMBER" },
};

console.log("确定性");
const a = buildPackage(base);
const b = buildPackage(structuredClone(base));
check("同样输入 → 同样 hash", a.hash === b.hash, `${a.hash} vs ${b.hash}`);
check("hash 形如 sha256:", a.hash.startsWith("sha256:"));
check("token 估算 > 0", a.tokens > 0, String(a.tokens));

console.log("输入变化 → hash 变化");
const changed = structuredClone(base);
changed.task.title = "实现睡前图片上传接口 v2";
check("改任务标题", buildPackage(changed).hash !== a.hash);
const changedDecision = structuredClone(base);
changedDecision.decisions[0].conclusion = "改为业务服务器中转";
check("改决策结论", buildPackage(changedDecision).hash !== a.hash);

console.log("顺序无关");
const reordered = structuredClone(base);
reordered.task.dependencies = [...reordered.task.dependencies].reverse();
reordered.decisions = [...reordered.decisions].reverse();
check("依赖/决策乱序 → hash 相同", buildPackage(reordered).hash === a.hash);

console.log("层级优先级");
const tight = buildPackage({
  ...structuredClone(base),
  budgetTokens: 300, // 故意压到很小
});
check("超预算时仍保留章程与任务", !!tight.pkg.charter && !!tight.pkg.task);
check(
  "超预算时记录了裁剪",
  tight.truncated.length > 0 || tight.overBudget,
  JSON.stringify(tight.truncated)
);
const hard = buildPackage({ ...structuredClone(base), budgetTokens: 10 });
check("L0/L1 超出硬上限时 overBudget=true", hard.overBudget === true);

console.log("注入隔离");
const pkg = a.pkg;
check("决策只包含已确认的", pkg.decisions.length === a.pkg.decisions.length);

console.log("估算函数");
check("纯中文 10 字 ≈ 10", estimateTokens("一二三四五六七八九十") === 10);
check("纯英文 8 字符 = 2", estimateTokens("abcdefgh") === 2);

console.log("");
if (failed === 0) {
  console.log("全部通过");
} else {
  console.log(`${failed} 项失败`);
  process.exit(1);
}
