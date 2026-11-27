import { fileURLToPath } from "node:url";
import { classifyClaude, probeClaudeRaw } from "./probe.mjs";

/**
 * 工具适配器注册表。
 *
 * 异构协作的前提不是「支持所有工具」，而是**同一套协议能容纳不同能力的工具**：
 * 每个适配器只负责三件事——能不能装、怎么调用、输出怎么解析。
 * 其余（租约、上下文、证据、越界检查）对所有工具完全一致。
 */
export const adapters = {
  "claude-code": {
    id: "claude-code",
    label: "Claude Code",
    probe({ deep = false } = {}) {
      const raw = probeClaudeRaw({ deep });
      if (!raw) return null;
      const verdict = classifyClaude(raw);
      return {
        toolType: "claude-code",
        toolVersion: raw.version ?? "unknown",
        binary: raw.binary,
        ...verdict,
        checks: raw,
      };
    },
    buildCommand({ budgetUsd } = {}) {
      return (
        "claude -p --output-format json --permission-mode acceptEdits" +
        (budgetUsd ? ` --max-budget-usd ${Number(budgetUsd)}` : "")
      );
    },
    parse(stdout) {
      const payload = parseJsonLoose(stdout);
      if (!payload) return null;
      return {
        text: String(payload.result ?? ""),
        turns: payload.num_turns ?? null,
        costUsd: payload.total_cost_usd ?? null,
        isError: !!payload.is_error,
      };
    },
  },

  /**
   * 测试替身：一个极简的「第三方 CLI」。
   * 它证明的是协议——换成任何读 stdin、写文件、输出结果的工具，接入方式完全相同。
   */
  "mock-agent": {
    id: "mock-agent",
    label: "Mock Agent（协议验证用）",
    probe() {
      const script = fileURLToPath(new URL("../tools/mock-agent.mjs", import.meta.url));
      return {
        toolType: "mock-agent",
        toolVersion: "0.1.0",
        binary: script,
        capability: "AUTO",
        headlessOk: true,
        note: null,
      };
    },
    buildCommand() {
      const script = fileURLToPath(new URL("../tools/mock-agent.mjs", import.meta.url));
      return `node "${script}"`;
    },
    parse(stdout) {
      const payload = parseJsonLoose(stdout);
      if (payload && typeof payload.result === "string") {
        return { text: payload.result, turns: null, costUsd: 0, isError: false };
      }
      const text = String(stdout ?? "").trim();
      return text ? { text, turns: null, costUsd: 0, isError: false } : null;
    },
  },

  /** 任意命令行工具：提示词走 stdin，stdout 即结果 */
  generic: {
    id: "generic",
    label: "自定义命令",
    probe({ cmd, forceAuto = false } = {}) {
      if (!cmd) return null;
      return {
        toolType: "generic",
        toolVersion: "custom",
        binary: cmd,
        capability: forceAuto ? "AUTO" : "SEMI",
        headlessOk: !!forceAuto,
        note: forceAuto ? null : "自定义命令：无法自动验证无头能力，默认按半自动处理",
      };
    },
    buildCommand({ cmd }) {
      if (!cmd) throw new Error("generic 适配器需要在 login 时提供 --cmd");
      return cmd;
    },
    parse(stdout) {
      const payload = parseJsonLoose(stdout);
      if (payload && typeof payload.result === "string") {
        return { text: payload.result, turns: null, costUsd: null, isError: false };
      }
      const text = String(stdout ?? "").trim();
      return text ? { text, turns: null, costUsd: null, isError: false } : null;
    },
  },
};

export function getAdapter(id) {
  return adapters[id] ?? adapters["claude-code"];
}

export function listAdapterIds() {
  return Object.keys(adapters);
}

function parseJsonLoose(stdout) {
  const trimmed = String(stdout ?? "").trim();
  const candidates = [trimmed, ...trimmed.split(/\r?\n/).reverse()];
  for (const c of candidates) {
    if (!c.startsWith("{")) continue;
    try {
      return JSON.parse(c);
    } catch {
      // 试下一行
    }
  }
  return null;
}
