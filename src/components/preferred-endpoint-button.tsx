"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setPreferredEndpoint } from "@/app/actions/agents";

/** 把某个端点设成「我的助手」，或在多个工具之间切换 */
export function PreferredEndpointButton({
  endpointId,
  preferred,
}: {
  endpointId: string;
  preferred: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="flex items-center gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await setPreferredEndpoint(preferred ? null : endpointId);
            if (res.ok) router.refresh();
            else setError(res.error);
          })
        }
        className={`btn btn-xs ${preferred ? "" : "btn-ghost"}`}
        title={preferred ? "取消首选" : "设为我的助手"}
      >
        {pending ? "…" : preferred ? "★ 我的助手" : "设为首选"}
      </button>
      {error && <span className="text-[10px] text-[var(--red)]">{error}</span>}
    </span>
  );
}
