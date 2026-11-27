"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { quickCreateProject } from "@/app/actions/projects";
import { TEMPLATES } from "@/lib/templates";

/**
 * 首次使用的主入口：只填名字就能建出一个带任务的项目。
 * 完整向导仍然保留，但不应该是默认路径。
 */
export function QuickCreate() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("software");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const value = name.trim();
    if (value.length < 2) {
      setError("项目名称至少 2 个字");
      return;
    }
    setError(null);
    start(async () => {
      const res = await quickCreateProject({ name: value, templateId });
      if (res.ok) {
        router.push(`/projects/${res.projectId}`);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div
      style={{ backgroundColor: "var(--cf-surface-card)", borderColor: "var(--cf-border-strong)" }}
      className="w-full max-w-[520px] border p-5 text-left"
    >
      <div className="text-[14px] font-bold text-[var(--cf-text-primary)]">先建一个项目试试</div>
      <p className="mt-1 text-[12px] leading-relaxed text-[var(--cf-text-secondary)]">
        填个名字就行。系统会按模板生成项目章程和几个现成的任务，进来就能用。
      </p>

      <div className="mt-3 flex flex-col gap-2">
        <input
          className="input h-[34px] text-[13px]"
          value={name}
          autoFocus
          placeholder="项目名称，例如：朝夕相伴"
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
        <div className="flex gap-2">
          <select
            className="select h-[34px] flex-1 text-[12.5px]"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            {TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}（{t.tasks.length} 个任务）
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-primary h-[34px] px-4"
            disabled={pending || name.trim().length < 2}
            onClick={submit}
          >
            {pending ? "创建中…" : "创建并进入"}
          </button>
        </div>
      </div>

      {error && <p className="mt-2 text-[11.5px] text-[var(--cf-danger)]">{error}</p>}

      <p className="mt-3 text-[11px] text-[var(--cf-text-tertiary)]">
        想自己写目标、范围和验收标准？
        <Link href="/projects/new" className="ml-1 text-[var(--cf-primary)] hover:underline">
          用完整向导
        </Link>
      </p>
    </div>
  );
}
