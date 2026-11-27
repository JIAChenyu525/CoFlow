"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Reason = { code: string; text: string; delta: number };

type Option = {
  id: string;
  tool: string;
  version: string;
  capability: string;
  owner: string;
  note?: string | null;
  score: number;
  usable: boolean;
  reasons: Reason[];
};

export function DispatchLease({ taskId, options }: { taskId: string; options: Option[] }) {
  const router = useRouter();
  const [endpointId, setEndpointId] = useState(options[0]?.id ?? "");
  const selected = options.find((o) => o.id === endpointId);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function dispatch() {
    setError(null);
    setDone(null);
    start(async () => {
      const res = await fetch(`/api/tasks/${taskId}/lease`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpointId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setDone(`已下发租约，连接器 15 分钟内可领取（${data.tokens} tokens）`);
        router.refresh();
        return;
      }
      const map: Record<string, string> = {
        task_not_ready: data.detail ?? "任务需要先移到「已就绪」",
        lease_conflict: "这个任务已有未结束的租约",
        agent_owner_not_member: "该 Agent 的主人不在此项目",
        context_over_budget: "上下文超出预算，先精简任务定义",
        endpoint_unavailable: "该端点已离线或被撤销",
      };
      setError(map[data.error] ?? "派发失败，请重试");
    });
  }

  return (
    <div className="space-y-2">
      <select
        className="select h-8 py-0 text-[11.5px]"
        value={endpointId}
        onChange={(e) => setEndpointId(e.target.value)}
      >
        {options.map((o, i) => (
          <option key={o.id} value={o.id}>
            {i === 0 ? "推荐 · " : ""}
            {o.tool} {o.version} · {o.owner}（{o.capability}）
          </option>
        ))}
      </select>

      {selected && (
        <div className="rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-2 py-1.5">
          <div className="flex items-center gap-1.5">
            <span className="label">推荐理由</span>
            <span className="mono ml-auto text-[10px] text-[var(--muted)]">
              {selected.score} 分
            </span>
          </div>
          <ul className="mt-1 space-y-0.5">
            {selected.reasons.map((r) => (
              <li key={r.code} className="flex items-baseline gap-1.5 text-[10.5px]">
                <span
                  className={`mono w-[26px] shrink-0 text-right ${
                    r.delta > 0
                      ? "text-[var(--green)]"
                      : r.delta < 0
                        ? "text-[var(--red)]"
                        : "text-[var(--faint)]"
                  }`}
                >
                  {r.delta > 0 ? `+${r.delta}` : r.delta}
                </span>
                <span className="text-[var(--ink-2)]">{r.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {selected && selected.capability !== "AUTO" && (
        <p className="rounded-md bg-[var(--amber-soft)]/60 px-2 py-1 text-[10px] leading-relaxed text-[var(--amber)]">
          {selected.capability === "SEMI" ? "半自动" : "手动"}端点：派发后需要人工执行，
          用 <code className="mono">coflow pull</code> 领取。
          {selected.note ? `（${selected.note}）` : ""}
        </p>
      )}

      <button
        type="button"
        className="btn btn-primary btn-sm w-full"
        disabled={pending || !endpointId}
        onClick={dispatch}
      >
        {pending ? "下发中…" : "派发给 Agent"}
      </button>
      {error && <p className="text-[10.5px] text-[var(--red)]">{error}</p>}
      {done && <p className="text-[10.5px] text-[var(--green)]">{done}</p>}
    </div>
  );
}
