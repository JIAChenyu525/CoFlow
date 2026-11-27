"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  devSwitchUser,
  loginWithPassword,
  requestCode,
  requestPasswordReset,
  resetPassword,
  verifyCode,
} from "@/app/actions/auth";

type DemoUser = { id: string; name: string; email: string; color: string };

export function LoginForm({
  showDevCode,
  demoUsers,
}: {
  showDevCode: boolean;
  demoUsers: DemoUser[];
}) {
  const [mode, setMode] = useState<"password" | "code">("password");
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="card p-5">
      <div className="mb-4 flex rounded-md border border-[var(--line)] p-0.5">
        {(
          [
            ["password", "邮箱密码登录"],
            ["code", "验证码登录"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setMode(key);
              setNotice(null);
            }}
            className={`flex-1 rounded px-2 py-1.5 text-[12px] font-medium transition ${
              mode === key
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {notice && (
        <div className="mb-3 rounded-md border border-[var(--green)]/30 bg-[var(--green-soft)]/60 px-3 py-2 text-[11.5px] leading-relaxed text-[var(--ink-2)]">
          {notice}
        </div>
      )}

      {mode === "password" ? (
        <PasswordPane onNotice={setNotice} />
      ) : (
        <CodePane showDevCode={showDevCode} demoUsers={demoUsers} />
      )}
    </div>
  );
}

function PasswordPane({ onNotice }: { onNotice: (msg: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [resetMode, setResetMode] = useState(false);

  if (resetMode) {
    return (
      <ResetPane
        onBack={() => setResetMode(false)}
        onDone={(msg) => {
          setResetMode(false);
          onNotice(msg);
        }}
      />
    );
  }

  function submit() {
    setError(null);
    start(async () => {
      const res = await loginWithPassword({ email, password });
      if (res && !res.ok) setError(res.error);
    });
  }

  return (
    <div className="space-y-3">
      <label className="field block">
        <span className="text-[12.5px] font-semibold">邮箱</span>
        <input
          className="input"
          type="email"
          autoFocus
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </label>
      <label className="field block">
        <span className="text-[12.5px] font-semibold">密码</span>
        <input
          className="input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && email.trim() && password) submit();
          }}
          placeholder="至少 8 位，含字母和数字"
        />
      </label>

      {error && <p className="text-[11.5px] text-[var(--red)]">{error}</p>}

      <button
        type="button"
        className="btn btn-primary w-full"
        disabled={pending || !email.trim() || !password}
        onClick={submit}
      >
        {pending ? "登录中…" : "登录"}
      </button>

      <div className="flex items-center justify-between text-[11.5px]">
        <Link href="/register" className="text-[var(--accent-ink)] hover:underline">
          注册新账号
        </Link>
        <button
          type="button"
          className="text-[var(--accent-ink)] hover:underline"
          onClick={() => setResetMode(true)}
        >
          忘记密码？
        </button>
      </div>
    </div>
  );
}

/** 忘记密码：邮箱验证码 → 设置新密码 → 系统发提醒邮件 */
function ResetPane({
  onBack,
  onDone,
}: {
  onBack: () => void;
  onDone: (msg: string) => void;
}) {
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
      const res = await requestPasswordReset(email);
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
      setError("两次输入的新密码不一致");
      return;
    }
    setError(null);
    start(async () => {
      const res = await resetPassword({ email, code, newPassword: password });
      if (res.ok) {
        onDone(
          "密码已重置。所有设备的登录已失效，请用新密码重新登录；系统还会给你发一封「密码已修改」提醒邮件。"
        );
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[12.5px] font-semibold">重置密码</span>
        <button
          type="button"
          className="text-[11px] text-[var(--muted)] hover:text-[var(--ink)]"
          onClick={onBack}
        >
          返回登录
        </button>
      </div>

      {step === "email" ? (
        <>
          <p className="text-[11.5px] leading-relaxed text-[var(--muted)]">
            输入账号邮箱，我们会发一封验证码邮件。验证通过后才能设置新密码。
          </p>
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
            {pending ? "发送中…" : "发送重置验证码"}
          </button>
        </>
      ) : (
        <>
          <p className="text-[11.5px] leading-relaxed text-[var(--muted)]">
            如果 <span className="font-medium text-[var(--ink-2)]">{email}</span> 已注册，验证码已经发出，
            10 分钟内有效。
          </p>

          {devCode && (
            <div className="rounded-md border border-[var(--amber)]/30 bg-[var(--amber-soft)]/60 px-3 py-2 text-[11.5px] text-[var(--ink-2)]">
              开发模式验证码：
              <span className="mono text-[13px] font-bold tracking-widest text-[var(--amber)]">
                {devCode}
              </span>
            </div>
          )}

          <input
            className="input mono text-center text-[18px] tracking-[0.4em]"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
          />
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="新密码（至少 8 位，含字母和数字）"
          />
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="再输一次新密码"
          />

          {error && <p className="text-[11.5px] text-[var(--red)]">{error}</p>}

          <button
            type="button"
            className="btn btn-primary w-full"
            disabled={pending || code.length !== 6 || !password || !confirm}
            onClick={submit}
          >
            {pending ? "重置中…" : "重置密码"}
          </button>
          <p className="text-[10.5px] leading-relaxed text-[var(--faint)]">
            重置成功后，所有已登录设备都会被下线，并给你发一封「密码已修改」提醒邮件。
          </p>
        </>
      )}
    </div>
  );
}

function CodePane({ showDevCode, demoUsers }: { showDevCode: boolean; demoUsers: DemoUser[] }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
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

  function verify() {
    setError(null);
    start(async () => {
      const res = await verifyCode({ email, code });
      if (res && !res.ok) setError(res.error);
    });
  }

  return (
    <>
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
            没注册过也没关系：验证码登录会自动建账号，之后可以在「账号与安全」里设置密码。
          </p>

          {demoUsers.length > 0 && (
            <div className="pt-2">
              <div className="flex items-center gap-2">
                <span className="h-px flex-1 bg-[var(--line)]" />
                <span className="text-[10.5px] tracking-wider text-[var(--faint)]">
                  开发环境 · 快速进入
                </span>
                <span className="h-px flex-1 bg-[var(--line)]" />
              </div>
              <div className="mt-2 space-y-1">
                {demoUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    disabled={pending}
                    onClick={() => start(async () => void (await devSwitchUser(u.id)))}
                    className="flex w-full items-center gap-2 rounded-md border border-[var(--line)] px-2.5 py-1.5 text-left text-[12px] transition hover:border-[var(--line-strong)] hover:bg-[var(--surface-2)]"
                  >
                    <span className="avatar" style={{ background: u.color, width: 20, height: 20, fontSize: 9 }}>
                      {u.name.slice(0, 1)}
                    </span>
                    <span className="font-medium">{u.name}</span>
                    <span className="mono ml-auto text-[10.5px] text-[var(--faint)]">
                      {u.email || "未绑定邮箱"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[12.5px] font-semibold">验证码</span>
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
            已发送到 <span className="font-medium text-[var(--ink-2)]">{email}</span>，10 分钟内有效。
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
            onKeyDown={(e) => {
              if (e.key === "Enter" && code.length === 6) verify();
            }}
            placeholder="000000"
          />

          {error && <p className="text-[11.5px] text-[var(--red)]">{error}</p>}

          <button
            type="button"
            className="btn btn-primary w-full"
            disabled={pending || code.length !== 6}
            onClick={verify}
          >
            {pending ? "验证中…" : "登录"}
          </button>
        </div>
      )}
    </>
  );
}
