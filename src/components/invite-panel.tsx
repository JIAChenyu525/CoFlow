"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { disableInvite, enableInvite } from "@/app/actions/projects";

/**
 * 邀请加入：负责人开启后拿到一个邀请码，
 * 把码或链接发给同事，对方登录后就能加入项目。
 */
export function InvitePanel({
  projectId,
  inviteCode,
}: {
  projectId: string;
  inviteCode: string | null;
}) {
  const router = useRouter();
  const [code, setCode] = useState(inviteCode);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function copy() {
    if (!code) return;
    const url = `${window.location.origin}/join/${code}`;
    navigator.clipboard
      ?.writeText(url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => setError("复制失败，请手动选中链接复制"));
  }

  return (
    <div className="rounded-[10px] border border-[var(--line)] bg-[var(--surface-2)] p-3">
      {code ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-[var(--cf-text-secondary)]">邀请码</span>
            <span className="mono rounded bg-[var(--surface)] px-2 py-1 text-[14px] font-bold tracking-[0.18em] text-[var(--cf-text-primary)]">
              {code}
            </span>
            <button type="button" className="btn btn-xs" onClick={copy}>
              {copied ? "已复制" : "复制邀请链接"}
            </button>
            <button
              type="button"
              className="btn btn-xs btn-ghost"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await disableInvite(projectId);
                  if (res.ok) {
                    setCode(null);
                    router.refresh();
                  } else setError(res.error);
                })
              }
            >
              关闭加入
            </button>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--cf-text-tertiary)]">
            对方登录后打开链接（或在项目大厅点「加入项目」输入这个码）即可成为普通成员。
            和上面的邮箱邀请不同：这里不需要你逐个搜人，但要拿到链接的人才会看到；
            邮箱邀请则是你指定人、对方接受后才加入。关闭后邀请码立即失效。
          </p>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await enableInvite(projectId);
                if (res.ok) {
                  setCode(res.code);
                  router.refresh();
                } else setError(res.error);
              })
            }
          >
            {pending ? "生成中…" : "开启邀请加入"}
          </button>
          <span className="text-[11.5px] text-[var(--cf-text-tertiary)]">
            当前未开启，别人无法自行加入
          </span>
        </div>
      )}
      {error && <p className="mt-1 text-[11px] text-[var(--cf-danger)]">{error}</p>}
    </div>
  );
}
