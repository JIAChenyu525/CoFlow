"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { transitionTask } from "@/app/actions/tasks";
import { submitArtifact } from "@/app/actions/artifacts";
import { submitReview } from "@/app/actions/reviews";
import type { ArtifactType, TaskStatus } from "@prisma/client";

type Action = { to: TaskStatus; label: string; kind: "normal" | "danger" | "primary" };

export function TaskTransitionPanel({
  taskId,
  statusLabel,
  actions,
}: {
  taskId: string;
  statusLabel: string;
  actions: Action[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [blockMode, setBlockMode] = useState(false);
  const [reason, setReason] = useState("");
  const [needs, setNeeds] = useState("");
  const [error, setError] = useState<string | null>(null);

  function go(to: TaskStatus) {
    setError(null);
    start(async () => {
      const res = await transitionTask({
        taskId,
        to,
        note,
        blockedReason: to === "BLOCKED" ? reason : "",
        blockedNeeds: to === "BLOCKED" ? needs : "",
      });
      if (res.ok) {
        setNote("");
        setBlockMode(false);
        setReason("");
        setNeeds("");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="card p-3.5">
      <div className="flex items-center justify-between">
        <span className="label">状态机</span>
        <span className="pill pill--slate">{statusLabel}</span>
      </div>

      <div className="mt-2.5 space-y-2">
        <textarea
          className="textarea min-h-[48px] text-[12px]"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="变更说明（提交验收时用于无产物说明）"
        />

        {blockMode && (
          <div className="space-y-1.5 rounded-lg border border-[var(--red)]/30 bg-[var(--red-soft)]/40 p-2">
            <input
              className="input h-7 py-0 text-[11.5px]"
              placeholder="阻塞原因（必填）"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <input
              className="input h-7 py-0 text-[11.5px]"
              placeholder="需要谁提供什么"
              value={needs}
              onChange={(e) => setNeeds(e.target.value)}
            />
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {actions.map((a) => {
            const isBlock = a.to === "BLOCKED";
            if (isBlock && !blockMode) {
              return (
                <button
                  key={a.to}
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={() => setBlockMode(true)}
                  disabled={pending}
                >
                  标记阻塞
                </button>
              );
            }
            if (isBlock && blockMode) {
              return (
                <button
                  key={a.to}
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={() => go("BLOCKED")}
                  disabled={pending || !reason.trim()}
                >
                  确认阻塞
                </button>
              );
            }
            return (
              <button
                key={a.to}
                type="button"
                className={`btn btn-sm ${a.kind === "primary" ? "btn-primary" : ""}`}
                onClick={() => go(a.to)}
                disabled={pending}
              >
                {a.label}
              </button>
            );
          })}
        </div>

        {error && <p className="text-[11px] text-[var(--red)]">{error}</p>}
        <p className="text-[10px] leading-relaxed text-[var(--faint)]">
          状态变更会写入事件流；版本号自动 +1。
        </p>
      </div>
    </div>
  );
}

const TYPES: { v: ArtifactType; label: string }[] = [
  { v: "COMMIT", label: "代码提交" },
  { v: "BUILD", label: "构建包" },
  { v: "DOC", label: "文档" },
  { v: "DESIGN", label: "设计稿" },
  { v: "IMAGE", label: "图片" },
  { v: "DATA", label: "数据表" },
  { v: "TEST_REPORT", label: "测试报告" },
  { v: "LINK", label: "外部链接" },
  { v: "NOTE", label: "无产物说明" },
];

export function ArtifactForm({ projectId, taskId }: { projectId: string; taskId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ArtifactType>("COMMIT");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [version, setVersion] = useState("v1");
  const [forReview, setForReview] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    start(async () => {
      const res = await submitArtifact({
        projectId,
        taskId,
        type,
        title,
        location,
        version,
        submitForReview: forReview,
      });
      if (res.ok) {
        setOpen(false);
        setTitle("");
        setLocation("");
        router.refresh();
      } else setError(res.error);
    });
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-sm w-full" onClick={() => setOpen(true)}>
        ＋ 提交产物 / 证据
      </button>
    );
  }

  return (
    <div className="card space-y-2 p-3">
      <div className="field">
        <span className="text-[11px] font-semibold">产物类型</span>
        <select className="select h-7 py-0 text-[11.5px]" value={type} onChange={(e) => setType(e.target.value as ArtifactType)}>
          {TYPES.map((t) => (
            <option key={t.v} value={t.v}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <input
        className="input h-7 py-0 text-[11.5px]"
        placeholder="名称，如：上传接口实现"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <input
        className="input h-7 py-0 text-[11.5px]"
        placeholder="位置：commit / 路径 / 链接"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
      />
      <div className="flex items-center gap-2">
        <input
          className="input h-7 w-20 py-0 text-[11.5px]"
          placeholder="版本"
          value={version}
          onChange={(e) => setVersion(e.target.value)}
        />
        <label className="flex items-center gap-1.5 text-[11px] text-[var(--ink-2)]">
          <input
            type="checkbox"
            checked={forReview}
            onChange={(e) => setForReview(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          同时提交验收
        </label>
      </div>
      {error && <p className="text-[10.5px] text-[var(--red)]">{error}</p>}
      <div className="flex justify-end gap-1.5">
        <button type="button" className="btn btn-xs" onClick={() => setOpen(false)}>
          取消
        </button>
        <button
          type="button"
          className="btn btn-xs btn-primary"
          onClick={save}
          disabled={pending || !title.trim() || !location.trim()}
        >
          提交
        </button>
      </div>
    </div>
  );
}

export function ReviewForm({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [verdict, setVerdict] = useState<"PASS" | "RETURN" | "NEED_MORE">("PASS");
  const [criteriaNotes, setCriteriaNotes] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    start(async () => {
      const res = await submitReview({ taskId, verdict, criteriaNotes, comment });
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <div className="card p-3.5">
      <div className="label">验收结论</div>
      <p className="mt-1 text-[10.5px] leading-relaxed text-[var(--muted)]">
        标准 — 证据 — 结论。只有具备验收权的人能下结论。
      </p>

      <div className="mt-2 grid grid-cols-3 gap-1">
        {(
          [
            ["PASS", "通过", "var(--green)"],
            ["NEED_MORE", "补材料", "var(--amber)"],
            ["RETURN", "退回", "var(--red)"],
          ] as const
        ).map(([v, label, color]) => (
          <button
            key={v}
            type="button"
            onClick={() => setVerdict(v)}
            className={`rounded-md border px-1 py-1.5 text-[11px] font-semibold transition ${
              verdict === v
                ? "border-current text-white"
                : "border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink-2)]"
            }`}
            style={verdict === v ? { background: color, borderColor: color } : undefined}
          >
            {label}
          </button>
        ))}
      </div>

      <textarea
        className="textarea mt-2 min-h-[52px] text-[11.5px]"
        placeholder="逐条对照验收标准的结论"
        value={criteriaNotes}
        onChange={(e) => setCriteriaNotes(e.target.value)}
      />
      <textarea
        className="textarea mt-1.5 min-h-[40px] text-[11.5px]"
        placeholder="补充意见"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      {error && <p className="mt-1 text-[10.5px] text-[var(--red)]">{error}</p>}
      <button type="button" className="btn btn-sm btn-primary mt-2 w-full" onClick={save} disabled={pending}>
        {pending ? "提交中…" : "提交验收结论"}
      </button>
    </div>
  );
}
