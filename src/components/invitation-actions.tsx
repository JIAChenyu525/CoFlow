"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { respondInvitation } from "@/app/actions/invitations";

export function InvitationActions({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="btn btn-sm btn-primary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await respondInvitation(invitationId, true);
            if (res.ok) {
              if (res.projectId) router.push(`/projects/${res.projectId}`);
              router.refresh();
            } else {
              setError(res.error);
            }
          })
        }
      >
        {pending ? "处理中…" : "接受"}
      </button>
      <button
        type="button"
        className="btn btn-sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await respondInvitation(invitationId, false);
            if (res.ok) router.refresh();
            else setError(res.error);
          })
        }
      >
        拒绝
      </button>
      {error && <span className="text-[11px] text-[var(--cf-danger)]">{error}</span>}
    </div>
  );
}
