"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function PairingForm({ initialCode = "" }: { initialCode?: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function approve() {
    setError(null);
    setDone(null);
    start(async () => {
      const res = await fetch("/api/device/pair/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_code: code }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setDone(`已授权「${data.device_name}」，连接器会在几秒内完成配对。`);
        setCode("");
        router.refresh();
        return;
      }

      const map: Record<string, string> = {
        invalid_format: "配对码是 8 位，形如 ABCD-2345",
        not_found: "找不到这个配对码，确认连接器还在运行",
        expired: "配对码已过期，请在连接器里重新执行 coflow login",
        already_handled: "这个配对码已经用过了",
        rate_limited: "尝试太频繁，请稍后再试",
        unauthenticated: "登录状态已失效，请重新登录",
      };
      setError(map[data.error] ?? "配对失败，请重试");
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        <label className="field flex-1">
          <span className="text-[12px] font-semibold">配对码</span>
          <input
            className="input mono uppercase tracking-[0.25em]"
            value={code}
            maxLength={9}
            placeholder="ABCD-2345"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter" && code.trim()) approve();
            }}
          />
        </label>
        <button
          type="button"
          className="btn btn-primary h-[38px]"
          disabled={pending || code.replace(/[^A-Z0-9]/gi, "").length !== 8}
          onClick={approve}
        >
          {pending ? "授权中…" : "授权这台设备"}
        </button>
      </div>

      {error && <p className="text-[11.5px] text-[var(--red)]">{error}</p>}
      {done && (
        <p className="rounded-md bg-[var(--green-soft)] px-3 py-2 text-[11.5px] text-[var(--green)]">
          {done}
        </p>
      )}
    </div>
  );
}

export function EndpointPaths({
  endpointId,
  paths,
}: {
  endpointId: string;
  paths: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(paths.join(", "));
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    start(async () => {
      const res = await fetch(`/api/endpoints/${endpointId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          allowedPaths: value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else setError("保存失败");
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-xs btn-ghost"
        onClick={() => setOpen(true)}
        title="设置这个端点可以读写的目录"
      >
        {paths.length > 0 ? "改授权目录" : "授权目录"}
      </button>
    );
  }

  return (
    <div className="flex w-full items-center gap-1.5 pt-1">
      <input
        className="input mono h-6 flex-1 py-0 text-[10.5px]"
        placeholder="用逗号分隔，如 D:/work/demo, backend/upload"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
      />
      <button type="button" className="btn btn-xs btn-primary" disabled={pending} onClick={save}>
        保存
      </button>
      <button type="button" className="btn btn-xs btn-ghost" onClick={() => setOpen(false)}>
        取消
      </button>
      {error && <span className="text-[10px] text-[var(--red)]">{error}</span>}
    </div>
  );
}

export function RevokeDeviceButton({ deviceId, name }: { deviceId: string; name: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function revoke() {
    setError(null);
    start(async () => {
      const res = await fetch(`/api/devices/${deviceId}`, { method: "DELETE" });
      if (res.ok) {
        setConfirming(false);
        router.refresh();
      } else {
        setError("撤销失败");
      }
    });
  }

  if (!confirming) {
    return (
      <button type="button" className="btn btn-xs btn-danger" onClick={() => setConfirming(true)}>
        撤销
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10.5px] text-[var(--muted)]">撤销「{name}」？</span>
      <button type="button" className="btn btn-xs btn-danger" disabled={pending} onClick={revoke}>
        {pending ? "…" : "确认撤销"}
      </button>
      <button type="button" className="btn btn-xs btn-ghost" onClick={() => setConfirming(false)}>
        取消
      </button>
      {error && <span className="text-[10px] text-[var(--red)]">{error}</span>}
    </div>
  );
}
