"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { registerWithPassword, requestCode } from "@/app/actions/auth";

export function RegisterForm({ showDevCode }: { showDevCode: boolean }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function send() {
    setError(null);
    start(async () => {
      const res = await requestCode(email);
      if (res.ok) {
        setStep("code");
        setDevCode(res.devCode ?? null);
      } else {
        setError(res.error);
      }
    });
  }

  function submit() {
    if (password !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }
    setError(null);
    start(async () => {
      const res = await registerWithPassword({ email, code, password });
      if (res && !res.ok) setError(res.error);
    });
  }

  return (
    <div className="card p-5">
      {step === "email" ? (
        <div className="space-y-3">
          <label className="field block">
            <span className="text-[12.5px] font-semibold">邮箱</span>
            <input
              className="input"
              type="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && email.trim()) send();
              }}
              placeholder="you@example.com"
            />
          </label>

          {error && <p className="text-[11.5px] text-[var(--red)]">{error}</p>}

          <button
            type="button"
            className="btn btn-primary w-full"
            disabled={pending || !email.trim()}
            onClick={send}
          >
            {pending ? "发送中…" : "发送验证码"}
          </button>

          <p className="text-[11px] leading-relaxed text-[var(--muted)]">
            我们会往这个邮箱发一封六位验证码，用来确认邮箱是你本人的。
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[12.5px] font-semibold">验证并设置密码</span>
            <button
              type="button"
              className="text-[11px] text-[var(--muted)] hover:text-[var(--ink)]"
              onClick={() => {
                setStep("email");
                setCode("");
                setError(null);
              }}
            >
              换个邮箱
            </button>
          </div>
          <p className="text-[11.5px] leading-relaxed text-[var(--muted)]">
            验证码已发到 <span className="font-medium text-[var(--ink-2)]">{email}</span>，10 分钟内有效。
          </p>

          {devCode && showDevCode && (
            <div className="rounded-md border border-[var(--amber)]/30 bg-[var(--amber-soft)]/60 px-3 py-2 text-[11.5px] text-[var(--ink-2)]">
              开发模式：未配置 SMTP，验证码是{" "}
              <span className="mono text-[13px] font-bold tracking-widest text-[var(--amber)]">
                {devCode}
              </span>
            </div>
          )}

          <input
            className="input mono text-center text-[18px] tracking-[0.4em]"
            inputMode="numeric"
            maxLength={6}
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
          />

          <label className="field block">
            <span className="text-[12.5px] font-semibold">设置密码</span>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 8 位，含字母和数字"
            />
          </label>

          <label className="field block">
            <span className="text-[12.5px] font-semibold">再输一次</span>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && code.length === 6 && password) submit();
              }}
              placeholder="确认密码"
            />
          </label>

          {error && <p className="text-[11.5px] text-[var(--red)]">{error}</p>}

          <button
            type="button"
            className="btn btn-primary w-full"
            disabled={pending || code.length !== 6 || !password || !confirm}
            onClick={submit}
          >
            {pending ? "创建中…" : "创建账号并登录"}
          </button>
        </div>
      )}

      <p className="mt-4 text-center text-[11.5px] text-[var(--muted)]">
        已经有账号了？
        <Link href="/login" className="ml-1 text-[var(--accent-ink)] hover:underline">
          去登录
        </Link>
      </p>
    </div>
  );
}
