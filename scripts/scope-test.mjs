/**
 * 越界检查测试：自动执行的安全底线。
 * 运行：node scripts/scope-test.mjs
 */
import { findViolations, isAllowed, isDenied } from "../connector/src/cli.mjs";

const DENIED = [".env", "**/*.pem", "**/*.key"];

let failed = 0;
function check(name, cond) {
  console.log(`  ${cond ? "✓" : "✗"} ${name}`);
  if (!cond) failed++;
}

const cwd = process.platform === "win32" ? "D:\\coflow-demo" : "/tmp/coflow-demo";

console.log("绝对路径授权");
const absAllowed = [cwd];
check("目录内文件放行", isAllowed("docs/usage.md", absAllowed, cwd));
check("目录外文件拦截", !isAllowed("../secret.txt", absAllowed, cwd));
check("前缀相似但不同目录拦截", !isAllowed("../coflow-demo-evil/a.txt", absAllowed, cwd));
check("反斜杠归一化", isAllowed("docs\\usage.md", absAllowed, cwd));
check("大小写不敏感", isAllowed("DOCS/Usage.MD", absAllowed, cwd));

console.log("相对路径授权");
const relAllowed = ["docs/pitch"];
check("授权子目录内放行", isAllowed("docs/pitch/1.md", relAllowed, cwd));
check("同名前缀目录拦截", !isAllowed("docs/pitchfork/x.md", relAllowed, cwd));
check("其它目录拦截", !isAllowed("docs/usage.md", relAllowed, cwd));

console.log("git status 解析");
const evidence = {
  isRepo: true,
  status: [" M docs/pitch.md", "?? docs/usage.md", "R  old.md -> docs/new.md"].join("\n"),
};
const v1 = findViolations(evidence, absAllowed, cwd);
check("全部在授权目录内 → 无违规", v1.length === 0);

const v2 = findViolations({ isRepo: true, status: " M .env\n?? docs/usage.md" }, absAllowed, cwd, DENIED);
check(".env 被识别为越界", v2.length === 1 && v2[0] === ".env");

const v2b = findViolations({ isRepo: true, status: " M .env\n?? docs/usage.md" }, absAllowed, cwd);
check("不传黑名单时 .env 不被拦截（证明拦截来自黑名单）", v2b.length === 0);

console.log("黑名单匹配");
check(".env 命中", isDenied(".env", DENIED));
check("子目录 .env 命中", isDenied("config/.env", DENIED));
check("密钥文件命中", isDenied("certs/server.pem", DENIED));
check("普通文档不命中", !isDenied("docs/usage.md", DENIED));
check("相似名不误伤", !isDenied("docs/env.md", DENIED));

const v3 = findViolations({ isRepo: false }, absAllowed, cwd);
check("非 git 目录不误报", v3.length === 0);

console.log("");
if (failed === 0) console.log("全部通过");
else {
  console.log(`${failed} 项失败`);
  process.exit(1);
}
