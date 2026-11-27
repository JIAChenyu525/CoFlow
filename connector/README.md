# coflow-connector

CoFlow 本地连接器。零依赖，Node 20+ 直接跑。

## 它做什么

- 扫描本机是否有可调用的 Agent 工具（只认二进制与版本，**不读任何模型密钥**）
- 通过设备配对拿到一个可撤销的设备令牌
- 领取任务租约，把上下文包落盘成 `.coflow/task-<id>.md`
- 从 git 采集证据（提交、工作区改动、检查命令退出码）并回传
- 断线时把事件排进本地 outbox，重连后补传，服务端按 `event_id` 去重

## 用法

```bash
node bin/coflow.mjs login          # 配对：终端出码 → 网页输入
node bin/coflow.mjs status         # 设备与端点
node bin/coflow.mjs doctor [--update] [--deep]  # 能力检测与降级原因
node bin/coflow.mjs pull           # 领取任务，写 .coflow/task-*.md（半自动）
node bin/coflow.mjs run            # 领取任务并自动执行（自动）
node bin/coflow.mjs note "进度"     # 进度事件（离线会排队）
node bin/coflow.mjs submit --summary "做了什么" --check "pnpm test"
node bin/coflow.mjs sync           # 补传离线事件
node bin/coflow.mjs logout         # 清除本机令牌
```

## 自动执行（`run`）的三道闸

1. **能力必须是 AUTO**，SEMI/MANUAL 直接拒绝——不假装能自动跑。
2. **必须已授权目录**，空授权等于只读，拒绝执行。
3. **事后越界检查**：跑完用 `git status` 逐个比对白名单与黑名单（`.env`、`*.pem`、`*.key`）。
   有任何越界 → 会话标记失败、租约作废、任务留在进行中，**不提交、不自动重试**。

用的是 `--permission-mode acceptEdits`，不是 `--dangerously-skip-permissions`。
真正兜底的不是权限模式，而是上面第 3 条：证据以 git 工作区为准，不信 Agent 自述。

## 能力分级（`doctor`）

| 判定 | 条件 | 能做什么 |
| --- | --- | --- |
| AUTO | 二进制在 + `--version` 通过 + `--print/--output-format` 存在 | `run` 全自动 |
| SEMI | 装了但跑不动 / 无无头旗标 / 实测失败 | `pull` + 人工执行 + `submit` |
| 无工具 | 找不到二进制 | 只能网页手动回传 |

`doctor --update` 把检测结果同步到服务端，网页上的能力标签与降级原因会一起更新。
`doctor --deep` 会真的调用一次模型验证无头可用（**花钱**，默认关闭）。

`--base http://host:port` 可指定服务地址，默认 `http://localhost:3000`。

## 它明确不做

- 不读 `~/.claude.json`、不读环境变量里的 API Key、不扫描整块磁盘
- 不开入站端口，只发起出站请求
- 不自己把任务标成「已完成」——只能提交到「待验收」，通过与否由人决定

## 文件

| 路径 | 作用 |
| --- | --- |
| `~/.coflow/config.json` | 设备令牌与服务地址（权限 0600） |
| `.coflow/session.json` | 当前工作区的会话（任务、租约、上下文 hash） |
| `.coflow/outbox.json` | 待补传事件队列 |
| `.coflow/task-<id>.md` | 本次任务的上下文包 |
| `.coflow/.gitignore` | 自动生成，避免运行时状态被提交进你的仓库 |

## 令牌撤销

在 CoFlow 的 `/agent` 页点「撤销」。撤销后连接器所有请求返回 401，
但你原来的 Claude Code / 编辑器完全不受影响。
