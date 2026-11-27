import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createApi } from "./api.mjs";
import { loadConfig, saveConfig, requireConfig, configPath, CONFIG_DIR } from "./config.mjs";
import { deviceName } from "./probe.mjs";
import { getAdapter, listAdapterIds } from "./adapters.mjs";
import { collectGitEvidence, runCheck } from "./evidence.mjs";
import { renderPackage } from "./render.mjs";
import { enqueue, flush } from "./outbox.mjs";
import { runAssist } from "./assist.mjs";
import { detectTools, detectGuiApps, toolDef } from "./tools.mjs";
import { chatComplete } from "./llm.mjs";

const WORKSPACE_DIR = ".coflow";
const SESSION_FILE = "session.json";

function parseFlags(args) {
  const flags = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq > -1) {
        flags[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        const next = args[i + 1];
        if (next && !next.startsWith("--")) {
          flags[a.slice(2)] = next;
          i++;
        } else {
          flags[a.slice(2)] = true;
        }
      }
    } else {
      flags._.push(a);
    }
  }
  return flags;
}

function sessionPath(cwd) {
  return path.join(cwd, WORKSPACE_DIR, SESSION_FILE);
}

function loadSession(cwd) {
  try {
    return JSON.parse(fs.readFileSync(sessionPath(cwd), "utf8"));
  } catch {
    return null;
  }
}

/** .coflow/ 是本地运行时状态，不该被提交进用户的仓库 */
function ensureWorkspace(cwd) {
  const dir = path.join(cwd, WORKSPACE_DIR);
  fs.mkdirSync(dir, { recursive: true });
  const ignore = path.join(dir, ".gitignore");
  if (!fs.existsSync(ignore)) {
    fs.writeFileSync(ignore, "*\n!.gitignore\n");
  }
}

function saveSession(cwd, session) {
  ensureWorkspace(cwd);
  fs.writeFileSync(sessionPath(cwd), JSON.stringify(session, null, 2));
}

function clearSession(cwd) {
  try {
    fs.unlinkSync(sessionPath(cwd));
  } catch {}
}

const log = (...a) => console.log(...a);
const warn = (...a) => console.error(...a);

export async function main(argv) {
  const [cmd, ...rest] = argv;
  const flags = parseFlags(rest);

  switch (cmd) {
    case "login":
      return login(flags);
    case "status":
      return status();
    case "doctor":
      return doctor(flags);
    case "scan":
      return scan();
    case "add-tool":
      return addTool(flags);
    case "add-ai":
      return addAi(flags);
    case "ask":
      return ask(flags);
    case "pull":
      return pull(flags);
    case "run":
      return run(flags);
    case "submit":
      return submit(flags);
    case "note":
      return note(flags);
    case "assist":
      return runAssist(flags, { requireConfig, createApi, runCommand, log, warn });
    case "sync":
      return sync();
    case "logout":
      return logout();
    case undefined:
    case "help":
    case "--help":
      return help();
    default:
      warn(`未知命令：${cmd}\n`);
      return help();
  }
}

function help() {
  log(`coflow — CoFlow 本地连接器

用法：
  coflow login [--base http://localhost:3000]   配对这台设备
  coflow status                                  查看设备与端点
  coflow doctor [--update] [--deep]               检测本机能力，解释为什么是这个等级
  coflow scan                                    重新扫描本机 AI 工具并同步到网页（不用重新配对）
  coflow add-tool --name "Cursor"                手动登记一个 GUI 工具（无命令行入口）
  coflow add-ai --name deepseek --base https://api.deepseek.com/v1 --model deepseek-chat
                                                 直连模型 API（本地密钥），实现全自动回答
  coflow ask --tool deepseek "问题"               单次自检：直接问模型，不经过频道
  coflow pull                                    领取任务并把上下文包落盘（半自动）
  coflow run [--timeout 20] [--budget 2]         领取任务并自动执行（需要 AUTO 端点 + 已授权目录）
  coflow submit --summary "做了什么" [--check "pnpm test"] [--doc 路径]
  coflow assist [--manual|--clipboard]           我的频道助手：命令行工具自动回答，GUI 应用走桥接
  coflow note "进度说明"                          记录一条进度事件（离线会排队）
  coflow sync                                    补传离线事件
  coflow logout                                  清除本机令牌

工作目录下会生成 .coflow/ 目录：session.json（当前会话）、outbox.json（待传事件）、task-*.md（任务包）。
`);
}

