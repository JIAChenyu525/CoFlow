"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { joinByInvite } from "@/app/actions/projects";

/** 项目大厅里的「加入项目」入口 */
export function JoinProject() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function join() {
    setError(null);
    start(async () => {
      const res = await joinByInvite(code);
      if (res.ok) {
        router.push(`/projects/${res.projectId}`);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-[32px] items-center border px-3 text-[13px] font-semibold"
        style={{ borderColor: "var(--cf-border-strong)", color: "var(--cf-text-primary)" }}
      >
        加入项目
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        className="input mono h-[32px] w-[150px] py-0 text-[12.5px] tracking-widest"
        autoFocus
        value={code}
        onChange={(e) => {
          setCode(e.target.value.toUpperCase());
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && code.trim()) join();
        }}
        placeholder="邀请码"
      />
      <button
        type="button"
        className="btn btn-sm btn-primary"
        disabled={pending || code.trim().length < 6}
        onClick={join}
      >
        {pending ? "加入中…" : "加入"}
      </button>
      <button
        type="button"
        className="text-[11.5px] text-[var(--cf-text-tertiary)]"
        onClick={() => {
          setOpen(false);
          setCode("");
          setError(null);
        }}
      >
        取消
      </button>
      {error && <span className="text-[11px] text-[var(--cf-danger)]">{error}</span>}
    </div>
  );
}
