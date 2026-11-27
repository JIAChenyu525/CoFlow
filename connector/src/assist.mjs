import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { toolDef } from "./tools.mjs";
import { copyToClipboard, readClipboard } from "./clipboard.mjs";
import { chatComplete } from "./llm.mjs";

/**
 * 频道助手：只领取「属于本人」的助手请求。
 *
 * 两种执行方式：
 * - 命令行工具（Claude Code 等）：自动调用，几秒后回帖；
 * - GUI 工具（Cursor / Trae 等）：手动桥接，提示词落盘，你把回答粘回来。
 *
 * 无论哪种，记忆都是同一份（服务端下发的项目快照哈希相同），
 * 请求也只下发到本人设备。
 */
export async function runAssist(flags, deps) {
  const { requireConfig, createApi, runCommand, log, warn } = deps;

  const config = requireConfig();
  const api = createApi(config);
  const cwd = process.cwd();
  const timeoutMs = Number(flags.timeout ?? 5) * 60 * 1000;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  log(
    flags.manual
      ? "助手在线（手动桥接模式）：提示词会写入 .coflow/，你粘贴回答后回帖"
      : "助手在线：等待属于我的请求（Ctrl+C 退出）"
  );

  for (;;) {
    let res;
    try {
      res = await api.call("/api/assistant/pending?wait=20");
    } catch (err) {
      warn(`连接失败：${err}`);
      await sleep(5000);
      continue;
    }

    if (!res.ok) {
      warn(`领取失败：${res.data?.error ?? res.status}`);
      await sleep(5000);
      continue;
    }

    for (const item of res.data.requests ?? []) {
      const stamp = new Date().toLocaleTimeString();
      const memory = item.memory;
      log(`\n[${stamp}] ${item.projectName}：${item.prompt.slice(0, 40)}`);
      if (memory?.hash) log(`  记忆快照：${memory.hash}（全队同一份）`);

      const historyText = (item.context ?? [])
        .map((c) => `- ${c.author}：${c.body}`)
        .join("\n");

      const sharedMemory = memory?.text
        ? `\n## 全队共享的项目记忆（快照 ${memory.hash}）\n${memory.text}`
        : historyText
          ? `\n最近的频道记录：\n${historyText}`
          : "";

      const prompt = [
        `你是「${item.owner ?? "我"}」自己在 CoFlow 项目「${item.projectName}」频道里的私人助手。`,
        "这个项目里每位成员都有自己的助手，跑在各自的电脑上；但所有人读到的是同一份项目记忆。",
        "回答要求：用中文；简短、具体；只依据下面的记忆回答，记忆里没有的事实不要编造；直接给出可以发到频道的内容，不要写“作为助手”之类的开场白。",
        sharedMemory,
        `\n这位成员刚说：\n${item.prompt}`,
      ]
        .filter(Boolean)
        .join("\n");

      // 用哪个工具回答：网页上的「我的助手」优先
      let command = config.toolCommand;
      let toolLabel = "自定义命令";
      let provider = null;

      if (!command) {
        const me = await api.call("/api/device/me");
        const endpoints = me.data?.endpoints ?? [];
        const preferred =
          endpoints.find((e) => e.id === me.data?.preferred_endpoint_id) ?? endpoints[0];
        const toolId = preferred?.tool;
        const def = toolDef(toolId);
        const bin = config.binaries?.[toolId];

        if (toolId && config.providers?.[toolId]) {
          // 本地 API 直连：全自动，不需要任何粘贴
          provider = config.providers[toolId];
          command = null;
          toolLabel = toolId;
        } else if (def?.assist && bin) {
          command = def.assist(bin);
          toolLabel = def.label;
        } else {
          // GUI 工具或未验证的工具：走桥接，而不是直接失败
          command = null;
          toolLabel = def?.label ?? toolId ?? "GUI 工具";
        }
      }

      let text = "";

      if (provider) {
        log(`  工具：${toolLabel} · 本地 API 直连（${provider.model}）`);
        try {
          text = await chatComplete({
            baseUrl: provider.baseUrl,
            apiKey: provider.apiKey,
            model: provider.model,
            system:
              "你是团队成员在 CoFlow 项目里的私人助手。只依据用户给出的项目记忆回答，记忆里没有的事实不要编造；用中文，简短具体，直接给可以发到频道的内容。",
            user: prompt,
            timeoutMs,
          });
        } catch (err) {
          const reason = String(err?.message ?? err).slice(0, 300);
          await api.call(`/api/assistant/${item.id}/fail`, {
            method: "POST",
            body: JSON.stringify({ error: reason }),
          });
          warn(`  ✗ 失败：${reason}`);
          continue;
        }
      } else if (flags.clipboard) {
        // 剪贴板桥接：不用文件、不用手敲，切个窗口复制粘贴就行
        const copied = copyToClipboard(prompt);
        if (!copied) {
          warn("  剪贴板不可用，改用文件桥接");
          text = await manualBridge(item.id, prompt, log, flags);
        } else {
          log(`  工具：${toolLabel} · 剪贴板桥接`);
          log("  1. 切到你的工具，Ctrl+V 粘贴提示词");
          log("  2. 把它的回答复制下来");
          log("  3. 回到这个窗口按回车");
          await waitEnter();
          const clip = readClipboard();
          if (!clip || clip === prompt.trim()) {
            warn("  ✗ 剪贴板里还是原提示词（或为空），没有收到回答");
            await api.call(`/api/assistant/${item.id}/fail`, {
              method: "POST",
              body: JSON.stringify({ error: "剪贴板里没有新的回答" }),
            });
            continue;
          }
          text = clip;
        }
      } else if (!command || flags.manual) {
        log(`  工具：${toolLabel} · 手动桥接`);
        text = await manualBridge(item.id, prompt, log, flags);
        if (!text) {
          const reason = "手动桥接没有收到回答（空内容）";
          await api.call(`/api/assistant/${item.id}/fail`, {
            method: "POST",
            body: JSON.stringify({ error: reason }),
          });
          warn(`  ✗ ${reason}`);
          continue;
        }
      } else {
        log(`  工具：${toolLabel} · ${command}`);
        const result = await runCommand(cwd, command, prompt, timeoutMs);
        text = (result.stdout || "").trim();

        if (result.code !== 0 || !text) {
          const reason = result.killed
            ? "助手执行超时"
            : (result.stderr || "工具没有返回内容").slice(0, 300);
          await api.call(`/api/assistant/${item.id}/fail`, {
            method: "POST",
            body: JSON.stringify({ error: reason }),
          });
          warn(`  ✗ 失败：${reason}`);
          continue;
        }
      }

      const reply = await api.call(`/api/assistant/${item.id}/reply`, {
        method: "POST",
        body: JSON.stringify({ body: text.slice(0, 8000) }),
      });
      if (reply.ok) log("  ✓ 已回帖到频道");
      else warn(`  回帖失败：${reply.data?.error ?? reply.status}`);
    }
  }
}

