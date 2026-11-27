/**
 * 工作声明冲突的端到端验证（两台设备）。
 *
 * 前置：fixture 已插入 4 条 OFFERED 租约（locktest_l1..l4）
 *   A = claude-code 设备（~/.coflow/config.json）
 *   B = mock-agent 设备（COFLOW_HOME 指定的 config.json）
 *
 * 运行：node scripts/lock-live-test.mjs <tokenA> <tokenB>
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3000";
const [tokenA, tokenB] = process.argv.slice(2);

if (!tokenA || !tokenB) {
  const a = path.join(os.homedir(), ".coflow", "config.json");
  const b = process.env.COFLLOW_HOME_B ?? "D:/coflow-agent-b/config.json";
  console.error("用法：node scripts/lock-live-test.mjs <tokenA> <tokenB>");
  console.error(`也可以从 ${a} 和 ${b} 里取 deviceToken`);
  process.exit(1);
}

let failed = 0;
function check(name, cond, extra = "") {
  console.log(`  ${cond ? "✓" : "✗"} ${name}${cond ? "" : " " + extra}`);
  if (!cond) failed++;
}

async function accept(leaseId, token, declared) {
  const res = await fetch(`${BASE}/api/leases/${leaseId}/accept`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ declaredPaths: declared }),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

console.log("软锁：允许并行，但要报重叠");
const r1 = await accept("locktest_l1", tokenA, ["docs"]);
check("A 声明 docs → 接受", r1.status === 200, JSON.stringify(r1.data));
check("A 无冲突", (r1.data.conflicts ?? []).length === 0);
check("A 判定为软锁", r1.data.lock_mode === "soft", String(r1.data.lock_mode));

const r2 = await accept("locktest_l2", tokenB, ["docs/pitch.md"]);
check("B 声明 docs/pitch.md → 接受", r2.status === 200, JSON.stringify(r2.data));
check("B 报告 1 处重叠", (r2.data.conflicts ?? []).length === 1, JSON.stringify(r2.data.conflicts));
check("重叠指向 A 的任务", r2.data.conflicts?.[0]?.label === "Lock test A");

console.log("独占：无重叠时放行");
const r3 = await accept("locktest_l3", tokenB, ["package.json"]);
check("B 声明 package.json → 接受", r3.status === 200, JSON.stringify(r3.data));
check("判定为独占", r3.data.lock_mode === "exclusive", String(r3.data.lock_mode));

console.log("独占：重叠时拒绝");
const r4 = await accept("locktest_l4", tokenA, ["package.json"]);
check("A 再声明 package.json → 409", r4.status === 409, `got ${r4.status}`);
check("错误码正确", r4.data.error === "path_locked", String(r4.data.error));
check("拒绝时不产生会话", !r4.data.session_id);

console.log("");
if (failed === 0) console.log("全部通过");
else {
  console.log(`${failed} 项失败`);
  process.exit(1);
}
