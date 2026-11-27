import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Claude Code 的能力探测。
 * 只回答「能不能被调用」，不读任何密钥。
 */
export function probeClaudeRaw({ deep = false } = {}) {
  const binary = findOnPath("claude");
  if (!binary) return null;

  const result = { binary, version: null, versionOk: false, headlessFlags: false, deepOk: null };

  try {
    result.version = execFileSync("claude --version", {
      shell: true,
      encoding: "utf8",
      timeout: 25000,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .trim()
      .split(/\r?\n/)[0]
      .slice(0, 40);
    result.versionOk = true;
  } catch {
    result.versionOk = false;
  }

  if (result.versionOk) {
    try {
      const help = execFileSync("claude --help", {
        shell: true,
        encoding: "utf8",
        timeout: 25000,
        stdio: ["ignore", "pipe", "ignore"],
      });
      result.headlessFlags =
        help.includes("--output-format") &&
        (help.includes("-p, --print") || help.includes("--print"));
    } catch {
      result.headlessFlags = false;
    }
  }

  // --deep 会真的调用一次模型（花钱），只给 doctor --deep 用
  if (deep && result.headlessFlags) {
    try {
      execFileSync("claude -p --output-format json --max-budget-usd 0.02", {
        shell: true,
        encoding: "utf8",
        timeout: 120000,
        input: "只回答：ok\n",
        stdio: ["pipe", "ignore", "ignore"],
      });
      result.deepOk = true;
    } catch {
      result.deepOk = false;
    }
  }

  return result;
}

/** 纯函数，便于单测：给定探测结果，判定能力等级与原因 */
export function classifyClaude({ versionOk, headlessFlags, deepOk = null }) {
  if (!versionOk) {
    return {
      capability: "SEMI",
      headlessOk: false,
      note: "已找到可执行文件，但执行 --version 失败（可能是权限或 shim 问题）",
    };
  }
  if (!headlessFlags) {
    return {
      capability: "SEMI",
      headlessOk: false,
      note: "该版本不支持无头 JSON 输出（缺少 --print / --output-format）",
    };
  }
  if (deepOk === false) {
    return {
      capability: "SEMI",
      headlessOk: false,
      note: "无头调用实测失败（可能是登录、配额或网络问题）",
    };
  }
  return { capability: "AUTO", headlessOk: true, note: null };
}

export function deviceName() {
  const platform = os.platform() === "win32" ? "Windows" : os.platform();
  return `${os.hostname()} 的 ${platform}`;
}

export function findOnPath(cmd) {
  const dirs = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  const exts = os.platform() === "win32" ? ["", ".cmd", ".exe", ".bat", ".ps1"] : [""];

  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = path.join(dir, cmd + ext);
      try {
        if (fs.statSync(candidate).isFile()) return candidate;
      } catch {
        // 继续找
      }
    }
  }
  return null;
}
