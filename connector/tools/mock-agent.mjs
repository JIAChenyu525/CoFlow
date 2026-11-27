#!/usr/bin/env node
/**
 * 测试替身：一个「第三方 CLI」形状的工具。
 *
 * 它存在的目的不是假装智能，而是证明协议是通用的：
 * 读 stdin 的提示词 → 在工作区写文件 → 输出结构化结果。
 * 换成任何真实的命令行工具，接入方式完全一样。
 */
import fs from "node:fs";

let input = "";
for await (const chunk of process.stdin) input += chunk;

const blocks = (input.match(/<data source="/g) ?? []).length;
const hasTask = input.includes("## 当前任务");

fs.mkdirSync("docs", { recursive: true });
fs.writeFileSync(
  "docs/mock-agent.md",
  [
    "# Mock Agent 产出",
    "",
    `生成时间：${new Date().toISOString()}`,
    `收到提示词：${input.length} 字符，${blocks} 个 <data> 块`,
    `识别到任务段：${hasTask ? "是" : "否"}`,
    "",
    "这份文件由一个只读 stdin、只写工作区的命令行工具生成。",
    "CoFlow 不关心它是谁写的，只关心它有没有越界、有没有产物。",
    "",
  ].join("\n")
);

console.log(
  JSON.stringify({
    result: `已完成：生成 docs/mock-agent.md（解析 ${blocks} 个 data 块）`,
    num_turns: 1,
    total_cost_usd: 0,
  })
);
