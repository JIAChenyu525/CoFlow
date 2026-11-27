import { execFileSync } from "node:child_process";
import crypto from "node:crypto";

/**
 * 证据从系统采集，不听 Agent 自述。
 * 半自动模式下，Agent 的部分其实是「人跑的」，所以证据就是 git 工作区本身。
 */
export function collectGitEvidence(cwd, sinceIso) {
  const git = (args) =>
    execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      timeout: 20000,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .trim()
      .replace(/\r\n/g, "\n");

  try {
    git(["rev-parse", "--is-inside-work-tree"]);
  } catch {
    return { isRepo: false };
  }

  let branch = "detached";
  try {
    branch = git(["branch", "--show-current"]) || "detached";
  } catch {}

  let status = "";
  try {
    status = git(["status", "--porcelain"]);
  } catch {}

  let commits = "";
  try {
    commits = git(["log", `--since=${sinceIso}`, "--pretty=%h %s"]);
  } catch {}

  let diffStat = "";
  try {
    diffStat = status ? git(["diff", "--stat"]) : "";
  } catch {}

  const fingerprint = crypto
    .createHash("sha256")
    .update(branch + "\n" + status + "\n" + commits)
    .digest("hex")
    .slice(0, 12);

  return { isRepo: true, branch, status, commits, diffStat, fingerprint };
}

/** 跑一条检查命令，记录真实退出码——它比任何「测试通过」的自述都可信 */
export function runCheck(command, cwd) {
  try {
    const out = execFileSync(command, {
      cwd,
      shell: true,
      encoding: "utf8",
      timeout: 120000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { name: command, command, exit_code: 0, output_tail: tail(out) };
  } catch (err) {
    const out = `${err.stdout ?? ""}${err.stderr ?? ""}`;
    return { name: command, command, exit_code: err.status ?? 1, output_tail: tail(out) };
  }
}

function tail(text, n = 400) {
  const s = String(text ?? "").trim();
  return s.length > n ? "…" + s.slice(-n) : s;
}
