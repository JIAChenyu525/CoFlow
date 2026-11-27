import Link from "next/link";

export default function NotFound() {
  return (
    <main className="cf-scope flex min-h-[calc(100dvh-52px)] items-center justify-center px-5">
      <div
        style={{
          backgroundColor: "var(--cf-surface-card)",
          borderColor: "var(--cf-border-strong)",
          boxShadow: "var(--cf-shadow-card)",
        }}
        className="w-full max-w-[480px] border p-6"
      >
        <div className="font-mono-tabular text-[10.5px] font-semibold tracking-widest text-[var(--cf-text-tertiary)]">
          404 / NOT FOUND
        </div>
        <h1 className="mt-1.5 text-[19px] font-bold text-[var(--cf-text-primary)]">
          找不到这个页面
        </h1>
        <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--cf-text-secondary)]">
          链接可能已经失效，或者对应项目已被归档、删除。也有可能是当前账号没有该项目的访问权限。
        </p>
        <Link
          href="/"
          style={{ backgroundColor: "var(--cf-primary)", color: "var(--cf-surface-card)" }}
          className="mt-4 inline-flex h-[30px] items-center px-3 text-[12.5px] font-semibold"
        >
          回到项目大厅
        </Link>
      </div>
    </main>
  );
}