async function login(flags) {
  const existing = loadConfig();
  const baseUrl = String(flags.base ?? existing?.baseUrl ?? "http://localhost:3000");
  const api = createApi({ baseUrl });

  // 扫本机所有已知 AI 工具：检测到几个就登记几个，由用户挑一个当助手
  const detected = detectTools();
  const usable = detected.filter((t) => t.usable);
  const unusable = detected.filter((t) => !t.usable);

  log(`CoFlow 登录 · ${baseUrl}`);
  if (detected.length === 0) {
    log("未检测到任何已知的 AI 命令行工具；将以手动模式接入。");
    log(`  已知工具：${["claude", "codex", "gemini", "qwen", "opencode", "aider", "cursor-agent"].join(", ")}`);
  } else {
    log(`检测到 ${detected.length} 个：`);
    for (const t of detected) {
      log(
        `  ${t.usable ? "✓" : "·"} ${t.label}  ${t.version}` +
          (t.note ? `  （${t.note}）` : "")
      );
    }
  }

  const selected = (flags.tool ? usable.filter((t) => t.id === flags.tool) : usable);
  const chosen = selected.length > 0 ? selected : usable;

  const toolProfiles = chosen.map((t) => {
    const adapter = t.id === "claude-code" ? getAdapter("claude-code") : null;
    const verdict = adapter
      ? adapter.probe({ deep: false })
      : { capability: "SEMI", headlessOk: false, note: "已检测到，但尚未验证无头调用" };
    return {
      toolType: t.id,
      toolVersion: t.version,
      capability: verdict?.capability ?? "SEMI",
      headlessOk: !!verdict?.headlessOk,
      capabilityNote: t.note ?? verdict?.note ?? null,
    };
  });

  if (flags.cmd) {
    toolProfiles.push({
      toolType: "generic",
      toolVersion: "custom",
      capability: flags.auto ? "AUTO" : "SEMI",
      headlessOk: !!flags.auto,
      capabilityNote: flags.auto ? null : "自定义命令：无法自动验证无头能力",
    });
  }

  const osLabel =
    os.platform() === "win32" ? `Windows ${os.release()}` : `${os.platform()} ${os.release()}`;

  const start = await api.call("/api/device/pair/start", {
    method: "POST",
    body: JSON.stringify({ name: deviceName(), os: osLabel }),
  });
  if (!start.ok) {
    warn(`配对请求失败：${start.data?.error ?? start.status}`);
    process.exit(1);
  }

  const { user_code, device_code, interval } = start.data;

  const pairUrl = `${baseUrl}/agent?pair=${encodeURIComponent(user_code)}`;
  log("");
  log("  在浏览器里点一下「授权这台设备」即可（配对码已自动填好）：");
  log("      " + pairUrl);
  log("");
  log("      " + user_code);
  log("");
  if (!flags["no-open"]) openBrowser(pairUrl);
  log("  15 分钟内有效，等待确认…");

  const deadline = Date.now() + 15 * 60 * 1000;
  while (Date.now() < deadline) {
    await sleep((interval ?? 3) * 1000);
    const res = await api.call("/api/device/pair/token", {
      method: "POST",
      body: JSON.stringify({
        device_code,
        tools: toolProfiles,
      }),
    });

    if (res.ok) {
      const config = {
        baseUrl,
        deviceToken: res.data.device_token,
        deviceId: res.data.device_id,
        endpointId: res.data.endpoint_id,
        tool: chosen[0]?.id ?? "claude-code",
        toolCommand: flags.cmd ? String(flags.cmd) : null,
        binaries: Object.fromEntries(chosen.map((t) => [t.id, t.binary])),
        unusable: unusable.map((t) => ({ id: t.id, note: t.note })),
        userName: res.data.user?.name ?? null,
        loggedInAt: new Date().toISOString(),
      };
      saveConfig(config);
      log("");
      log(`✓ 已连接到账号「${config.userName ?? "?"}」`);
      log(`  令牌保存在 ${configPath()}`);
      log("  下一步：在项目里把任务移到「已就绪」，然后 coflow pull");
      return;
    }

    if (res.data?.error === "authorization_pending") continue;
    if (res.data?.error === "expired_token") {
      warn("配对码已过期，请重新执行 coflow login");
      process.exit(2);
    }
    warn(`配对失败：${res.data?.error ?? res.status}`);
    process.exit(1);
  }
  warn("等待超时，请重新执行 coflow login");
  process.exit(3);
}

