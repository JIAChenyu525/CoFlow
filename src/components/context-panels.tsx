"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveContextSnapshot } from "@/app/actions/context";

export function SaveSnapshotButton({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        className="btn btn-primary btn-sm w-full"
        disabled={pending}
        onClick={() => {
          setError(null);
          setDone(null);
          start(async () => {
            const res = await saveContextSnapshot(taskId);
            if (res.ok) {
              setDone(`已保存快照 v${res.version}`);
              router.refresh();
            } else setError(res.error);
          });
        }}
      >
        {pending ? "保存中…" : "保存为快照"}
      </button>
      {error && <p className="mt-1 text-[10.5px] text-[var(--red)]">{error}</p>}
      {done && <p className="mt-1 text-[10.5px] text-[var(--green)]">{done}</p>}
    </div>
  );
}
