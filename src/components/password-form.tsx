"use client";

import { useState, useTransition } from "react";
import { setPassword } from "@/app/actions/auth";

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    if (next !== confirm) {
      setError("两次输入的新密码不一致");
      return;
    }
    setError(null);
    setDone(null);
    start(async () => {
      const res = await setPassword({
        currentPassword: hasPassword ? current : undefined,
        newPassword: next,
      });
      if (res.ok) {
        setDone(hasPassword ? "密码已更新" : "密码已设置，之后可以用邮箱 + 密码登录");
        setCurrent("");
        setNext("");
        setConfirm("");
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="mt-2 max-w-[420px] space-y-2.5">
      {hasPassword ? (
        <input
          className="input h-[32px] text-[12.5px]"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder="当前密码"
        />
      ) : (
        <p className="text-[11.5px] leading-relaxed text-[var(--cf-text-tertiary)]">
          这个账号目前只能用验证码登录。设置密码后，登录时可以直接用邮箱加密码。
        </p>
      )}

      <input
        className="input h-[32px] text-[12.5px]"
        type="password"
        autoComplete="new-password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        placeholder="新密码（至少 8 位，含字母和数字）"
      />
      <input
        className="input h-[32px] text-[12.5px]"
        type="password"
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && next && confirm) submit();
        }}
        placeholder="再输一次新密码"
      />

      {error && <p className="text-[11.5px] text-[var(--cf-danger)]">{error}</p>}
      {done && <p className="text-[11.5px] text-[var(--cf-success)]">{done}</p>}

      <button
        type="button"
        className="btn btn-primary h-[30px] px-3 text-[12px]"
        disabled={pending || !next || !confirm || (hasPassword && !current)}
        onClick={submit}
      >
        {pending ? "保存中…" : hasPassword ? "修改密码" : "设置密码"}
      </button>
    </div>
  );
}