async function status() {
  const config = requireConfig();
  const api = createApi(config);
  const res = await api.call("/api/device/me");
  if (!res.ok) {
    warn(res.status === 401 ? "令牌已失效（设备可能被撤销），请重新 login" : `请求失败：${res.status}`);
    process.exit(1);
  }

  log(`设备：${res.data.device.name}（${res.data.device.os}）`);
  log(`账号：${res.data.user.name}`);
  log(`服务：${config.baseUrl}`);
  log("");
  if (res.data.endpoints.length === 0) {
    log("端点：无");
  } else {
    log("端点：");
    for (const e of res.data.endpoints) {
      log(`  · ${e.tool} ${e.version}  [${e.capability}]  ${e.status}`);
      log(`    允许目录：${e.allowed_paths?.length ? e.allowed_paths.join(", ") : "未授权"}`);
      if (e.capability !== "AUTO" && e.capability_note) {
        log(`    降级原因：${e.capability_note}`);
      }
    }
  }

  const session = loadSession(process.cwd());
  if (session) {
    log("");
    log(`当前工作区会话：任务 ${session.taskId}（开始于 ${session.startedAt}）`);
  }
}

async function doctor(flags) {
  const deep = !!flags.deep;
  const config = loadConfig();
  const toolId = String(flags.tool ?? config?.tool ?? "claude-code");
  const adapter = getAdapter(toolId);
  const tool = adapter.probe({
    deep,
    cmd: flags.cmd ?? config?.toolCommand,
    forceAuto: !!flags.auto,
  });
  log("CoFlow 能力检测");
  log("");

  if (!tool) {
    log(`  ✗ 适配器 ${toolId} 未检测到可调用的工具`);
    log("");
    log("  影响：只能手动接入——用 coflow pull 领取任务，人工执行，");
    log("       再用 coflow submit 回传产物。自动执行不可用。");
    log("");
    log(`  可选适配器：${listAdapterIds().join(", ")}`);
    return;
  }

  const c = tool.checks;

  const mark = (ok) => (ok ? "✓" : "✗");
  log(`  适配器     ${tool.toolType}`);
  log(`  位置       ${mark(true)} ${tool.binary}`);
  log(`  版本       ${mark(c ? c.versionOk : true)} ${tool.toolVersion}`);
  if (c) {
    log(`  无头旗标   ${mark(c.headlessFlags)} --print / --output-format`);
    if (deep) {
      log(
        `  无头实测   ${mark(c.deepOk === true)} ${
          c.deepOk === null ? "未执行" : c.deepOk ? "通过" : "失败"
        }`
      );
    }
  }

  log("");
  const labels = { AUTO: "自动接入", SEMI: "半自动", MANUAL: "手动" };
  log(`  判定：${labels[tool.capability] ?? tool.capability}`);
  if (tool.note) log(`  原因：${tool.note}`);
  log("");
  if (tool.capability === "AUTO") {
    log("  影响：可以用 coflow run 全自动执行。");
  } else {
    log("  影响：不能自动执行。用 coflow pull → 人工执行 → coflow submit。");
  }

  if (!flags.update) {
    log("");
    log("  加 --update 把这次检测结果同步到服务端（网页上的能力标签会更新）。");
    return;
  }

  const cfg = requireConfig();
  const api = createApi(cfg);
  const res = await api.call(`/api/endpoints/${cfg.endpointId}`, {
    method: "PATCH",
    body: JSON.stringify({
      capability: tool.capability,
      capabilityNote: tool.note,
      toolVersion: tool.toolVersion,
      headlessOk: tool.headlessOk,
    }),
  });

  if (res.ok) log("\n  ✓ 已同步到服务端");
  else log(`\n  ✗ 同步失败：${res.data?.error ?? res.status}`);
}

