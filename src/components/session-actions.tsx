"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { revokeOtherSessions, revokeSession } from "@/app/actions/sessions";

export function RevokeSessionButton({
  sessionId,
  isCurrent,
}: {
  sessionId: string;
  isCurrent: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        style={{ borderColor: "var(--cf-border-strong)" }}
        className="h-[24px] shrink-0 border px-2 text-[11.5px] text-[var(--cf-text-secondary)] hover:border-[var(--cf-danger)] hover:text-[var(--cf-danger)]"
      >
        {isCurrent ? "退出这台设备" : "撤销"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await revokeSession(sessionId);
            if (!res.ok) setError(res.error);
            else router.refresh();
          })
        }
        className="h-[24px] px-2 text-[11.5px] font-semibold text-[var(--cf-danger)]"
      >
        {pending ? "…" : "确认"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="h-[24px] px-2 text-[11.5px] text-[var(--cf-text-tertiary)]"
      >
        取消
      </button>
      {error && <span className="text-[10.5px] text-[var(--cf-danger)]">{error}</span>}
    </div>
  );
}

export function RevokeOthersButton({ count }: { count: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [done, setDone] = useState<string | null>(null);

  if (count === 0) {
    return (
      <span className="text-[11.5px] text-[var(--cf-text-tertiary)]">没有其他登录设备</span>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        style={{ borderColor: "var(--cf-border-strong)" }}
        className="h-[28px] border px-2.5 text-[12px] text-[var(--cf-text-secondary)] hover:border-[var(--cf-danger)] hover:text-[var(--cf-danger)]"
      >
        退出其他所有设备（{count}）
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11.5px] text-[var(--cf-text-secondary)]">
        其余 {count} 台设备会被立即登出，确定吗？
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await revokeOtherSessions();
            if (res.ok) {
              setDone(`已撤销 ${res.revoked} 个会话`);
              setConfirming(false);
              router.refresh();
            }
          })
        }
        className="h-[26px] px-2.5 text-[11.5px] font-semibold text-[var(--cf-danger)]"
      >
        {pending ? "处理中…" : "确认退出"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="h-[26px] px-2 text-[11.5px] text-[var(--cf-text-tertiary)]"
      >
        取消
      </button>
      {done && <span className="text-[10.5px] text-[var(--cf-success)]">{done}</span>}
    </div>
  );
}
