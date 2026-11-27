"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { confirmDecision } from "@/app/actions/decisions";

export function ConfirmDecisionButton({ decisionId }: { decisionId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-1.5">
      <button
        type="button"
        className="btn btn-xs btn-primary"
        disabled={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            const res = await confirmDecision({ decisionId });
            if (res.ok) router.refresh();
            else setError(res.error);
          });
        }}
      >
        {pending ? "确认中…" : "确认并写入事实层"}
      </button>
      {error && <p className="mt-1 text-[10.5px] text-[var(--red)]">{error}</p>}
    </div>
  );
}
