/**
 * 能力分级测试：降级必须分级、必须说清原因，不能一律 AUTO。
 * 运行：node scripts/capability-test.mjs
 */
import { classifyClaude } from "../connector/src/probe.mjs";

let failed = 0;
function check(name, cond, extra = "") {
  console.log(`  ${cond ? "✓" : "✗"} ${name} ${cond ? "" : extra}`);
  if (!cond) failed++;
}

console.log("正常路径");
const auto = classifyClaude({ versionOk: true, headlessFlags: true });
check("版本可用 + 无头旗标 → AUTO", auto.capability === "AUTO");
check("AUTO 时 headlessOk 为真", auto.headlessOk === true);
check("AUTO 没有降级原因", auto.note === null);

console.log("降级路径");
const broken = classifyClaude({ versionOk: false, headlessFlags: false });
check("二进制在但跑不动 → SEMI", broken.capability === "SEMI");
check("说明提到 --version", String(broken.note).includes("--version"));
check("headlessOk 为假", broken.headlessOk === false);

const noHeadless = classifyClaude({ versionOk: true, headlessFlags: false });
check("无无头旗标 → SEMI", noHeadless.capability === "SEMI");
check("说明提到 --output-format", String(noHeadless.note).includes("--output-format"));

const deepFail = classifyClaude({ versionOk: true, headlessFlags: true, deepOk: false });
check("实测失败 → 降级 SEMI", deepFail.capability === "SEMI");
check("说明指出实测失败", String(deepFail.note).includes("实测"));

const deepOk = classifyClaude({ versionOk: true, headlessFlags: true, deepOk: true });
check("实测通过 → 仍是 AUTO", deepOk.capability === "AUTO");

console.log("");
if (failed === 0) console.log("全部通过");
else {
  console.log(`${failed} 项失败`);
  process.exit(1);
}
