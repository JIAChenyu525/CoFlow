"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createTask } from "@/app/actions/tasks";
import { PRIORITY_META } from "@/lib/constants";

type Member = { userId: string; name: string; color: string };
type Milestone = { id: string; title: string };

export function TaskCreateDialog({
  projectId,
  members,
  milestones,
  currentUserId,
  triggerLabel = "新建任务",
  triggerClass = "btn btn-primary",
}: {
  projectId: string;
  members: Member[];
  milestones: Milestone[];
  currentUserId?: string;
  triggerLabel?: string;
  triggerClass?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [more, setMore] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [inputs, setInputs] = useState("");
  const [scope, setScope] = useState("");
  const [nonScope, setNonScope] = useState("");
  const [acceptance, setAcceptance] = useState("");
  const [priority, setPriority] = useState<"P0" | "P1" | "P2" | "P3">("P2");
  // 建任务时不预设负责人：分工是负责人的事，不替人做决定
  const [assigneeId, setAssigneeId] = useState("");
  const [milestoneId, setMilestoneId] = useState(milestones[0]?.id ?? "");
  const [dueDate, setDueDate] = useState("");
  const [weight, setWeight] = useState(1);

  function reset() {
    setTitle("");
    setDescription("");
    setInputs("");
    setScope("");
    setNonScope("");
    setAcceptance("");
    setPriority("P2");
    setAssigneeId("");
    setMilestoneId(milestones[0]?.id ?? "");
    setDueDate("");
    setWeight(1);
    setMore(false);
    setError(null);
  }

  function save() {
    setError(null);
    start(async () => {
      const res = await createTask({
        projectId,
        title,
        description,
        inputs,
        scope,
        nonScope,
        acceptance,
        priority,
        assigneeId: assigneeId || null,
        milestoneId: milestoneId || null,
        dueDate: dueDate || null,
        weight,
      });
      if (res.ok) {
        setOpen(false);
        reset();
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  const willBeReady = acceptance.trim().length > 0 && !!assigneeId;

  return (
    <>
      <button type="button" className={triggerClass} onClick={() => setOpen(true)}>
        ＋ {triggerLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgba(23,26,31,.32)] p-6 backdrop-blur-[2px]">
          <div className="card my-6 w-full max-w-[620px] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3.5">
              <div>
                <h2 className="text-[15px] font-semibold tracking-tight">新建任务</h2>
                <p className="mt-0.5 text-[11.5px] text-[var(--muted)]">
                  写清楚「做什么」和「怎么算完成」，其他都可以之后再补。
                </p>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
                关闭
              </button>
            </div>

            <div className="max-h-[70vh] space-y-3 overflow-y-auto px-5 py-4">
              <div className="field">
                <span className="text-[12px] font-semibold">
                  任务名称 <span className="text-[var(--red)]">*</span>
                </span>
                <input
                  className="input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="用可交付结果命名，例如：实现睡前图片上传接口"
                  autoFocus
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="field">
                  <span className="text-[12px] font-semibold">谁来做</span>
                  <select className="select" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                    <option value="">待指定</option>
                    {members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.name}
                        {m.userId === currentUserId ? "（我）" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <span className="text-[12px] font-semibold">怎么算做完</span>
                  <textarea
                    className="textarea"
                    style={{ minHeight: 56 }}
                    value={acceptance}
                    onChange={(e) => setAcceptance(e.target.value)}
                    placeholder="写一条能检查的条件，例如：接口返回 200 并有单元测试"
                  />
                </div>
              </div>

              <p className="text-[11px] leading-relaxed text-[var(--muted)]">
                {willBeReady
                  ? "两项都填好了，创建后任务直接是「已就绪」，可以立刻开始。"
                  : "两样都填上，任务创建后就能立刻开始；缺一项会先停在「待澄清」。"}
              </p>

              <button
                type="button"
                onClick={() => setMore(!more)}
                className="text-[11.5px] font-medium text-[var(--accent-ink)] hover:underline"
              >
                {more ? "收起更多设置" : "更多设置（优先级、期限、范围、依赖）"}
              </button>

              {more && (
                <div className="space-y-3 rounded-[10px] border border-[var(--line)] bg-[var(--surface-2)] p-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="field">
                      <span className="text-[12px] font-semibold">优先级</span>
                      <select
                        className="select"
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as typeof priority)}
                      >
                        {(["P0", "P1", "P2", "P3"] as const).map((p) => (
                          <option key={p} value={p}>
                            {PRIORITY_META[p].label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <span className="text-[12px] font-semibold">对进度的权重</span>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        className="input"
                        value={weight}
                        onChange={(e) => setWeight(Number(e.target.value) || 1)}
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="field">
                      <span className="text-[12px] font-semibold">里程碑</span>
                      <select className="select" value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)}>
                        <option value="">不归属</option>
                        {milestones.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <span className="text-[12px] font-semibold">截止日期</span>
                      <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                    </div>
                  </div>

                  <div className="field">
                    <span className="text-[12px] font-semibold">任务说明</span>
                    <textarea
                      className="textarea"
                      style={{ minHeight: 60 }}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="要做什么，做到什么程度"
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="field">
                      <span className="text-[12px] font-semibold">输入材料</span>
                      <textarea
                        className="textarea"
                        style={{ minHeight: 56 }}
                        value={inputs}
                        onChange={(e) => setInputs(e.target.value)}
                        placeholder="文件、接口、决策编号或数据结构"
                      />
                    </div>
                    <div className="field">
                      <span className="text-[12px] font-semibold">工作范围</span>
                      <textarea
                        className="textarea"
                        style={{ minHeight: 56 }}
                        value={scope}
                        onChange={(e) => setScope(e.target.value)}
                        placeholder="允许修改的模块 / 目录"
                      />
                    </div>
                    <div className="field">
                      <span className="text-[12px] font-semibold">非工作范围</span>
                      <textarea
                        className="textarea"
                        style={{ minHeight: 56 }}
                        value={nonScope}
                        onChange={(e) => setNonScope(e.target.value)}
                        placeholder="明确不能碰的部分"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-[var(--line)] px-5 py-3">
              <span className="text-[11px] text-[var(--red)]">{error}</span>
              <div className="flex gap-2">
                <button type="button" className="btn" onClick={() => setOpen(false)}>
                  取消
                </button>
                <button type="button" className="btn btn-primary" onClick={save} disabled={pending || !title.trim()}>
                  {pending ? "创建中…" : "创建任务"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