/** 领取租约 + 落盘上下文包，pull 和 run 共用 */
async function acquireLease(api, cwd, declared) {
  const existing = loadSession(cwd);
  if (existing) {
    warn(`这个目录已有进行中的会话（任务 ${existing.taskId}）。`);
    warn("先执行 coflow submit 提交，或删除 .coflow/session.json 放弃。");
    process.exit(1);
  }

  log("等待任务…（最多 25 秒）");
  const pending = await api.call("/api/leases/pending?wait=25");
  if (!pending.ok) {
    warn(`领取失败：${pending.data?.error ?? pending.status}`);
    process.exit(1);
  }

  const lease = pending.data.leases?.[0];
  if (!lease) return null;

  const accept = await api.call(`/api/leases/${lease.lease_id}/accept`, {
    method: "POST",
    body: JSON.stringify({ declaredPaths: declared }),
  });
  if (!accept.ok) {
    if (accept.data?.error === "path_locked") {
      warn("领取被拒绝：声明的路径与正在执行的会话冲突（独占资源）。");
      for (const c of accept.data.conflicts ?? []) {
        warn(`  · 与「${c.label}」重叠：${c.paths.join(", ")}`);
      }
      warn("等对方结束，或换一个不重叠的声明。");
      process.exit(1);
    }
    warn(`领取失败：${accept.data?.error ?? accept.status}`);
    process.exit(1);
  }

  const { session_id, context, context_hash, task_id } = accept.data;

  // 软锁：允许继续，但必须让人看见
  if (accept.data.conflicts?.length) {
    log("");
    log("⚠ 路径声明与正在执行的会话重叠（软锁，允许并行）：");
    for (const c of accept.data.conflicts) {
      log(`  · 与「${c.label}」重叠：${c.paths.join(", ")}`);
    }
    log("  建议先与对方确认，或拆到不同目录。");
  }
  const md = renderPackage(context, task_id);

  ensureWorkspace(cwd);
  const file = path.join(cwd, WORKSPACE_DIR, `task-${task_id}.md`);
  fs.writeFileSync(file, md);

  const session = {
    taskId: task_id,
    leaseId: lease.lease_id,
    sessionId: session_id,
    contextHash: context_hash,
    startedAt: new Date().toISOString(),
    declaredPaths: declared,
  };
  saveSession(cwd, session);

  // 开工事件走 outbox：断线也不丢
  enqueue(cwd, {
    sessionId: session_id,
    type: "agent.progress",
    payload: { stage: "accepted", declaredPaths: declared },
  });
  await flush(cwd, api);

  return { lease, session, file, context };
}

async function pull(flags) {
  const config = requireConfig();
  const api = createApi(config);
  const cwd = process.cwd();

  const declared = flags.paths ? String(flags.paths).split(",").map((s) => s.trim()) : [];
  const got = await acquireLease(api, cwd, declared);
  if (!got) {
    log("没有待领取的任务。在网页上把任务移到「已就绪」，再点「派发给 Agent」。");
    return;
  }

  log("");
  log(`✓ 已领取：${got.lease.title}`);
  log(`  任务包：${got.file}`);
  log(`  上下文：${got.session.contextHash.slice(0, 19)}…（${got.context.budget?.estimated_tokens ?? "?"} tokens）`);
  log("");
  log("接下来：在这个目录里把活干完，然后");
  log('  coflow submit --summary "做了什么" --check "pnpm test"');
}

