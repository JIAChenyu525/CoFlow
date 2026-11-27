import { Breadcrumb } from "@/components/ui";

export const metadata = { title: "事件协议 · CoFlow" };
export const dynamic = "force-dynamic";

const EVENT_FIELDS: [string, string][] = [
  ["event_id", "全局唯一标识，支持幂等处理"],
  ["project_id", "所属项目"],
  ["actor_type / actor_id", "行为主体是人、Agent 还是系统"],
  ["session_id", "关联一次 Agent 工作会话"],
  ["event_type", "任务、决策、产物、消息或权限等事件类型"],
  ["occurred_at / received_at", "发生时间与平台接收时间"],
  ["subject_type / subject_id", "事件作用于哪个对象"],
  ["payload", "具体变更内容"],
  ["source", "来源工具、连接器或人工操作"],
  ["evidence_refs", "相关提交、文件、测试或截图引用"],
  ["visibility", "可见范围与密级"],
  ["schema_version", "协议版本，便于兼容升级"],
  ["correlation_id / causation_id", "串联一次业务操作及其因果链"],
];

const EVENT_TYPES: [string, string][] = [
  ["goal.updated", "项目目标变更（生成新版本）"],
  ["task.created", "创建任务"],
  ["task.status_changed", "任务状态变化"],
  ["task.blocked", "任务进入阻塞"],
  ["decision.confirmed", "决策确认，进入事实层"],
  ["artifact.submitted", "产物提交"],
  ["review.requested", "请求验收"],
  ["review.completed", "验收结论"],
  ["agent.session_started", "Agent 会话开始"],
  ["agent.heartbeat", "Agent 心跳"],
  ["agent.session_ended", "Agent 会话结束"],
  ["permission.changed", "权限变化"],
];

const LAYERS: [string, string, string][] = [
  ["L0 稳定层", "项目章程、长期约束、协作规则", "变化时更新并提高版本"],
  ["L1 任务层", "当前任务、依赖、验收标准", "领取任务时生成"],
  ["L2 动态层", "最近关键事件、相关讨论、阻塞", "心跳或关键事件时更新"],
  ["L3 证据层", "文件、提交、测试、截图等详细材料", "按需拉取，不全部塞入提示词"],
];

const SAMPLE = `{
  "event_id": "evt_01J8ZK4M2Q",
  "project_id": "prj_zhaoxi",
  "actor_type": "agent_session",
  "actor_id": "ags_backend_01",
  "session_id": "sess_01J8ZK3A",
  "event_type": "artifact.submitted",
  "subject_type": "task",
  "subject_id": "task_upload_api",
  "payload": {
    "summary": "已提交睡前图片上传接口",
    "artifact_ids": ["art_commit_a81f"],
    "checks": ["unit_test_passed"]
  },
  "evidence_refs": ["repo://backend/commit/a81f"],
  "visibility": "project",
  "schema_version": "1.0",
  "occurred_at": "2026-11-11T13:20:11Z",
  "received_at": "2026-11-11T13:20:14Z"
}`;

