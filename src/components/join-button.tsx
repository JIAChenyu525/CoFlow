"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { joinByInvite } from "@/app/actions/projects";

export function JoinButton({ code, projectName }: { code: string; projectName: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div>
      <button
        type="button"
        className="btn btn-primary h-[34px] px-4"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await joinByInvite(code);
            if (res.ok) {
              router.push(`/projects/${res.projectId}`);
              router.refresh();
            } else {
              setError(res.error);
            }
          })
        }
      >
        {pending ? "加入中…" : `加入「${projectName}」`}
      </button>
      {error && <p className="mt-2 text-[11.5px] text-[var(--cf-danger)]">{error}</p>}
    </div>
  );
}