async function run(flags) {
  const config = requireConfig();
  const api = createApi(config);
  const cwd = process.cwd();

  // 自动执行的三道前置条件，缺一不可
  const me = await api.call("/api/device/me");
  if (!me.ok) {
    warn("读取端点信息失败，先执行 coflow status 检查");
    process.exit(1);
  }
  const endpoint =
    me.data.endpoints.find((e) => e.id === config.endpointId) ?? me.data.endpoints[0];

  if (!endpoint) {
    warn("没有可用端点。先 coflow login 并为它授权目录。");
    process.exit(1);
  }
  if (endpoint.capability !== "AUTO") {
    warn(`端点能力是 ${endpoint.capability}，不能自动执行。`);
    if (endpoint.capability_note) warn(`原因：${endpoint.capability_note}`);
    warn("改用：coflow pull → 手动执行 → coflow submit");
    warn("想重新检测：coflow doctor --update");
    process.exit(1);
  }
  const allowed = endpoint.allowed_paths ?? [];
  if (allowed.length === 0) {
    warn("没有授权任何目录。自动执行必须先在 /agent 页面授权目录。");
    process.exit(1);
  }

  // 工作声明用工作区相对路径，服务端才能跨会话正确比对重叠
  const declared = relativize(flags.paths ? String(flags.paths).split(",") : allowed, cwd);
  const got = await acquireLease(api, cwd, declared);
  if (!got) {
    log("没有待领取的任务。");
    return;
  }

  log("");
  log(`✓ 已领取：${got.lease.title}`);
  log(`  上下文：${got.session.contextHash.slice(0, 19)}…`);
  log(`  授权目录：${allowed.join(", ")}`);
  const prompt =
    fs.readFileSync(got.file, "utf8") +
    "\n\n---\n执行要求：只修改上面工作区允许的目录；完成后停下来，不要提交 git，不要推送。";

  const adapter = getAdapter(endpoint.tool ?? config.tool ?? "claude-code");
  let command;
  try {
    command = adapter.buildCommand({ budgetUsd: flags.budget, cmd: config.toolCommand });
  } catch (err) {
    await fail(api, cwd, got.session.sessionId, "adapter_misconfigured", { message: String(err) });
    warn(`✗ ${err.message}`);
    process.exit(1);
  }

  log("");
  log(`调用 ${adapter.label} 执行中…（可以 Ctrl+C 中止，中止后任务留在进行中）`);

  const timeoutMin = Number(flags.timeout ?? 20);
  const startedMs = Date.now();

  const result = await runCommand(cwd, command, prompt, timeoutMin * 60 * 1000);
  const minutes = ((Date.now() - startedMs) / 60000).toFixed(1);

  if (result.killed) {
    await fail(api, cwd, got.session.sessionId, "timeout", { minutes });
    warn(`✗ 超过 ${timeoutMin} 分钟被中止。任务留在进行中，租约已作废。`);
    process.exit(1);
  }

  const parsed = adapter.parse(result.stdout);
  if (!parsed) {
    await fail(api, cwd, got.session.sessionId, "bad_output", {
      exitCode: result.code,
      stderr: result.stderr.slice(-500),
    });
    warn(`✗ 无法解析 ${adapter.id} 的输出：`);
    warn((result.stdout || result.stderr).slice(-800));
    process.exit(1);
  }

  if (parsed.isError) {
    await fail(api, cwd, got.session.sessionId, "agent_error", {
      result: parsed.text.slice(-500),
    });
    warn(`✗ Agent 执行失败：${parsed.text.slice(0, 300)}`);
    process.exit(1);
  }

  const costText = parsed.costUsd === null ? "" : ` · $${Number(parsed.costUsd).toFixed(4)}`;
  log(`  ${parsed.turns ?? "?"} 轮 · ${minutes} 分钟${costText}`);

  // 越界检查：以 git 工作区为准，不听 Agent 自述
  const evidence = collectGitEvidence(cwd, got.session.startedAt);
  const denied = got.context?.workspace?.denied_paths ?? [];
  const violations = findViolations(evidence, allowed, cwd, denied);
  if (violations.length > 0) {
    await fail(api, cwd, got.session.sessionId, "scope_violation", { paths: violations });
    warn("✗ 检测到越界修改，已拒绝提交：");
    for (const v of violations) warn(`    ${v}`);
    warn("任务留在进行中，请人工检查这些文件。");
    process.exit(1);
  }

  const summary =
    String(flags.summary ?? "").trim() ||
    String(parsed.text ?? "").trim().slice(0, 800) ||
    "Agent 自动执行完成";

  const checks = [];
  if (flags.check) {
    log(`运行检查：${flags.check}`);
    checks.push(runCheck(String(flags.check), cwd));
  }

  const ok = await submitResult(api, cwd, got.session, {
    summary,
    evidence,
    checks,
    doc: flags.doc,
  });

  if (ok) {
    log("");
    log("✓ 已提交，任务 → 待验收");
    log("  下一步是人工验收。Agent 不能自己通过验收。");
  }
}

async function submit(flags) {
  const config = requireConfig();
  const api = createApi(config);
  const cwd = process.cwd();

  const session = loadSession(cwd);
  if (!session) {
    warn("当前目录没有进行中的会话。先执行 coflow pull。");
    process.exit(1);
  }

  const summary = String(flags.summary ?? flags._[0] ?? "").trim();
  if (!summary) {
    warn('需要一段说明：coflow submit --summary "做了什么"');
    process.exit(1);
  }

  await api.call(`/api/sessions/${session.sessionId}/heartbeat`, { method: "POST" });

  const flushed = await flush(cwd, api);
  if (flushed.remaining > 0) {
    log(`注意：还有 ${flushed.remaining} 条事件没传上去，会在下次 sync 重试`);
  }

  const evidence = collectGitEvidence(cwd, session.startedAt);
  const checks = [];
  if (flags.check) {
    log(`运行检查：${flags.check}`);
    checks.push(runCheck(String(flags.check), cwd));
  }

  const ok = await submitResult(api, cwd, session, {
    summary,
    evidence,
    checks,
    doc: flags.doc,
  });

  if (ok) {
    log("");
    log(`✓ 已提交，任务状态 → 待验收`);
    log("  下一步是人工验收。Agent 不能自己通过验收。");
    if (checks.length) {
      for (const c of checks) log(`  检查 ${c.name}：exit ${c.exit_code}`);
    }
  } else {
    process.exit(1);
  }
}

