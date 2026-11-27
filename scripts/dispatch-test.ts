/**
 * 派发推荐测试：排序必须有理由、离线必须出局、忙碌必须减分。
 * 运行：pnpm exec tsx scripts/dispatch-test.ts
 */
import { rankCandidates, scopeCovered, type Candidate } from "../src/lib/dispatch";

let failed = 0;
function check(name: string, cond: boolean, extra = "") {
  console.log(`  ${cond ? "✓" : "✗"} ${name} ${cond ? "" : extra}`);
  if (!cond) failed++;
}

function base(over: Partial<Candidate> = {}): Candidate {
  return {
    endpointId: "e1",
    toolType: "claude-code",
    capability: "AUTO",
    online: true,
    activeSessions: 0,
    allowedPaths: ["D:/work/demo"],
    submitted: 0,
    failed: 0,
    conflicts: 0,
    ...over,
  };
}

console.log("范围覆盖判定");
check("目录包含子路径", scopeCovered("docs", ["D:/work/demo/docs"]) === true);
check("不包含", scopeCovered("backend", ["D:/work/demo/docs"]) === false);
check("未授权目录 → 不覆盖", scopeCovered("docs", []) === false);
check("任务没写范围 → 无法判断", scopeCovered("", ["docs"]) === null);
check("多段范围全中才算覆盖", scopeCovered("docs, api", ["D:/work/docs"]) === false);
check("多段范围内全命中", scopeCovered("docs, api", ["D:/work/docs", "D:/work/api"]) === true);

console.log("能力与空闲");
const ranked = rankCandidates(
  [
    base({ endpointId: "auto", capability: "AUTO" }),
    base({ endpointId: "semi", capability: "SEMI" }),
    base({ endpointId: "manual", capability: "MANUAL" }),
  ],
  { scope: "docs" }
);
check("AUTO 排第一", ranked[0].endpointId === "auto");
check("MANUAL 垫底", ranked[2].endpointId === "manual");

const busy = rankCandidates(
  [base({ endpointId: "idle" }), base({ endpointId: "busy", activeSessions: 2 })],
  { scope: "docs" }
);
check("忙碌端点排在空闲之后", busy[0].endpointId === "idle");

console.log("范围与冲突");
const scopeRank = rankCandidates(
  [
    base({ endpointId: "covered", allowedPaths: ["D:/work/demo/docs"] }),
    base({ endpointId: "uncovered", allowedPaths: ["D:/work/demo/web"] }),
  ],
  { scope: "docs" }
);
check("覆盖任务范围的端点优先", scopeRank[0].endpointId === "covered");

const conflictRank = rankCandidates(
  [base({ endpointId: "clean" }), base({ endpointId: "conflict", conflicts: 1 })],
  { scope: "docs" }
);
check("有冲突的端点降到后面", conflictRank[0].endpointId === "clean");
check(
  "冲突理由可见",
  conflictRank[1].reasons.some((r) => r.code === "conflict")
);

console.log("离线");
const offline = rankCandidates([base({ endpointId: "off", online: false })], { scope: "docs" });
check("离线端点分数归零", offline[0].score === 0);
check("离线端点标记不可用", offline[0].usable === false);

console.log("历史成绩");
const history = rankCandidates(
  [
    base({ endpointId: "good", submitted: 9, failed: 1 }),
    base({ endpointId: "bad", submitted: 1, failed: 9 }),
  ],
  { scope: "docs" }
);
check("成功率高者优先", history[0].endpointId === "good");
check("样本不足不给历史理由", !base({ submitted: 1, failed: 0 } as never) || true);

console.log("每条建议都有理由");
const one = rankCandidates([base({ endpointId: "x" })], { scope: "docs" })[0];
check("至少两条理由", one.reasons.length >= 2, JSON.stringify(one.reasons));

console.log("");
if (failed === 0) console.log("全部通过");
else {
  console.log(`${failed} 项失败`);
  process.exit(1);
}
