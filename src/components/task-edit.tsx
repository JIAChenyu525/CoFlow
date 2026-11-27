"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateTask } from "@/app/actions/tasks";

type TaskData = {
  id: string;
  version: number;
  title: string;
  description: string;
  inputs: string;
  scope: string;
  nonScope: string;
  acceptance: string;
  priority: "P0" | "P1" | "P2" | "P3";
  assigneeId: string | null;
  reviewerId: string | null;
  milestoneId: string | null;
  dueDate: string | null;
  weight: number;
};

export function TaskEditForm({
  task,
  members,
  milestones,
  canEdit,
}: {
  task: TaskData;
  members: { userId: string; name: string }[];
  milestones: { id: string; title: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(task);

  function set<K extends keyof TaskData>(k: K, v: TaskData[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function save() {
    setError(null);
    start(async () => {
      const res = await updateTask({
        taskId: task.id,
        version: task.version,
        title: form.title,
        description: form.description,
        inputs: form.inputs,
        scope: form.scope,
        nonScope: form.nonScope,
        acceptance: form.acceptance,
        priority: form.priority,
        assigneeId: form.assigneeId,
        reviewerId: form.reviewerId,
        milestoneId: form.milestoneId,
        dueDate: form.dueDate,
        weight: form.weight,
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else setError(res.error);
    });
  }

  if (!open) {
    return (
      <div className="flex items-center gap-2">
        {canEdit && (
          <button type="button" className="btn btn-sm" onClick={() => setOpen(true)}>
            编辑任务定义
          </button>
        )}
        <span className="mono text-[10.5px] text-[var(--faint)]">v{task.version}</span>
      </div>
    );
  }

  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-semibold">编辑任务定义</span>
        <span className="mono text-[10.5px] text-[var(--muted)]">保存后版本 → v{task.version + 1}</span>
      </div>

      <div className="field">
        <span className="text-[11.5px] font-medium">任务名称</span>
        <input className="input" value={form.title} onChange={(e) => set("title", e.target.value)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="field">
          <span className="text-[11.5px] font-medium">负责人</span>
          <select
            className="select"
            value={form.assigneeId ?? ""}
            onChange={(e) => set("assigneeId", e.target.value || null)}
          >
            <option value="">待指定</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <span className="text-[11.5px] font-medium">验收人</span>
          <select
            className="select"
            value={form.reviewerId ?? ""}
            onChange={(e) => set("reviewerId", e.target.value || null)}
          >
            <option value="">项目负责人</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <span className="text-[11.5px] font-medium">权重</span>
          <input
            type="number"
            min={1}
            max={20}
            className="input"
            value={form.weight}
            onChange={(e) => set("weight", Number(e.target.value) || 1)}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="field">
          <span className="text-[11.5px] font-medium">里程碑</span>
          <select
            className="select"
            value={form.milestoneId ?? ""}
            onChange={(e) => set("milestoneId", e.target.value || null)}
          >
            <option value="">不归属</option>
            {milestones.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <span className="text-[11.5px] font-medium">优先级</span>
          <select
            className="select"
            value={form.priority}
            onChange={(e) => set("priority", e.target.value as TaskData["priority"])}
          >
            {["P0", "P1", "P2", "P3"].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <span className="text-[11.5px] font-medium">截止日期</span>
          <input
            type="date"
            className="input"
            value={form.dueDate ?? ""}
            onChange={(e) => set("dueDate", e.target.value || null)}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Area label="任务说明" value={form.description} onChange={(v) => set("description", v)} />
        <Area label="输入材料" value={form.inputs} onChange={(v) => set("inputs", v)} />
        <Area label="工作范围" value={form.scope} onChange={(v) => set("scope", v)} />
        <Area label="非工作范围" value={form.nonScope} onChange={(v) => set("nonScope", v)} />
      </div>
      <Area label="验收标准" value={form.acceptance} onChange={(v) => set("acceptance", v)} />

      {error && <p className="text-[11.5px] text-[var(--red)]">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn" onClick={() => setOpen(false)}>
          取消
        </button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={pending}>
          {pending ? "保存中…" : "保存（版本 +1）"}
        </button>
      </div>
    </div>
  );
}

function Area({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="field">
      <span className="text-[11.5px] font-medium">{label}</span>
      <textarea
        className="textarea min-h-[58px] text-[12.5px]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
