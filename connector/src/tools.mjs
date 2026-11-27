import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * 本机 AI 工具探测表。
 *
 * 只做两件事：找到可执行文件、读出版本。
 * 能不能自动执行、怎么调用是适配器的事，这里是"有什么"。
 */
export const KNOWN_TOOLS = [
  {
    id: "claude-code",
    label: "Claude Code",
    bins: ["claude"],
    verified: true, // 已验证无头对话与自动执行
    assist: (bin) => `${bin} -p --output-format text`,
  },
  {
    id: "copilot",
    label: "GitHub Copilot CLI",
    bins: ["copilot"],
    verified: false,
    assist: (bin) => `${bin} -p`,
    // VS Code 自带的 copilot 占位程序会报 "Copilot CLI was not found"，需要排除
    rejectIf: /not found|未找到/i,
  },
  {
    id: "codex",
    label: "OpenAI Codex CLI",
    bins: ["codex"],
    verified: false,
    assist: null,
  },
  {
    id: "gemini",
    label: "Gemini CLI",
    bins: ["gemini"],
    verified: false,
    assist: null,
  },
  {
    id: "qwen",
    label: "Qwen Code",
    bins: ["qwen"],
    verified: false,
    assist: null,
  },
  {
    id: "opencode",
    label: "OpenCode",
    bins: ["opencode"],
    verified: false,
    assist: null,
  },
  {
    id: "aider",
    label: "Aider",
    bins: ["aider"],
    verified: false,
    assist: null,
  },
  {
    id: "ollama",
    label: "Ollama",
    bins: ["ollama"],
    verified: false,
    assist: null,
  },
  {
    id: "cursor-agent",
    label: "Cursor Agent",
    bins: ["cursor-agent"],
    verified: false,
    assist: null,
  },
  {
    id: "crush",
    label: "Crush",
    bins: ["crush"],
    verified: false,
    assist: null,
  },
];

function findBinary(names) {
  const exts = ["", ".cmd", ".exe", ".bat", ".ps1"];
  const dirs = (process.env.PATH || "").split(path.delimiter).filter(Boolean);

  for (const name of names) {
    for (const dir of dirs) {
      for (const ext of exts) {
        const candidate = path.join(dir, name + ext);
        try {
          if (fs.statSync(candidate).isFile()) return candidate;
        } catch {
          // 继续找
        }
      }
    }
  }
  return null;
}

function readVersion(bin) {
  try {
    const out = execFileSync(`${JSON.stringify(bin)} --version`, {
      shell: true,
      timeout: 15_000,
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    });
    return String(out || "").trim().split("\n")[0].slice(0, 80);
  } catch (err) {
    const out = `${err?.stdout ?? ""} ${err?.stderr ?? ""} ${err?.message ?? ""}`.trim();
    return out ? `ERR:${out.split("\n")[0].slice(0, 80)}` : null;
  }
}

/**
 * 扫描本机所有已知 AI 工具。
 * 返回形如 [{ id, label, binary, version, usable, note }]
 */
export function detectTools() {
  const found = [];

  for (const tool of KNOWN_TOOLS) {
    const binary = findBinary(tool.bins);
    if (!binary) continue;

    const version = readVersion(binary);
    const failed = !version || version.startsWith("ERR:");
    const rejected = tool.rejectIf && version ? tool.rejectIf.test(version) : false;

    if (rejected) {
      // 找到了占位程序但实际不可用，明确记录下来，避免用户以为"没检测到"
      found.push({
        id: tool.id,
        label: tool.label,
        binary,
        version: version ?? "unknown",
        usable: false,
        note: "找到的是占位程序，命令行工具本身尚未安装",
      });
      continue;
    }

    found.push({
      id: tool.id,
      label: tool.label,
      binary,
      version: failed ? "unknown" : version,
      usable: !failed,
      note: failed ? "可执行文件存在，但 --version 执行失败（可能是权限或 shim 问题）" : null,
    });
  }

  return found;
}

/** 找到某个工具 id 的探测定义 */
export function toolDef(id) {
  return KNOWN_TOOLS.find((t) => t.id === id) ?? null;
}


/**
 * GUI 桌面类 AI 应用。
 *
 * 它们没有命令行入口，但可以在网页上被选为助手，
 * 由 `coflow assist --clipboard` 用剪贴板桥接：
 * 提示词自动写进剪贴板，你把回答复制回来即可。
 */
export const GUI_APPS = [
  { id: "doubao", label: "豆包", local: ["Doubao"], appdata: ["Doubao"] },
  { id: "workbuddy", label: "WorkBuddy", local: ["WorkBuddy", "WorkBuddyExtension"] },
  { id: "codex-desktop", label: "Codex 桌面版", msix: /^OpenAI\.Codex/i, local: ["OpenAI"] },
  { id: "deepseek-desktop", label: "DeepSeek 桌面版", local: ["@deepseek-aidsh-desktop-updater"], appdata: ["DeepSeek"] },
  { id: "qoder", label: "Qoder", local: ["qoder-work-updater"], appdata: ["Qoder"] },
  { id: "cursor", label: "Cursor", local: ["Programs/Cursor"], appdata: ["Cursor"] },
  { id: "trae", label: "Trae", local: ["Programs/Trae", "Trae"], appdata: ["Trae"] },
  { id: "tongyi", label: "通义灵码", local: ["Lingma", "Tongyi"], appdata: ["Lingma"] },
];

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

/** 扫描本机安装的 GUI AI 应用（只判断目录是否存在，不读取应用数据） */
export function detectGuiApps() {
  if (process.platform !== "win32") return [];

  const local = path.join(os.homedir(), "AppData", "Local");
  const roaming = path.join(os.homedir(), "AppData", "Roaming");
  const windowsApps = path.join(local, "Microsoft", "WindowsApps");

  let msixNames = [];
  try {
    msixNames = fs.readdirSync(windowsApps);
  } catch {
    msixNames = [];
  }

  const found = [];
  for (const app of GUI_APPS) {
    let hit = null;

    if (app.msix) {
      const match = msixNames.find((n) => app.msix.test(n));
      if (match) hit = path.join(windowsApps, match);
    }
    if (!hit) {
      for (const rel of app.local ?? []) {
        const p = path.join(local, rel);
        if (exists(p)) {
          hit = p;
          break;
        }
      }
    }
    if (!hit) {
      for (const rel of app.appdata ?? []) {
        const p = path.join(roaming, rel);
        if (exists(p)) {
          hit = p;
          break;
        }
      }
    }

    if (hit) {
      found.push({
        id: app.id,
        label: app.label,
        path: hit,
        version: "桌面版",
        usable: true,
        gui: true,
      });
    }
  }

  return found;
}