/**
 * 手动桥接：把完整提示词落到 .coflow/，等用户把 GUI 工具的回答粘回来。
 *
 * 三种输入方式：
 * - --answer-file <路径>：从文件读（脚本、批量用）
 * - 管道：`cat answer.txt | coflow assist --manual`
 * - 交互：逐行粘贴，单独一行 /done 结束
 */
async function manualBridge(requestId, prompt, log, flags = {}) {
  const dir = path.join(process.cwd(), ".coflow");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `assist-${requestId}.md`);
  fs.writeFileSync(file, prompt, "utf8");

  const stripDone = (s) => String(s).replace(/\/done\s*$/, "").trim();

  if (flags["answer-file"]) {
    return stripDone(fs.readFileSync(String(flags["answer-file"]), "utf8"));
  }

  log("");
  log("  ── 手动桥接 ────────────────────────────────");
  log(`  提示词已写入：${file}`);
  log("  1. 打开这个文件，整段复制");
  log("  2. 粘贴到你的工具（Cursor / Trae / 网页）");
  log("  3. 把回答粘贴回这里，单独一行输入 /done 结束");
  log("  ───────────────────────────────────────────");
  log("");

  if (!process.stdin.isTTY) {
    let data = "";
    for await (const chunk of process.stdin) data += chunk;
    return stripDone(data);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const lines = [];
  for (;;) {
    const line = await rl.question("> ");
    if (line.trim() === "/done") break;
    lines.push(line);
  }
  rl.close();
  return lines.join("\n").trim();
}


/** 等待用户按回车（剪贴板桥接用）；非交互环境直接跳过 */
async function waitEnter() {
  if (!process.stdin.isTTY) return;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await rl.question("> 粘贴完成后按回车…");
  rl.close();
}
