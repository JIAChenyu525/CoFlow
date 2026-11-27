"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { claimTask } from "@/app/actions/tasks";

/** 没有负责人的任务：成员可以自己接，也可以等负责人分配 */
export function TaskClaimCard({
  taskId,
  assigneeName,
}: {
  taskId: string;
  assigneeName: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (assigneeName) {
    return (
      <div className="card p-3.5">
        <div className="label">负责人</div>
        <div className="mt-1 text-[12.5px] font-medium">{assigneeName}</div>
      </div>
    );
  }

  return (
    <div className="card p-3.5">
      <div className="label">负责人</div>
      <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--muted)]">
        还没有人负责。可以等负责人分配，也可以自己接。
      </p>
      <button
        type="button"
        className="btn btn-primary btn-sm mt-2"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await claimTask(taskId);
            if (res.ok) router.refresh();
            else setError(res.error);
          })
        }
      >
        {pending ? "认领中…" : "我来做"}
      </button>
      {error && <p className="mt-1 text-[11px] text-[var(--red)]">{error}</p>}
    </div>
  );
}
