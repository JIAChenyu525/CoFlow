/**
 * 模板数据完整性测试：模板是数据，坏数据比坏代码更难发现。
 * 运行：pnpm exec tsx scripts/templates-test.ts
 */
import { getTemplate, TEMPLATES } from "../src/lib/templates";

let failed = 0;
function check(name: string, cond: boolean, extra = "") {
  console.log(`  ${cond ? "✓" : "✗"} ${name}${cond ? "" : " " + extra}`);
  if (!cond) failed++;
}

const ids = new Set<string>();

for (const t of TEMPLATES) {
  console.log(`模板：${t.name}`);
  check("id 唯一", !ids.has(t.id));
  ids.add(t.id);
  check("有里程碑", t.milestones.length > 0);
  check("有任务", t.tasks.length >= 4, String(t.tasks.length));

  const titles = new Set<string>();
  let dup = false;
  for (const task of t.tasks) {
    if (titles.has(task.title)) dup = true;
    titles.add(task.title);
  }
  check("任务标题不重复", !dup);

  check(
    "每个任务都有验收标准",
    t.tasks.every((x) => x.acceptance.trim().length >= 8)
  );
  check(
    "每个任务都有输入或说明",
    t.tasks.every((x) => x.inputs.trim().length > 0 || x.description.trim().length > 0)
  );
  check(
    "里程碑索引有效",
    t.tasks.every((x) => x.milestone === undefined || (x.milestone >= 0 && x.milestone < t.milestones.length))
  );

  // 依赖必须指向合法索引，且不能自依赖、不能成环
  let depOk = true;
  for (let i = 0; i < t.tasks.length; i++) {
    for (const d of t.tasks[i].dependsOn ?? []) {
      if (d < 0 || d >= t.tasks.length) depOk = false;
      if (d === i) depOk = false;
    }
  }
  check("依赖索引合法且无自依赖", depOk);

  // 环检测（任务数少，直接 DFS）
  const adj = t.tasks.map((x) => x.dependsOn ?? []);
  const state = new Array(t.tasks.length).fill(0); // 0 未访问 1 访问中 2 完成
  let cycle = false;
  const dfs = (n: number) => {
    if (state[n] === 1) cycle = true;
    if (state[n] !== 0) return;
    state[n] = 1;
    for (const m of adj[n]) dfs(m);
    state[n] = 2;
  };
  for (let i = 0; i < t.tasks.length; i++) dfs(i);
  check("依赖无环", !cycle);

  check(
    "章程字段都已填写",
    Object.values(t.charter).every((v) => String(v).trim().length >= 6)
  );
  check("权重为正整数", t.tasks.every((x) => Number.isInteger(x.weight) && x.weight > 0));
}

console.log("查找");
check("按 id 能取到模板", getTemplate("software")?.id === "software");
check("blank 返回 null", getTemplate("blank") === null);
check("未知 id 返回 null", getTemplate("nope") === null);

console.log("");
if (failed === 0) console.log("全部通过");
else {
  console.log(`${failed} 项失败`);
  process.exit(1);
}