/** 组装产物并提交。产物来自系统采集，不用 Agent 的口头描述。 */
async function submitResult(api, cwd, session, { summary, evidence, checks, doc }) {
  const artifacts = [];

  if (evidence?.isRepo) {
    if (evidence.commits) {
      artifacts.push({
        kind: "COMMIT",
        title: `本轮提交（${evidence.branch}）`,
        location: `git:${evidence.branch}`,
        note: evidence.commits.split("\n").slice(0, 10).join("\n"),
      });
    }
    if (evidence.status) {
      artifacts.push({
        kind: "COMMIT",
        title: "工作区改动",
        location: `git:worktree@${evidence.fingerprint}`,
        note: evidence.status.split("\n").slice(0, 20).join("\n"),
      });
    }
  }
  if (doc) {
    artifacts.push({
      kind: "DOC",
      title: path.basename(String(doc)),
      location: String(doc),
    });
  }
  if (artifacts.length === 0) {
    artifacts.push({
      kind: "NOTE",
      title: "无改动说明",
      location: `dir:${path.basename(cwd)}`,
      note: summary,
    });
  }

  const res = await api.call(`/api/sessions/${session.sessionId}/result`, {
    method: "POST",
    body: JSON.stringify({
      summary,
      completed: [],
      incomplete: [],
      artifacts,
      checks,
      impacts: [],
      unresolved: [],
      suggested_status: "IN_REVIEW",
    }),
  });

  if (!res.ok) {
    warn(`提交失败：${res.data?.error ?? res.status} ${res.data?.detail ?? ""}`);
    return false;
  }

  clearSession(cwd);
  log(`  已提交 ${res.data.artifacts} 项产物`);
  return true;
}

async function fail(api, cwd, sessionId, reason, details) {
  const res = await api.call(`/api/sessions/${sessionId}/fail`, {
    method: "POST",
    body: JSON.stringify({ reason, details }),
  });
  if (!res.ok) {
    warn(`失败上报未成功：${res.data?.error ?? res.status}`);
  }
  clearSession(cwd);
}

function runCommand(cwd, command, prompt, timeoutMs) {
  return new Promise((resolve) => {
    // shell 模式要把整条命令拼成一个字符串：既避免 DEP0190，也避免参数转义问题。
    // 参数全部来自适配器与数字校验，提示词走 stdin，不经过命令行。
    const child = spawn(command, {
      cwd,
      shell: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let killed = false;

    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });

    const timer = setTimeout(() => {
      killed = true;
      child.kill();
    }, timeoutMs);

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: stderr + String(err), killed });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, killed });
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}

/** 把授权目录转成工作区相对路径，工作声明的比对才有意义（导出以便单测） */
export function relativize(paths, cwd) {
  const root = path.resolve(cwd).replace(/\\/g, "/").toLowerCase();
  return paths.map((p) => {
    const abs = path.resolve(cwd, String(p)).replace(/\\/g, "/").toLowerCase();
    if (abs === root) return ".";
    if (abs.startsWith(root + "/")) {
      return path.relative(cwd, path.resolve(cwd, String(p))).replace(/\\/g, "/");
    }
    return String(p).replace(/\\/g, "/");
  });
}

/** 越界检查：白名单要满足，黑名单要避开（导出以便单测） */
export function findViolations(evidence, allowed, cwd, denied = []) {
  if (!evidence?.isRepo) return [];
  const changed = new Set();

  for (const line of String(evidence.status ?? "").split("\n")) {
    if (!line.trim()) continue;
    const raw = line.slice(3).trim();
    const arrow = raw.indexOf(" -> ");
    const file = arrow > -1 ? raw.slice(arrow + 4) : raw;
    changed.add(file.replace(/^"|"$/g, ""));
  }

  const violations = [];
  for (const file of changed) {
    if (!isAllowed(file, allowed, cwd) || isDenied(file, denied)) violations.push(file);
  }
  return violations;
}

