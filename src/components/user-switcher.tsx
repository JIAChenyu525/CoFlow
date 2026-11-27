"use client";

import { useRef, useTransition } from "react";
import { switchUser } from "@/app/actions/session";

type U = { id: string; name: string; color: string; handle: string };

/** 开发环境专用：跳过登录切换演示身份。生产构建不渲染。 */
export function UserSwitcher({ users, currentId }: { users: U[]; currentId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();

  return (
    <form
      ref={formRef}
      action={switchUser}
      className="flex items-center gap-1"
      onSubmit={() => start(() => {})}
      title="开发环境身份切换（生产构建不存在）"
    >
      <span
        style={{ borderColor: "var(--cf-border-strong)", color: "var(--cf-text-muted)" }}
        className="border px-1 py-[1px] font-mono-tabular text-[9px] font-bold tracking-wider"
      >
        DEV
      </span>
      <select
        key={currentId}
        name="userId"
        defaultValue={currentId}
        disabled={pending}
        onChange={() => formRef.current?.requestSubmit()}
        style={{
          borderColor: "var(--cf-border-strong)",
          backgroundColor: "var(--cf-surface-card)",
          color: "var(--cf-text-primary)",
          appearance: "none",
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2378716c' stroke-width='3'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 6px center",
        }}
        className="h-[24px] rounded-none border px-1.5 pr-6 text-[11.5px] font-medium outline-none"
      >
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
    </form>
  );
}
