"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { postMessage } from "@/app/actions/messages";
import { askMyAssistant } from "@/app/actions/assistant";
import { proposeDecision } from "@/app/actions/decisions";
import { Avatar, formatTime } from "./ui";

export type FeedMessage = {
  id: string;
  type: "TEXT" | "TASK_REF" | "DECISION_PROPOSAL" | "BLOCKER" | "ARTIFACT_SUBMIT" | "SYSTEM" | "AGENT_REPORT";
  body: string;
  createdAt: string;
  author: { name: string; color: string };
  /** HUMAN：成员本人；AGENT：这个成员自己的助手 */
  authorType?: "HUMAN" | "AGENT";
  taskId: string | null;
  taskTitle?: string | null;
  refType: string | null;
  refId: string | null;
};

export function Conversation({
  projectId,
  messages,
  canWrite,
}: {
  projectId: string;
  messages: FeedMessage[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const scroller = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [decisionFor, setDecisionFor] = useState<FeedMessage | null>(null);
  const [withAssistant, setWithAssistant] = useState(false);
  const [assistantNote, setAssistantNote] = useState<string | null>(null);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  function send() {
    const body = draft.trim();
    if (!body || pending) return;
    setError(null);
    start(async () => {
      const res = await postMessage({ projectId, body });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDraft("");
      router.refresh();

      // 勾选了「让我的助手回答」才叫助手，避免每条消息都烧算力
      if (withAssistant) {
        const a = await askMyAssistant({ projectId, prompt: body });
        if (a.ok) {
          setAssistantNote(`已请求你的助手回答（${a.tool}），请保持本机连接器在线`);
        } else {
          setAssistantNote(null);
          setError(a.error);
        }
      }
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scroller} className="scroll-thin flex-1 overflow-y-auto px-5 py-4">
        <div className="mx-auto max-w-[760px] space-y-1">
          {messages.length === 0 && (
            <p className="py-16 text-center text-[12.5px] text-[var(--muted)]">
              还没有消息。讨论负责交流意图，确认后的结论记得「形成决策」。
            </p>
          )}
          {messages.map((m) => (
            <MessageRow
              key={m.id}
              m={m}
              canWrite={canWrite}
              onDecide={() => setDecisionFor(m)}
            />
          ))}
        </div>
      </div>

      {decisionFor && (
        <DecisionComposer
          projectId={projectId}
          seed={decisionFor.body}
          onClose={() => setDecisionFor(null)}
          onDone={() => {
            setDecisionFor(null);
            router.refresh();
          }}
        />
      )}

      <div className="border-t border-[var(--line)] bg-[var(--surface)] px-5 py-3">
        <div className="mx-auto max-w-[760px]">
          {error && <div className="mb-2 text-[11.5px] text-[var(--red)]">{error}</div>}
          {assistantNote && (
            <div className="mb-2 text-[11px] text-[var(--accent-ink)]">{assistantNote}</div>
          )}
          <div className="mb-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWithAssistant(!withAssistant)}
              disabled={!canWrite}
              className={`flex h-[24px] items-center gap-1.5 rounded-full border px-2.5 text-[11px] transition ${
                withAssistant
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                  : "border-[var(--line)] text-[var(--muted)] hover:border-[var(--line-strong)]"
              }`}
              title="让跑在你自己电脑上的 AI 工具回答这条消息"
            >
              <span
                className="h-[6px] w-[6px] rounded-full"
                style={{ backgroundColor: withAssistant ? "var(--accent)" : "var(--faint)" }}
              />
              让我的助手回答
            </button>
            <span className="text-[10.5px] text-[var(--faint)]">
              用你本机的 AI 工具，别人可用各自的助手
            </span>
          </div>
          <div className="flex items-end gap-2">
            <textarea
              className="textarea min-h-[40px] max-h-[180px] resize-none py-2.5"
              rows={1}
              value={draft}
              placeholder={canWrite ? "在项目频道发言，Ctrl/⌘ + Enter 发送…" : "观察员只能查看"}
              disabled={!canWrite || pending}
              onChange={(e) => {
                setDraft(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`;
              }}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") send();
              }}
            />
            <button
              type="button"
              className="btn btn-primary h-[40px]"
              onClick={send}
              disabled={!canWrite || !draft.trim() || pending}
            >
              {pending ? "发送中" : "发送"}
            </button>
          </div>
          <div className="mt-1.5 flex items-center gap-3 text-[10.5px] text-[var(--faint)]">
            <span>讨论记录不等于项目进度</span>
            <span>·</span>
            <span>结论请点消息右侧「形成决策」</span>
          </div>
        </div>
      </div>

    </div>
  );
}

function MessageRow({
  m,
  canWrite,
  onDecide,
}: {
  m: FeedMessage;
  canWrite: boolean;
  onDecide: () => void;
}) {
  if (m.type === "SYSTEM") {
    return (
      <div className="flex items-center gap-3 py-2">
        <span className="h-px flex-1 bg-[var(--line)]" />
        <span className="text-[10.5px] text-[var(--faint)]">
          {m.body} · {formatTime(m.createdAt)}
        </span>
        <span className="h-px flex-1 bg-[var(--line)]" />
      </div>
    );
  }

  const isDecision = m.type === "DECISION_PROPOSAL";
  const isArtifact = m.type === "ARTIFACT_SUBMIT";

  return (
    <div className="group relative flex gap-2.5 rounded-lg px-1 py-2 transition hover:bg-[var(--surface-2)]">
      <Avatar name={m.author.name} color={m.author.color} size={26} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[12.5px] font-semibold">
            {m.authorType === "AGENT" ? `${m.author.name} 的助手` : m.author.name}
          </span>
          {m.authorType === "AGENT" && (
            <span
              className="rounded-sm border px-1 py-[1px] text-[9px] font-semibold"
              style={{
                borderColor: "var(--accent)",
                color: "var(--accent-ink)",
                backgroundColor: "var(--accent-soft)",
              }}
              title="跑在这位成员自己电脑上的 AI 工具"
            >
              AI
            </span>
          )}
          <span className="mono text-[10.5px] text-[var(--faint)]">{formatTime(m.createdAt)}</span>
          {m.taskTitle && (
            <span className="tag" title={m.taskTitle}>
              任务 · {m.taskTitle.slice(0, 14)}
            </span>
          )}
          {isDecision && <span className="pill pill--amber">决策提案</span>}
          {isArtifact && <span className="pill pill--blue">产物</span>}
        </div>
        <p
          className={`mt-0.5 whitespace-pre-wrap text-[13px] leading-relaxed ${
            isDecision || isArtifact ? "text-[var(--ink)]" : "text-[var(--ink-2)]"
          }`}
        >
          {m.body}
        </p>
      </div>

      {canWrite && m.type === "TEXT" && (
        <button
          type="button"
          onClick={onDecide}
          className="btn btn-xs absolute right-1 top-1 opacity-0 transition group-hover:opacity-100"
        >
          形成决策
        </button>
      )}
    </div>
  );
}

function DecisionComposer({
  projectId,
  seed,
  onClose,
  onDone,
}: {
  projectId: string;
  seed: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [title, setTitle] = useState(seed.slice(0, 24));
  const [conclusion, setConclusion] = useState(seed);
  const [rationale, setRationale] = useState("");
  const [impact, setImpact] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    start(async () => {
      const res = await proposeDecision({ projectId, title, conclusion, rationale, impact });
      if (res.ok) onDone();
      else setError(res.error);
    });
  }

  return (
    <div className="border-t border-[var(--accent)] bg-[var(--accent-soft)]/40 px-5 py-3">
      <div className="mx-auto max-w-[760px]">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12px] font-semibold text-[var(--accent-ink)]">
            把讨论沉淀为决策提案
          </span>
          <button type="button" className="btn btn-xs btn-ghost" onClick={onClose}>
            取消
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="field">
            <span className="text-[11px] font-medium">标题</span>
            <input className="input h-8 py-0 text-[12.5px]" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field">
            <span className="text-[11px] font-medium">影响范围</span>
            <input
              className="input h-8 py-0 text-[12.5px]"
              value={impact}
              onChange={(e) => setImpact(e.target.value)}
              placeholder="哪些任务 / 模块 / 成员会受影响"
            />
          </div>
        </div>
        <div className="field mt-2">
          <span className="text-[11px] font-medium">结论</span>
          <textarea
            className="textarea min-h-[52px] text-[12.5px]"
            value={conclusion}
            onChange={(e) => setConclusion(e.target.value)}
          />
        </div>
        <div className="field mt-2">
          <span className="text-[11px] font-medium">理由</span>
          <textarea
            className="textarea min-h-[44px] text-[12.5px]"
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            placeholder="为什么这样定，考虑过哪些替代方案"
          />
        </div>
        {error && <div className="mt-1 text-[11.5px] text-[var(--red)]">{error}</div>}
        <div className="mt-2 flex justify-end">
          <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={pending}>
            {pending ? "写入中…" : "提交提案"}
          </button>
        </div>
        <p className="mt-1 text-[10.5px] text-[var(--muted)]">
          提案不会进入 Agent 上下文，需由发起人 / 负责人确认后才成为项目事实。
        </p>
      </div>
    </div>
  );
}