export default function ProtocolPage() {
  return (
    <main className="mx-auto max-w-[860px] px-5 pb-24 pt-7">
      <Breadcrumb items={[{ label: "项目大厅", href: "/" }, { label: "事件协议" }]} />

      <div className="mt-4">
        <div className="label">Protocol v1.0</div>
        <h1 className="mt-1.5 text-[26px] font-semibold tracking-tight">事件协议与上下文包</h1>
        <p className="mt-2 max-w-[68ch] text-[13px] leading-relaxed text-[var(--ink-2)]">
          这个页面不是文档装饰，而是 Connector 与 Agent 网关要实现的那份契约。阶段一先用它约束
          人机共同写入的事实；阶段二起，本地工具按同一份协议回传结果。
        </p>
      </div>

      <section className="mt-8">
        <h2 className="text-[15px] font-semibold">一、原则</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            ["事件不可变", "任何更正都是新事件，不修改历史"],
            ["状态可投影", "页面读的是投影，不是回放整个事件流"],
            ["写入带版本", "任务更新携带预期版本号，防止并发覆盖"],
            ["证据先于结论", "完成状态必须关联产物或明确说明"],
          ].map(([k, v]) => (
            <div key={k} className="card-quiet p-3">
              <div className="text-[12.5px] font-semibold">{k}</div>
              <div className="mt-0.5 text-[11.5px] text-[var(--muted)]">{v}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-[15px] font-semibold">二、事件公共字段</h2>
        <div className="card mt-3 overflow-hidden">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[var(--line)] bg-[var(--surface-2)] text-left text-[10.5px] uppercase tracking-wider text-[var(--muted)]">
                <th className="px-4 py-2 font-semibold">字段</th>
                <th className="px-4 py-2 font-semibold">用途</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {EVENT_FIELDS.map(([k, v]) => (
                <tr key={k}>
                  <td className="mono whitespace-nowrap px-4 py-1.5 text-[11px] text-[var(--accent-ink)]">{k}</td>
                  <td className="px-4 py-1.5 text-[var(--ink-2)]">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-[15px] font-semibold">三、首版事件类型</h2>
        <p className="mt-1 text-[12px] text-[var(--muted)]">
          首版刻意控制在可维护范围内，不追求覆盖一切。
        </p>
        <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {EVENT_TYPES.map(([k, v]) => (
            <div key={k} className="flex items-baseline gap-2 rounded-md border border-[var(--line)] px-3 py-1.5">
              <span className="mono text-[11px] text-[var(--accent-ink)]">{k}</span>
              <span className="text-[11px] text-[var(--muted)]">{v}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-[15px] font-semibold">四、示例事件</h2>
        <pre className="scroll-thin mt-3 overflow-x-auto rounded-[10px] border border-[var(--line)] bg-[#1b1f24] p-4 text-[11.5px] leading-relaxed text-[#d7e3e0]">
          <code>{SAMPLE}</code>
        </pre>
      </section>

      <section className="mt-8">
        <h2 className="text-[15px] font-semibold">五、上下文包分层</h2>
        <p className="mt-1 text-[12px] leading-relaxed text-[var(--muted)]">
          Agent 不应该「读取全部日志」。上下文构建器按任务组装最小必要信息，并按预算裁剪。
        </p>
        <div className="mt-3 space-y-2">
          {LAYERS.map(([k, v, u]) => (
            <div key={k} className="card flex flex-wrap items-center gap-3 px-4 py-2.5">
              <span className="pill pill--accent">{k}</span>
              <span className="text-[12px] text-[var(--ink-2)]">{v}</span>
              <span className="ml-auto text-[10.5px] text-[var(--muted)]">{u}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-lg border-l-2 border-[var(--amber)] bg-[var(--amber-soft)]/40 px-3 py-2 text-[11.5px] leading-relaxed text-[var(--ink-2)]">
          超预算时的裁剪顺序：先丢过程性聊天，再丢低相关历史；硬性约束、当前任务、未解决阻塞和最新已确认决策不可裁剪。
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-[15px] font-semibold">六、Agent 回传合同</h2>
        <ol className="mt-3 space-y-1.5 text-[12.5px] leading-relaxed text-[var(--ink-2)]">
          {[
            "会话编号、任务编号与使用的上下文版本",
            "实际完成事项与未完成事项",
            "产物引用及版本，不使用无法定位的口头描述",
            "已执行的检查及其真实结果",
            "对项目目标、其他任务或其他成员的潜在影响",
            "新增阻塞、假设、风险与需要人工决定的问题",
            "建议的任务状态；最终状态由平台规则和验收人决定",
          ].map((t, i) => (
            <li key={i} className="flex gap-2">
              <span className="mono text-[10.5px] text-[var(--faint)]">{i + 1}.</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-10 rounded-lg border border-dashed border-[var(--line-strong)] px-4 py-3 text-[11.5px] leading-relaxed text-[var(--muted)]">
        阶段一状态：协议已用于人机共同写入（Web 端 Server Actions）。本地 Connector、Agent
        会话与心跳字段已在数据模型中预留，尚未对外开放。
      </div>
    </main>
  );
}
