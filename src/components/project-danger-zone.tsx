"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteProject } from "@/app/actions/projects";

/**
 * 危险操作区：删除项目不可撤销，要求手动输入项目代号确认，
 * 避免误点把整个项目连同任务、事件、产物一起删掉。
 */
export function ProjectDangerZone({
  projectId,
  projectName,
  projectKey,
}: {
  projectId: string;
  projectName: string;
  projectKey: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmKey, setConfirmKey] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ borderColor: "var(--cf-danger)", color: "var(--cf-danger)" }}
        className="h-[30px] border px-3 text-[12.5px] font-semibold"
      >
        删除这个项目
      </button>
    );
  }

  return (
    <div
      style={{ borderColor: "var(--cf-danger)", backgroundColor: "var(--cf-danger-bg)" }}
      className="border p-3"
    >
      <div className="text-[12.5px] font-semibold text-[var(--cf-danger)]">
        删除「{projectName}」及其全部数据
      </div>
      <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--cf-text-secondary)]">
        任务、讨论、决策、产物、验收记录与事件流都会一并删除，无法恢复。成员账号本身不受影响。
        输入项目代号 <span className="mono font-semibold">{projectKey}</span> 以确认。
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          className="input h-[30px] w-[140px] py-0 text-[12.5px]"
          value={confirmKey}
          onChange={(e) => setConfirmKey(e.target.value.toUpperCase())}
          placeholder={projectKey}
        />
        <button
          type="button"
          disabled={pending || confirmKey !== projectKey}
          onClick={() =>
            start(async () => {
              const res = await deleteProject(projectId);
              if (res.ok) {
                router.push("/");
                router.refresh();
              } else {
                setError(res.error);
              }
            })
          }
          style={{
            backgroundColor: confirmKey === projectKey ? "var(--cf-danger)" : undefined,
            color: confirmKey === projectKey ? "#fff" : undefined,
          }}
          className="h-[30px] border px-3 text-[12.5px] font-semibold disabled:opacity-40"
        >
          {pending ? "删除中…" : "永久删除"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setConfirmKey("");
            setError(null);
          }}
          className="h-[30px] px-2 text-[12px] text-[var(--cf-text-tertiary)]"
        >
          取消
        </button>
        {error && <span className="text-[11px] text-[var(--cf-danger)]">{error}</span>}
      </div>
    </div>
  );
}