/** denied_paths 是上下文包里写死的黑名单：.env / *.pem / *.key 这类不该被 Agent 碰 */
export function isDenied(file, denied = []) {
  const rel = file.replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase();
  const base = rel.split("/").pop();

  return denied.some((pattern) => {
    const p = String(pattern).replace(/\\/g, "/").toLowerCase();
    if (!p.includes("*")) return rel === p || base === p;

    // 注意顺序：? 必须先替换，否则会把后面注入的 (?:.*/)? 里的 ? 也改掉
    const regex = new RegExp(
      "^" +
        p
          .replace(/[.+^${}()|[\]\\]/g, "\\$&")
          .replace(/\?/g, "[^/]")
          .replace(/\*\*\//g, "__GLOBSTAR__")
          .replace(/\*\*/g, ".*")
          .replace(/\*/g, "[^/]*")
          .replace(/__GLOBSTAR__/g, "(?:.*/)?") +
        "$"
    );
    return regex.test(rel) || regex.test(base);
  });
}

export function isAllowed(file, allowed, cwd) {
  const abs = path.resolve(cwd, file).replace(/\\/g, "/").toLowerCase();
  const rel = file.replace(/\\/g, "/").toLowerCase();

  return allowed.some((entry) => {
    const a = String(entry).replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
    if (path.isAbsolute(a)) {
      return abs === a || abs.startsWith(a + "/");
    }
    return rel === a || rel.startsWith(a + "/");
  });
}

async function note(flags) {
  const config = requireConfig();
  const api = createApi(config);
  const cwd = process.cwd();
  const session = loadSession(cwd);
  if (!session) {
    warn("当前目录没有进行中的会话。");
    process.exit(1);
  }

  const text = String(flags._[0] ?? flags.text ?? "").trim();
  if (!text) {
    warn('用法：coflow note "进度说明"');
    process.exit(1);
  }

  enqueue(cwd, {
    sessionId: session.sessionId,
    type: "agent.progress",
    payload: { note: text, at: new Date().toISOString() },
  });

  const stats = await flush(cwd, api);
  if (stats.remaining === 0) log("✓ 已同步");
  else log(`已排队，${stats.remaining} 条待传（coflow sync 重试）`);
}

async function sync() {
  const config = requireConfig();
  const api = createApi(config);
  const stats = await flush(process.cwd(), api);
  log(
    `同步完成：新增 ${stats.accepted}，重复 ${stats.duplicate}，拒绝 ${stats.rejected}，剩余 ${stats.remaining}`
  );
}

async function logout() {
  try {
    fs.unlinkSync(configPath());
    log("已清除本机令牌。原工具不受影响，可继续正常使用。");
  } catch {
    log("本机没有保存令牌。");
  }
}

/** 打开系统浏览器；失败就算了，用户还能手动复制链接 */
function openBrowser(url) {
  try {
    if (process.platform === "win32") {
      spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
    } else if (process.platform === "darwin") {
      spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    } else {
      spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
    }
  } catch {
    // 忽略：终端里仍然打印了链接
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}


/**
 * 重新扫描本机工具并登记到已配对的设备。
 * 装了新工具之后跑一次，网页「Agent 连接」里就能看到并选为助手。
 */
async function scan() {
  const config = requireConfig();
  const api = createApi(config);
  const detected = detectTools();

  if (detected.length === 0) {
    log("没有检测到已知的 AI 命令行工具。");
    return;
  }

  const tools = detected.map((t) => {
    const adapter = t.id === "claude-code" ? getAdapter("claude-code") : null;
    const verdict = adapter
      ? adapter.probe({ deep: false })
      : { capability: "SEMI", headlessOk: false, note: t.usable ? "已检测到，但尚未验证无头调用" : t.note };
    return {
      toolType: t.id,
      toolVersion: t.version,
      capability: verdict?.capability ?? "SEMI",
      headlessOk: !!verdict?.headlessOk,
      capabilityNote: t.note ?? verdict?.note ?? null,
    };
  });

  // GUI 应用没有命令行入口，但可以选为助手，用剪贴板桥接
  const guiApps = detectGuiApps();
  for (const g of guiApps) {
    tools.push({
      toolType: g.label,
      toolVersion: "桌面版",
      capability: "MANUAL",
      headlessOk: false,
      capabilityNote: "GUI 应用：用 coflow assist --clipboard 剪贴板桥接回答",
    });
  }

  const res = await api.call("/api/device/tools", {
    method: "POST",
    body: JSON.stringify({ tools }),
  });
  if (!res.ok) {
    warn(`同步失败：${res.data?.error ?? res.status}`);
    process.exit(1);
  }

  for (const t of detected) {
    log(`  ${t.usable ? "✓" : "·"} ${t.label}  ${t.version}${t.note ? `  （${t.note}）` : ""}`);
  }
  for (const g of guiApps) {
    log(`  ▣ ${g.label}  桌面版（GUI，剪贴板桥接）`);
  }
  log("");
  log(`已同步 ${res.data.endpoints.length} 个端点到网页，去 /agent 选一个作为你的助手。`);

  // 顺手记下可执行文件路径，助手模式会用到
  const next = {
    ...config,
    binaries: Object.fromEntries(detected.filter((t) => t.usable).map((t) => [t.id, t.binary])),
  };
  saveConfig(next);
}


/** 手动登记一个 GUI 工具：它没有命令行入口，走 coflow assist --manual 桥接 */
async function addTool(flags) {
  const name = String(flags.name ?? "").trim();
  if (!name) {
    warn('用法：coflow add-tool --name "Cursor"');
    process.exit(1);
  }

  const config = requireConfig();
  const api = createApi(config);

  const res = await api.call("/api/device/tools", {
    method: "POST",
    body: JSON.stringify({
      tools: [
        {
          toolType: name.slice(0, 60),
          toolVersion: "手动",
          capability: "MANUAL",
          headlessOk: false,
          capabilityNote: "GUI 工具：没有命令行入口，用 coflow assist --manual 手动桥接回答",
        },
      ],
    }),
  });

  if (!res.ok) {
    warn(`登记失败：${res.data?.error ?? res.status}`);
    process.exit(1);
  }

  log(`已登记「${name}」到网页。去 /agent 选它作为助手，然后用：`);
  log("  coflow assist --manual");
}


/**
 * 直连模型 API：全自动，不需要粘贴。
 * 密钥只写进本机配置（0600），不上传服务器。
 */
async function addAi(flags) {
  const name = String(flags.name ?? "").trim();
  const base = String(flags.base ?? "").trim();
  const model = String(flags.model ?? "").trim();
  const apiKey = String(flags.key ?? process.env.COFOW_API_KEY ?? "").trim();

  if (!name || !base || !model) {
    warn('用法：coflow add-ai --name deepseek --base https://api.deepseek.com/v1 --model deepseek-chat --key sk-xxx');
    warn("常见配置：");
    warn("  DeepSeek   --base https://api.deepseek.com/v1 --model deepseek-chat");
    warn("  通义千问   --base https://dashscope.aliyuncs.com/compatible-mode/v1 --model qwen-plus");
    warn("  火山方舟   --base https://ark.cn-beijing.volces.com/api/v3 --model <你的接入点ID>");
    warn("  Ollama     --base http://127.0.0.1:11434/v1 --model qwen2.5:7b --key ollama");
    process.exit(1);
  }
  if (!apiKey) {
    warn("缺少 API Key：加 --key，或先设置环境变量 COFLOW_API_KEY");
    process.exit(1);
  }

  const config = requireConfig();
  const next = {
    ...config,
    providers: {
      ...(config.providers ?? {}),
      [name]: { baseUrl: base, model, apiKey },
    },
  };
  saveConfig(next);

  const api = createApi(config);
  const res = await api.call("/api/device/tools", {
    method: "POST",
    body: JSON.stringify({
      tools: [
        {
          toolType: name,
          toolVersion: model,
          capability: "AUTO",
          headlessOk: true,
          capabilityNote: "本地 API 直连：全自动回答，密钥只存在本机",
        },
      ],
    }),
  });

  if (!res.ok) {
    warn(`登记失败：${res.data?.error ?? res.status}`);
    process.exit(1);
  }

  log(`已配置「${name}」（${model}），密钥保存在本机 ${CONFIG_DIR}/config.json（权限 0600）。`);
  log("去 /agent 选它作为你的助手，然后运行：coflow assist");
  log(`  自检：coflow ask --tool ${name} "你好"`);
}

/** 单次提问自检：不经过频道，直接看模型回什么 */
async function ask(flags) {
  const config = requireConfig();
  const tool = String(flags.tool ?? "");
  const provider = config.providers?.[tool];
  if (!provider) {
    warn(`没有配置「${tool}」。先运行 coflow add-ai --name ${tool || "deepseek"} ...`);
    process.exit(1);
  }
  const text = await chatComplete({
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    model: provider.model,
    system: "你是 CoFlow 的助手，回答简短、具体，用中文。",
    user: flags.message ? String(flags.message) : "你好，请用一句话自我介绍。",
  });
  log(text);
}
