"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * 页面级错误兜底：任何一页抛错都不至于白屏，
 * 至少让人看到发生了什么，并能重试或回到大厅。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[coflow] page error:", error);
  }, [error]);

  return (
    <main className="cf-scope flex min-h-[calc(100dvh-52px)] items-center justify-center px-5">
      <div
        style={{
          backgroundColor: "var(--cf-surface-card)",
          borderColor: "var(--cf-border-strong)",
          boxShadow: "var(--cf-shadow-card)",
        }}
        className="w-full max-w-[520px] border p-6"
      >
        <div className="font-mono-tabular text-[10.5px] font-semibold tracking-widest text-[var(--cf-danger)]">
          SOMETHING WENT WRONG
        </div>
        <h1 className="mt-1.5 text-[19px] font-bold text-[var(--cf-text-primary)]">
          这一页没能加载出来
        </h1>
        <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--cf-text-secondary)]">
          已经记录到服务端日志。可以先重试；如果反复出现，把下面的错误编号发给维护人员，便于定位。
        </p>

        <div
          style={{ backgroundColor: "var(--cf-surface-secondary)", borderColor: "var(--cf-border-subtle)" }}
          className="mt-3 border px-3 py-2"
        >
          <div className="font-mono-tabular text-[11px] break-all text-[var(--cf-text-tertiary)]">
            {error.digest ? `编号 ${error.digest}` : error.message || "未知错误"}
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={reset}
            style={{ backgroundColor: "var(--cf-primary)", color: "var(--cf-surface-card)" }}
            className="h-[30px] px-3 text-[12.5px] font-semibold"
          >
            重试
          </button>
          <Link
            href="/"
            style={{ borderColor: "var(--cf-border-strong)" }}
            className="flex h-[30px] items-center border px-3 text-[12.5px] text-[var(--cf-text-secondary)]"
          >
            回到项目大厅
          </Link>
        </div>
      </div>
    </main>
  );
}
