/**
 * 工作声明与冲突判定测试。
 * 运行：pnpm exec tsx scripts/locks-test.ts
 */
import { findConflicts, modeFor, pathsOverlap, describeConflicts } from "../src/lib/locks";

let failed = 0;
function check(name: string, cond: boolean, extra = "") {
  console.log(`  ${cond ? "✓" : "✗"} ${name} ${cond ? "" : extra}`);
  if (!cond) failed++;
}

console.log("模式判定");
check("未声明 → 自由", modeFor([]) === "free");
check("普通目录 → 软锁", modeFor(["docs/pitch"]) === "soft");
check("迁移脚本 → 独占", modeFor(["backend/migrations/001.sql"]) === "exclusive");
check("依赖清单 → 独占", modeFor(["package.json"]) === "exclusive");
check("schema 文件 → 独占", modeFor(["prisma/schema.prisma"]) === "exclusive");

console.log("路径重叠");
check("完全相同", pathsOverlap("docs/pitch.md", "docs/pitch.md"));
check("父子目录", pathsOverlap("docs", "docs/pitch.md"));
check("反向父子", pathsOverlap("docs/pitch.md", "docs"));
check("反斜杠归一化", pathsOverlap("docs\\pitch.md", "docs/pitch.md"));
check("大小写不敏感", pathsOverlap("DOCS/Pitch.md", "docs/pitch.md"));
check("相似前缀不算重叠", !pathsOverlap("docs/pitch", "docs/pitchfork"));
check("不同目录不重叠", !pathsOverlap("backend", "docs"));

console.log("冲突计算");
const others = [
  { id: "s1", label: "路演材料", paths: ["docs/pitch.md"] },
  { id: "s2", label: "后端接口", paths: ["backend/upload"] },
];
const c1 = findConflicts(["docs"], others);
check("父目录声明命中一个冲突", c1.length === 1 && c1[0].with === "s1");
const c2 = findConflicts(["frontend"], others);
check("无关目录无冲突", c2.length === 0);
const c3 = findConflicts(["docs", "backend/upload"], others);
check("两处重叠都报出来", c3.length === 2);

console.log("提示文案");
const exclusiveText = describeConflicts("exclusive", c1);
check("独占提示拒绝", String(exclusiveText).includes("拒绝"));
const softText = describeConflicts("soft", c1);
check("软锁提示确认", String(softText).includes("确认"));
check("无冲突无文案", describeConflicts("soft", []) === null);

console.log("");
if (failed === 0) console.log("全部通过");
else {
  console.log(`${failed} 项失败`);
  process.exit(1);
}
